import React from 'react';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiProductDetail, computeProductBadge } from '../ApiProductDetail';
import { CartProvider, useCart } from '../../cart/CartProvider';
import { FavoritesProvider } from '../../favorites/FavoritesProvider';
import { ToastProvider } from '../../ui/ToastProvider';
import {
  fetchProductDetailFromApi,
  checkCartAvailability,
  ProductApiError,
  AvailabilityResult,
} from '../../../services/product-api';
import { ProductDetail } from '../../../types/product';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('../../../services/product-api', () => ({
  ...jest.requireActual('../../../services/product-api'),
  fetchProductDetailFromApi: jest.fn(),
  checkCartAvailability: jest.fn(),
}));

const mockProduct: ProductDetail = {
  id: 'a0000000-0000-0000-0000-000000000001',
  name: 'Cà phê đen đá',
  basePrice: 25000,
  imageUrl: 'https://example.com/coffee.jpg',
  isAvailable: true,
  canOrder: true,
  inventory: null, // Legacy inventory is null, ensuring purely recipe-based testing
  options: [
    { id: 'size-m-id', type: 'SIZE', name: 'Size M', extraPrice: 0 },
    { id: 'size-l-id', type: 'SIZE', name: 'Size L', extraPrice: 6000 },
    { id: 'topping-jelly-id', type: 'TOPPING', name: 'Thạch cà phê', extraPrice: 5000 },
  ],
};

function mockAvailabilityResponse(availableQuantity = 10, canOrder = true, overallCanOrder = true) {
  return async (items: any[]): Promise<AvailabilityResult> => ({
    canOrder: overallCanOrder,
    items: items.map((it: any, idx: number) => ({
      index: idx,
      productId: it.productId,
      sizeId: it.customization?.size ?? 'size-m-id',
      requestedQuantity: it.quantity,
      availableQuantity,
      canOrder,
    })),
  });
}

function CartProbe() {
  const { items } = useCart();
  return <output data-testid="cart-probe">{JSON.stringify(items)}</output>;
}

function renderComponent(productId = mockProduct.id) {
  return render(
    <ToastProvider>
      <CartProvider>
        <FavoritesProvider>
          <ApiProductDetail id={productId} />
          <CartProbe />
        </FavoritesProvider>
      </CartProvider>
    </ToastProvider>,
  );
}

describe('ApiProductDetail Canonical Availability Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPush.mockReset();
    localStorage.clear();
    (fetchProductDetailFromApi as jest.Mock).mockResolvedValue(mockProduct);
    (checkCartAvailability as jest.Mock).mockImplementation(mockAvailabilityResponse(10, true, true));
  });

  afterEach(() => {
    cleanup();
  });

  it('1. không gọi API availability khi chưa chọn SIZE', async () => {
    const productNoSize: ProductDetail = {
      ...mockProduct,
      options: [
        { id: 'topping-only-id', type: 'TOPPING', name: 'Thạch cà phê', extraPrice: 5000 },
      ],
    };
    (fetchProductDetailFromApi as jest.Mock).mockResolvedValue(productNoSize);

    renderComponent();
    await screen.findByRole('heading', { name: mockProduct.name });

    expect(checkCartAvailability).not.toHaveBeenCalled();
    expect(
      screen.getByText('Chọn kích cỡ để xem số lượng có thể đặt'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thêm vào giỏ hàng' })).toBeDisabled();
    expect(screen.getByText('Chọn kích cỡ')).toBeInTheDocument();
  });

  it('2. chọn SIZE gọi checkCartAvailability với preview line và AbortSignal', async () => {
    renderComponent();
    await screen.findByRole('heading', { name: mockProduct.name });

    await waitFor(() => {
      expect(checkCartAvailability).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            productId: mockProduct.id,
            customization: expect.objectContaining({ size: 'size-m-id' }),
            quantity: 1,
          }),
        ],
        expect.any(AbortSignal),
      );
    });
  });

  it('3. chọn SIZE + TOPPING gửi toàn bộ options trong preview line', async () => {
    renderComponent();
    await screen.findByRole('heading', { name: mockProduct.name });

    // Click topping
    await userEvent.click(screen.getByRole('checkbox', { name: /Thạch cà phê/ }));

    await waitFor(() => {
      expect(checkCartAvailability).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            productId: mockProduct.id,
            customization: expect.objectContaining({
              size: 'size-m-id',
              toppingIds: ['topping-jelly-id'],
            }),
            quantity: 1,
          }),
        ],
        expect.any(AbortSignal),
      );
    });
  });

  it('4. gửi cart items hiện tại cùng preview line và chọn đúng result theo index', async () => {
    const existingCart = {
      items: [
        {
          lineId: 'existing-line-1',
          productId: 'prod-existing',
          name: 'Trà đào',
          imageUrl: '',
          basePrice: 30000,
          unitPrice: 30000,
          quantity: 2,
          customization: { size: 'size-existing', toppingIds: [] },
          productOptions: [],
        },
      ],
      voucherCode: null,
    };
    localStorage.setItem('brewlite-cart', JSON.stringify(existingCart));

    (checkCartAvailability as jest.Mock).mockImplementation(async (items: any[]) => ({
      canOrder: true,
      items: [
        {
          index: 0,
          productId: 'prod-existing',
          sizeId: 'size-existing',
          requestedQuantity: 2,
          availableQuantity: 5,
          canOrder: true,
        },
        {
          index: 1,
          productId: mockProduct.id,
          sizeId: 'size-m-id',
          requestedQuantity: 1,
          availableQuantity: 18, // Preview line có 18 ly
          canOrder: true,
        },
      ],
    }));

    renderComponent();
    await screen.findByRole('heading', { name: mockProduct.name });

    expect(await screen.findByText('Còn tối đa 18 ly')).toBeInTheDocument();
  });

  it('5. hiển thị loading "Đang kiểm tra nguyên liệu..." trong lúc gọi API', async () => {
    let resolveApi: ((value: any) => void) | undefined;
    (checkCartAvailability as jest.Mock).mockReturnValue(
      new Promise((res) => {
        resolveApi = res;
      }),
    );

    renderComponent();
    await screen.findByRole('heading', { name: mockProduct.name });

    expect(screen.getByText('Đang kiểm tra nguyên liệu...')).toBeInTheDocument();
    expect(screen.getByText('Đang kiểm tra')).toBeInTheDocument();

    resolveApi?.(await mockAvailabilityResponse(10, true, true)([
      { productId: mockProduct.id, customization: { size: 'size-m-id', toppingIds: [] }, quantity: 1 },
    ]));

    expect(await screen.findByText('Còn tối đa 10 ly')).toBeInTheDocument();
  });

  it('6. hiển thị "Còn tối đa X ly" khi còn nguyên liệu', async () => {
    (checkCartAvailability as jest.Mock).mockImplementation(mockAvailabilityResponse(42, true, true));

    renderComponent();
    await screen.findByRole('heading', { name: mockProduct.name });

    expect(await screen.findByText('Còn tối đa 42 ly')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Thêm vào giỏ hàng' })).toBeEnabled();
    });
    expect(screen.getByText('Còn món')).toBeInTheDocument();
  });

  it('7. availableQuantity = 0 hiển thị "Món hiện không đủ nguyên liệu" và khóa nút thêm', async () => {
    (checkCartAvailability as jest.Mock).mockImplementation(mockAvailabilityResponse(0, false, false));

    renderComponent();
    await screen.findByRole('heading', { name: mockProduct.name });

    expect(await screen.findByText('Món hiện không đủ nguyên liệu')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thêm vào giỏ hàng' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Mua ngay' })).toBeDisabled();
    expect(screen.getByText('Tạm hết món')).toBeInTheDocument();
  });

  it('8. preview canOrder = false khóa nút thêm vào giỏ', async () => {
    (checkCartAvailability as jest.Mock).mockImplementation(mockAvailabilityResponse(15, false, false));

    renderComponent();
    await screen.findByRole('heading', { name: mockProduct.name });

    expect(await screen.findByText('Món hiện không đủ nguyên liệu')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thêm vào giỏ hàng' })).toBeDisabled();
  });

  it('9. overall canOrder = false khóa nút thêm vào giỏ dù preview line còn hàng', async () => {
    (checkCartAvailability as jest.Mock).mockImplementation(async (items: any[]) => ({
      canOrder: false,
      items: items.map((it, idx) => ({
        index: idx,
        productId: it.productId,
        sizeId: it.customization.size,
        requestedQuantity: it.quantity,
        availableQuantity: 15,
        canOrder: true,
      })),
    }));

    renderComponent();
    await screen.findByRole('heading', { name: mockProduct.name });

    expect(await screen.findByText('Món hiện không đủ nguyên liệu')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thêm vào giỏ hàng' })).toBeDisabled();
    expect(screen.getByText('Tạm hết món')).toBeInTheDocument();
  });

  it('10. không cho tăng quantity vượt quá availableQuantity', async () => {
    (checkCartAvailability as jest.Mock).mockImplementation(mockAvailabilityResponse(5, true, true));

    renderComponent();
    await screen.findByRole('heading', { name: mockProduct.name });
    await screen.findByText('Còn tối đa 5 ly');

    const input = screen.getByRole('spinbutton');
    await userEvent.clear(input);
    await userEvent.type(input, '10');

    expect(input).toHaveValue(5);
    expect(
      await screen.findByText('Chỉ còn đủ nguyên liệu cho tối đa 5 ly. Không thể thêm nhiều hơn.'),
    ).toBeInTheDocument();
  });

  it('10b. nút tăng bị khóa khi chạm mức tối đa và hiện popup khi bấm thêm', async () => {
    (checkCartAvailability as jest.Mock).mockImplementation(mockAvailabilityResponse(2, true, true));

    renderComponent();
    await screen.findByRole('heading', { name: mockProduct.name });
    await screen.findByText('Còn tối đa 2 ly');

    const input = screen.getByRole('spinbutton');
    const plus = screen.getByRole('button', { name: 'Tăng số lượng' });

    await userEvent.click(plus);
    expect(input).toHaveValue(2);
    expect(plus).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('Đã đạt số lượng tối đa (2 ly)')).toBeInTheDocument();

    await userEvent.click(plus);
    expect(input).toHaveValue(2);
    expect(
      await screen.findByText('Chỉ còn đủ nguyên liệu cho tối đa 2 ly. Không thể thêm nhiều hơn.'),
    ).toBeInTheDocument();
  });

  it('11. đổi option làm stock giảm thì quantity tự điều chỉnh và có thông báo', async () => {
    (checkCartAvailability as jest.Mock).mockImplementation(async (items: any[]) => {
      const last = items[items.length - 1];
      const stock = last?.customization?.size === 'size-l-id' ? 3 : 10;
      return {
        canOrder: true,
        items: items.map((it, idx) => ({
          index: idx,
          productId: it.productId,
          sizeId: it.customization?.size ?? 'size-m-id',
          requestedQuantity: it.quantity,
          availableQuantity: stock,
          canOrder: true,
        })),
      };
    });

    renderComponent();
    await screen.findByRole('heading', { name: mockProduct.name });
    await screen.findByText('Còn tối đa 10 ly');

    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '8' } });
    expect(input).toHaveValue(8);

    // Switch to Size L
    await userEvent.click(screen.getByRole('button', { name: /Size L/ }));

    await waitFor(() => {
      expect(input).toHaveValue(3);
    });
    expect(
      await screen.findByText('Số lượng đã được điều chỉnh theo nguyên liệu hiện có.'),
    ).toBeInTheDocument();
  });

  it('12. khi availableQuantity = 0, quantity giữ nguyên >= 1 không bị kéo về 0', async () => {
    (checkCartAvailability as jest.Mock).mockImplementation(mockAvailabilityResponse(0, false, false));

    renderComponent();
    await screen.findByRole('heading', { name: mockProduct.name });
    await screen.findByText('Món hiện không đủ nguyên liệu');

    const input = screen.getByRole('spinbutton');
    expect(input).toHaveValue(1);
    expect(input).toBeDisabled();
  });

  it('13. direct input rỗng, 0, âm hoặc NaN tự động reset về 1', async () => {
    (checkCartAvailability as jest.Mock).mockImplementation(mockAvailabilityResponse(10, true, true));

    renderComponent();
    await screen.findByRole('heading', { name: mockProduct.name });
    await screen.findByText('Còn tối đa 10 ly');

    const input = screen.getByRole('spinbutton');

    fireEvent.change(input, { target: { value: '' } });
    expect(input).toHaveValue(1);

    fireEvent.change(input, { target: { value: '0' } });
    expect(input).toHaveValue(1);

    fireEvent.change(input, { target: { value: '-5' } });
    expect(input).toHaveValue(1);
  });

  it('14. API lỗi hiển thị thông báo lỗi và nút Thử lại', async () => {
    (checkCartAvailability as jest.Mock).mockRejectedValue(
      new ProductApiError('Lỗi kết nối máy chủ', 500),
    );

    renderComponent();
    await screen.findByRole('heading', { name: mockProduct.name });

    expect(await screen.findByText('Lỗi kết nối máy chủ')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thêm vào giỏ hàng' })).toBeDisabled();
    expect(screen.getByText('Chưa xác định')).toBeInTheDocument();
  });

  it('15. nút "Thử lại" gọi lại API', async () => {
    (checkCartAvailability as jest.Mock)
      .mockRejectedValueOnce(new ProductApiError('Lỗi tạm thời', 500))
      .mockImplementationOnce(mockAvailabilityResponse(12, true, true));

    renderComponent();
    await screen.findByRole('heading', { name: mockProduct.name });

    const retryBtn = await screen.findByRole('button', { name: 'Thử lại' });
    await userEvent.click(retryBtn);

    expect(await screen.findByText('Còn tối đa 12 ly')).toBeInTheDocument();
  });

  it('16. AbortController hủy request cũ khi đổi option nhanh', async () => {
    const abortedSignals: boolean[] = [];
    (checkCartAvailability as jest.Mock).mockImplementation((_items, signal: AbortSignal) => {
      signal.addEventListener('abort', () => {
        abortedSignals.push(true);
      });
      return new Promise(() => {}); // pending
    });

    renderComponent();
    await screen.findByRole('heading', { name: mockProduct.name });

    await userEvent.click(screen.getByRole('button', { name: /Size L/ }));

    expect(abortedSignals.length).toBeGreaterThan(0);
  });

  it('17. response thiếu preview index bị xem là không hợp lệ', async () => {
    (checkCartAvailability as jest.Mock).mockResolvedValue({
      canOrder: true,
      items: [{ index: 99, productId: 'other', sizeId: 'other', requestedQuantity: 1, availableQuantity: 10, canOrder: true }],
    });

    renderComponent();
    await screen.findByRole('heading', { name: mockProduct.name });

    expect(await screen.findByText('Không tìm thấy thông tin tồn kho cho món này')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thêm vào giỏ hàng' })).toBeDisabled();
    expect(screen.getByText('Chưa xác định')).toBeInTheDocument();
  });

  it('18. product.isAvailable = false hiển thị "Tạm ngừng bán" và khóa đặt món', async () => {
    const disabledProduct: ProductDetail = {
      ...mockProduct,
      isAvailable: false,
    };
    (fetchProductDetailFromApi as jest.Mock).mockResolvedValue(disabledProduct);

    renderComponent();
    await screen.findByRole('heading', { name: disabledProduct.name });

    expect(await screen.findByText('Món hiện không thể đặt.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thêm vào giỏ hàng' })).toBeDisabled();
    expect(screen.getByText('Tạm ngừng bán')).toBeInTheDocument();
  });

  it('19. async addItem trả true: toast và redirect khi Mua ngay', async () => {
    renderComponent();
    await screen.findByRole('heading', { name: mockProduct.name });
    await screen.findByText('Còn tối đa 10 ly');

    const addBtn = screen.getByRole('button', { name: 'Thêm vào giỏ hàng' });
    await waitFor(() => expect(addBtn).toBeEnabled(), { timeout: 3000 });

    // Nút Thêm vào giỏ hàng
    await userEvent.click(addBtn);
    expect(await screen.findByText(/Đã thêm 1x Cà phê đen đá vào giỏ!/, {}, { timeout: 3000 })).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();

    // Nút Mua ngay
    const buyBtn = screen.getByRole('button', { name: 'Mua ngay' });
    await waitFor(() => expect(buyBtn).toBeEnabled(), { timeout: 3000 });
    await userEvent.click(buyBtn);
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/gio-hang'), { timeout: 3000 });
  });

  it('20. async addItem trả false: không hiển thị toast thành công và không redirect', async () => {
    (checkCartAvailability as jest.Mock).mockResolvedValue({
      canOrder: false,
      items: [{ index: 0, canOrder: false, availableQuantity: 0 }],
    });

    renderComponent();
    await screen.findByRole('heading', { name: mockProduct.name });
    await screen.findByText('Món hiện không đủ nguyên liệu');

    expect(screen.getByRole('button', { name: 'Thêm vào giỏ hàng' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Mua ngay' })).toBeDisabled();
    expect(screen.queryByText(/Đã thêm/)).not.toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('21. không phụ thuộc legacy Inventory khi recipe availability thành công', async () => {
    const legacyZeroProduct: ProductDetail = {
      ...mockProduct,
      inventory: { quantity: 0, reserved: 0, availableStock: 0 },
      canOrder: false,
    };
    (fetchProductDetailFromApi as jest.Mock).mockResolvedValue(legacyZeroProduct);
    (checkCartAvailability as jest.Mock).mockImplementation(mockAvailabilityResponse(15, true, true));

    renderComponent();
    await screen.findByRole('heading', { name: legacyZeroProduct.name });

    expect(await screen.findByText('Còn tối đa 15 ly')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Thêm vào giỏ hàng' })).toBeEnabled();
    });
    expect(screen.getByText('Còn món')).toBeInTheDocument();
  });

  describe('computeProductBadge pure function unit tests', () => {
    const validPreview = {
      index: 0,
      productId: 'p1',
      sizeId: 's1',
      requestedQuantity: 1,
      availableQuantity: 5,
      canOrder: true,
    };
    const validResult = { canOrder: true, items: [validPreview] };

    it('returns "Tạm ngừng bán" when isAvailable = false', () => {
      expect(
        computeProductBadge({
          isAvailable: false,
          isSizeSelected: true,
          isLoading: false,
          error: null,
          availabilityResult: validResult,
          previewAvailability: validPreview,
        }),
      ).toBe('Tạm ngừng bán');
    });

    it('returns "Chọn kích cỡ" when isSizeSelected = false', () => {
      expect(
        computeProductBadge({
          isAvailable: true,
          isSizeSelected: false,
          isLoading: false,
          error: null,
          availabilityResult: null,
          previewAvailability: null,
        }),
      ).toBe('Chọn kích cỡ');
    });

    it('returns "Đang kiểm tra" when isLoading = true', () => {
      expect(
        computeProductBadge({
          isAvailable: true,
          isSizeSelected: true,
          isLoading: true,
          error: null,
          availabilityResult: null,
          previewAvailability: null,
        }),
      ).toBe('Đang kiểm tra');
    });

    it('returns "Chưa xác định" when error !== null', () => {
      expect(
        computeProductBadge({
          isAvailable: true,
          isSizeSelected: true,
          isLoading: false,
          error: new Error('Network fault'),
          availabilityResult: null,
          previewAvailability: null,
        }),
      ).toBe('Chưa xác định');
    });

    it('returns "Chưa xác định" when availabilityResult exists but previewAvailability is missing', () => {
      expect(
        computeProductBadge({
          isAvailable: true,
          isSizeSelected: true,
          isLoading: false,
          error: null,
          availabilityResult: { canOrder: true, items: [] },
          previewAvailability: null,
        }),
      ).toBe('Chưa xác định');
    });

    it('returns "Còn món" when preview canOrder & stock > 0 & overall canOrder = true', () => {
      expect(
        computeProductBadge({
          isAvailable: true,
          isSizeSelected: true,
          isLoading: false,
          error: null,
          availabilityResult: validResult,
          previewAvailability: validPreview,
        }),
      ).toBe('Còn món');
    });

    it('returns "Tạm hết món" when availableQuantity = 0', () => {
      const zeroPreview = { ...validPreview, availableQuantity: 0, canOrder: false };
      expect(
        computeProductBadge({
          isAvailable: true,
          isSizeSelected: true,
          isLoading: false,
          error: null,
          availabilityResult: { canOrder: false, items: [zeroPreview] },
          previewAvailability: zeroPreview,
        }),
      ).toBe('Tạm hết món');
    });

    it('returns "Tạm hết món" when preview canOrder = false', () => {
      const cantOrderPreview = { ...validPreview, canOrder: false };
      expect(
        computeProductBadge({
          isAvailable: true,
          isSizeSelected: true,
          isLoading: false,
          error: null,
          availabilityResult: { canOrder: false, items: [cantOrderPreview] },
          previewAvailability: cantOrderPreview,
        }),
      ).toBe('Tạm hết món');
    });

    it('returns "Tạm hết món" when overall canOrder = false', () => {
      expect(
        computeProductBadge({
          isAvailable: true,
          isSizeSelected: true,
          isLoading: false,
          error: null,
          availabilityResult: { canOrder: false, items: [validPreview] },
          previewAvailability: validPreview,
        }),
      ).toBe('Tạm hết món');
    });
  });
});
