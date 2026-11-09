import React from 'react';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiProductDetail, computeProductBadge } from '../ApiProductDetail';
import { CartProvider, useCart } from '../../cart/CartProvider';
import { FavoritesProvider } from '../../favorites/FavoritesProvider';
import { ToastProvider } from '../../ui/ToastProvider';
import {
  fetchProductDetailFromApi,
  checkProductAvailabilityApi,
  ProductApiError,
} from '../../../services/product-api';
import { ProductDetail } from '../../../types/product';

jest.mock('../../../services/product-api', () => ({
  ...jest.requireActual('../../../services/product-api'),
  fetchProductDetailFromApi: jest.fn(),
  checkProductAvailabilityApi: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
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

describe('ApiProductDetail Recipe Availability Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    (fetchProductDetailFromApi as jest.Mock).mockResolvedValue(mockProduct);
  });

  afterEach(() => {
    cleanup();
  });

  it('7. không gọi API availability khi chưa chọn SIZE', async () => {
    const productNoSize: ProductDetail = {
      ...mockProduct,
      options: [
        { id: 'topping-only-id', type: 'TOPPING', name: 'Thạch cà phê', extraPrice: 5000 },
      ],
    };
    (fetchProductDetailFromApi as jest.Mock).mockResolvedValue(productNoSize);

    renderComponent();
    await screen.findByRole('heading', { name: mockProduct.name });

    expect(checkProductAvailabilityApi).not.toHaveBeenCalled();
    expect(
      screen.getByText('Chọn kích cỡ để xem số lượng có thể đặt'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thêm vào giỏ hàng' })).toBeDisabled();
  });

  it('8. chọn SIZE gọi API đúng option ID', async () => {
    (checkProductAvailabilityApi as jest.Mock).mockResolvedValue({
      productId: mockProduct.id,
      availableStock: 25,
      canOrder: true,
    });

    renderComponent();
    await screen.findByRole('heading', { name: mockProduct.name });

    await waitFor(() => {
      expect(checkProductAvailabilityApi).toHaveBeenCalledWith(
        mockProduct.id,
        ['size-m-id'],
        expect.any(AbortSignal),
      );
    });
  });

  it('9. chọn SIZE + TOPPING gửi toàn bộ selectedOptions', async () => {
    (checkProductAvailabilityApi as jest.Mock).mockResolvedValue({
      productId: mockProduct.id,
      availableStock: 20,
      canOrder: true,
    });

    renderComponent();
    await screen.findByRole('heading', { name: mockProduct.name });

    // Click topping
    await userEvent.click(screen.getByRole('checkbox', { name: /Thạch cà phê/ }));

    await waitFor(() => {
      expect(checkProductAvailabilityApi).toHaveBeenCalledWith(
        mockProduct.id,
        ['size-m-id', 'topping-jelly-id'],
        expect.any(AbortSignal),
      );
    });
  });

  it('10. hiển thị loading "Đang kiểm tra nguyên liệu..." trong lúc gọi API', async () => {
    let resolveApi: (value: any) => void;
    (checkProductAvailabilityApi as jest.Mock).mockReturnValue(
      new Promise((res) => {
        resolveApi = res;
      }),
    );

    renderComponent();
    await screen.findByRole('heading', { name: mockProduct.name });

    expect(screen.getByText('Đang kiểm tra nguyên liệu...')).toBeInTheDocument();

    resolveApi!({
      productId: mockProduct.id,
      availableStock: 10,
      canOrder: true,
    });

    expect(await screen.findByText('Còn tối đa 10 ly')).toBeInTheDocument();
  });

  it('11. hiển thị "Còn tối đa X ly" khi còn nguyên liệu', async () => {
    (checkProductAvailabilityApi as jest.Mock).mockResolvedValue({
      productId: mockProduct.id,
      availableStock: 42,
      canOrder: true,
    });

    renderComponent();
    await screen.findByRole('heading', { name: mockProduct.name });

    expect(await screen.findByText('Còn tối đa 42 ly')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thêm vào giỏ hàng' })).toBeEnabled();
  });

  it('12. availableStock = 0 hiển thị "Món hiện không đủ nguyên liệu" và khóa nút thêm', async () => {
    (checkProductAvailabilityApi as jest.Mock).mockResolvedValue({
      productId: mockProduct.id,
      availableStock: 0,
      canOrder: false,
    });

    renderComponent();
    await screen.findByRole('heading', { name: mockProduct.name });

    expect(await screen.findByText('Món hiện không đủ nguyên liệu')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thêm vào giỏ hàng' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Mua ngay' })).toBeDisabled();
  });

  it('13. canOrder = false khóa nút thêm vào giỏ', async () => {
    (checkProductAvailabilityApi as jest.Mock).mockResolvedValue({
      productId: mockProduct.id,
      availableStock: 15,
      canOrder: false,
    });

    renderComponent();
    await screen.findByRole('heading', { name: mockProduct.name });

    expect(await screen.findByText('Món hiện không đủ nguyên liệu')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thêm vào giỏ hàng' })).toBeDisabled();
  });

  it('14. không cho tăng quantity vượt quá availableStock', async () => {
    (checkProductAvailabilityApi as jest.Mock).mockResolvedValue({
      productId: mockProduct.id,
      availableStock: 5,
      canOrder: true,
    });

    renderComponent();
    await screen.findByRole('heading', { name: mockProduct.name });
    await screen.findByText('Còn tối đa 5 ly');

    const input = screen.getByRole('spinbutton');
    await userEvent.clear(input);
    await userEvent.type(input, '10');

    // Capped at 5
    expect(input).toHaveValue(5);
  });

  it('15. đổi option làm stock giảm thì quantity tự điều chỉnh và có thông báo', async () => {
    (checkProductAvailabilityApi as jest.Mock)
      .mockResolvedValueOnce({
        productId: mockProduct.id,
        availableStock: 10,
        canOrder: true,
      })
      .mockResolvedValueOnce({
        productId: mockProduct.id,
        availableStock: 3, // Stock drops to 3
        canOrder: true,
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
      screen.getByText('Số lượng đã được điều chỉnh theo nguyên liệu hiện có.'),
    ).toBeInTheDocument();
  });

  it('16. API lỗi không làm trắng trang và hiển thị thông báo lỗi', async () => {
    (checkProductAvailabilityApi as jest.Mock).mockRejectedValue(
      new ProductApiError('Lỗi máy chủ', 500),
    );

    renderComponent();
    await screen.findByRole('heading', { name: mockProduct.name });

    expect(
      await screen.findByText('Không thể kiểm tra nguyên liệu. Vui lòng thử lại.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thêm vào giỏ hàng' })).toBeDisabled();
  });

  it('17. có thể thử lại khi API lỗi', async () => {
    (checkProductAvailabilityApi as jest.Mock)
      .mockRejectedValueOnce(new ProductApiError('Lỗi tạm thời', 500))
      .mockResolvedValueOnce({
        productId: mockProduct.id,
        availableStock: 20,
        canOrder: true,
      });

    renderComponent();
    await screen.findByRole('heading', { name: mockProduct.name });

    const retryBtn = await screen.findByRole('button', { name: 'Thử lại' });
    await userEvent.click(retryBtn);

    expect(await screen.findByText('Còn tối đa 20 ly')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thêm vào giỏ hàng' })).toBeEnabled();
  });

  it('18. response cũ không ghi đè response mới (stale request prevention via AbortController)', async () => {
    let resolveFirst: (val: any) => void;
    let resolveSecond: (val: any) => void;

    (checkProductAvailabilityApi as jest.Mock)
      .mockImplementationOnce(() => new Promise((res) => { resolveFirst = res; }))
      .mockImplementationOnce(() => new Promise((res) => { resolveSecond = res; }));

    renderComponent();
    await screen.findByRole('heading', { name: mockProduct.name });

    // Click Size L quickly before first resolves
    await userEvent.click(screen.getByRole('button', { name: /Size L/ }));

    // Resolve second request first (Size L = 8)
    resolveSecond!({
      productId: mockProduct.id,
      availableStock: 8,
      canOrder: true,
    });

    expect(await screen.findByText('Còn tối đa 8 ly')).toBeInTheDocument();

    // Resolve first request later (Size M = 25)
    resolveFirst!({
      productId: mockProduct.id,
      availableStock: 25,
      canOrder: true,
    });

    // Remains 8 ly, NOT overridden by 25
    expect(screen.getByText('Còn tối đa 8 ly')).toBeInTheDocument();
    expect(screen.queryByText('Còn tối đa 25 ly')).not.toBeInTheDocument();
  });

  it('19. unmount component an toàn mà không lỗi cập nhật state', async () => {
    const abortSpy = jest.fn();
    (checkProductAvailabilityApi as jest.Mock).mockImplementation((_id, _opts, signal: AbortSignal) => {
      signal.addEventListener('abort', abortSpy);
      return new Promise(() => {}); // never resolves
    });

    const view = renderComponent();
    await screen.findByRole('heading', { name: mockProduct.name });

    view.unmount();
    expect(abortSpy).toHaveBeenCalled();
  });

  it('20. Cart payload không chứa stock hoặc price giả mạo ngoài contract hiện tại', async () => {
    (checkProductAvailabilityApi as jest.Mock).mockResolvedValue({
      productId: mockProduct.id,
      availableStock: 10,
      canOrder: true,
    });

    renderComponent();
    await screen.findByRole('heading', { name: mockProduct.name });
    await screen.findByText('Còn tối đa 10 ly');

    await userEvent.click(screen.getByRole('button', { name: 'Thêm vào giỏ hàng' }));

    const cartJson = JSON.parse(screen.getByTestId('cart-probe').textContent!);
    expect(cartJson).toHaveLength(1);
    const item = cartJson[0];

    expect(item).toMatchObject({
      productId: mockProduct.id,
      name: mockProduct.name,
      basePrice: mockProduct.basePrice,
      quantity: 1,
      customization: {
        size: 'size-m-id',
        toppingIds: [],
      },
    });

    expect(item).not.toHaveProperty('availableStock');
    expect(item).not.toHaveProperty('stock');
    expect(item).not.toHaveProperty('userId');
  });

  describe('ĐỢT 4.1: FRONTEND AVAILABILITY SAFETY HARDENING', () => {
    it('E.1 hoạt động ổn định trong React.StrictMode mà không gây lỗi hoặc loop', async () => {
      (checkProductAvailabilityApi as jest.Mock).mockResolvedValue({
        productId: mockProduct.id,
        availableStock: 12,
        canOrder: true,
      });

      render(
        <React.StrictMode>
          <ToastProvider>
            <CartProvider>
              <FavoritesProvider>
                <ApiProductDetail id={mockProduct.id} />
                <CartProbe />
              </FavoritesProvider>
            </CartProvider>
          </ToastProvider>
        </React.StrictMode>,
      );

      await screen.findByRole('heading', { name: mockProduct.name });
      expect(await screen.findByText('Còn tối đa 12 ly')).toBeInTheDocument();
      expect(
        screen.queryByText('Số lượng đã được điều chỉnh theo nguyên liệu hiện có.'),
      ).not.toBeInTheDocument();
    });

    it('E.2 stock giảm từ 8 xuống 4: quantity = 4 và notice xuất hiện ổn định', async () => {
      (checkProductAvailabilityApi as jest.Mock)
        .mockResolvedValueOnce({
          productId: mockProduct.id,
          availableStock: 10,
          canOrder: true,
        })
        .mockResolvedValueOnce({
          productId: mockProduct.id,
          availableStock: 4,
          canOrder: true,
        });

      renderComponent();
      await screen.findByRole('heading', { name: mockProduct.name });
      await screen.findByText('Còn tối đa 10 ly');

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '8' } });
      expect(input).toHaveValue(8);

      // Đổi sang Size L (stock = 4)
      await userEvent.click(screen.getByRole('button', { name: /Size L/ }));

      await waitFor(() => {
        expect(input).toHaveValue(4);
      });
      expect(
        screen.getByText('Số lượng đã được điều chỉnh theo nguyên liệu hiện có.'),
      ).toBeInTheDocument();
    });

    it('E.3 stock giảm từ 8 xuống 0: quantity không trở thành 0, nút thêm giỏ disabled và không gọi addItem', async () => {
      (checkProductAvailabilityApi as jest.Mock)
        .mockResolvedValueOnce({
          productId: mockProduct.id,
          availableStock: 10,
          canOrder: true,
        })
        .mockResolvedValueOnce({
          productId: mockProduct.id,
          availableStock: 0,
          canOrder: false,
        });

      renderComponent();
      await screen.findByRole('heading', { name: mockProduct.name });
      await screen.findByText('Còn tối đa 10 ly');

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '8' } });
      expect(input).toHaveValue(8);

      // Đổi sang Size L (stock = 0)
      await userEvent.click(screen.getByRole('button', { name: /Size L/ }));

      await screen.findByText('Món hiện không đủ nguyên liệu');
      // Invariant: quantity không bằng 0
      expect(input).not.toHaveValue(0);
      expect(Number(input.getAttribute('value'))).toBeGreaterThanOrEqual(1);

      const addBtn = screen.getByRole('button', { name: 'Thêm vào giỏ hàng' });
      expect(addBtn).toBeDisabled();

      // Click nút khi disabled
      fireEvent.click(addBtn);
      const cartJson = JSON.parse(screen.getByTestId('cart-probe').textContent!);
      expect(cartJson).toHaveLength(0);

      // Không hiển thị notice điều chỉnh khi stock = 0
      expect(
        screen.queryByText('Số lượng đã được điều chỉnh theo nguyên liệu hiện có.'),
      ).not.toBeInTheDocument();
    });

    it('E.4 Availability API lỗi sau khi chọn SIZE: dù legacy stock > 0 nút thêm giỏ vẫn disabled và addItem không được gọi', async () => {
      const productWithLegacyStock: ProductDetail = {
        ...mockProduct,
        inventory: { quantity: 10, reserved: 0, availableStock: 10 },
      };
      (fetchProductDetailFromApi as jest.Mock).mockResolvedValue(productWithLegacyStock);
      (checkProductAvailabilityApi as jest.Mock).mockRejectedValue(
        new ProductApiError('Lỗi máy chủ kiểm tra availability', 500),
      );

      renderComponent();
      await screen.findByRole('heading', { name: productWithLegacyStock.name });

      // Hiển thị thông báo lỗi availability, KHÔNG dùng legacy inventory để hiển thị còn hàng
      expect(
        await screen.findByText('Không thể kiểm tra nguyên liệu. Vui lòng thử lại.'),
      ).toBeInTheDocument();
      expect(screen.queryByText(/Còn 10 ly có thể đặt/)).not.toBeInTheDocument();

      const addBtn = screen.getByRole('button', { name: 'Thêm vào giỏ hàng' });
      expect(addBtn).toBeDisabled();

      // Cố tình kích hoạt click
      fireEvent.click(addBtn);
      const cartJson = JSON.parse(screen.getByTestId('cart-probe').textContent!);
      expect(cartJson).toHaveLength(0);
    });

    it('E.5 Availability đang loading: dù legacy stock > 0 không được thêm vào giỏ', async () => {
      const productWithLegacyStock: ProductDetail = {
        ...mockProduct,
        inventory: { quantity: 10, reserved: 0, availableStock: 10 },
      };
      (fetchProductDetailFromApi as jest.Mock).mockResolvedValue(productWithLegacyStock);
      let resolveApi: (val: any) => void;
      (checkProductAvailabilityApi as jest.Mock).mockReturnValue(
        new Promise((res) => {
          resolveApi = res;
        }),
      );

      renderComponent();
      await screen.findByRole('heading', { name: productWithLegacyStock.name });

      expect(screen.getByText('Đang kiểm tra nguyên liệu...')).toBeInTheDocument();
      const addBtn = screen.getByRole('button', { name: 'Thêm vào giỏ hàng' });
      expect(addBtn).toBeDisabled();

      // Cố tình click khi đang loading
      fireEvent.click(addBtn);
      const cartJson = JSON.parse(screen.getByTestId('cart-probe').textContent!);
      expect(cartJson).toHaveLength(0);

      // Giải phóng API
      resolveApi!({
        productId: mockProduct.id,
        availableStock: 5,
        canOrder: true,
      });
      expect(await screen.findByText('Còn tối đa 5 ly')).toBeInTheDocument();
      expect(addBtn).toBeEnabled();
    });

    it('E.6 Retry thành công: availability mới trở thành nguồn quyết định và cho phép thêm vào giỏ', async () => {
      (checkProductAvailabilityApi as jest.Mock)
        .mockRejectedValueOnce(new ProductApiError('Lỗi kết nối', 500))
        .mockResolvedValueOnce({
          productId: mockProduct.id,
          availableStock: 7,
          canOrder: true,
        });

      renderComponent();
      await screen.findByRole('heading', { name: mockProduct.name });

      const retryBtn = await screen.findByRole('button', { name: 'Thử lại' });
      expect(screen.getByRole('button', { name: 'Thêm vào giỏ hàng' })).toBeDisabled();

      await userEvent.click(retryBtn);

      expect(await screen.findByText('Còn tối đa 7 ly')).toBeInTheDocument();
      const addBtn = screen.getByRole('button', { name: 'Thêm vào giỏ hàng' });
      expect(addBtn).toBeEnabled();

      await userEvent.click(addBtn);
      const cartJson = JSON.parse(screen.getByTestId('cart-probe').textContent!);
      expect(cartJson).toHaveLength(1);
      expect(cartJson[0]).toMatchObject({
        productId: mockProduct.id,
        quantity: 1,
      });
    });

    it('E.7 Input quantity: rỗng, NaN, 0, âm, vượt availableStock đều giữ invariant quantity >= 1', async () => {
      (checkProductAvailabilityApi as jest.Mock).mockResolvedValue({
        productId: mockProduct.id,
        availableStock: 6,
        canOrder: true,
      });

      renderComponent();
      await screen.findByRole('heading', { name: mockProduct.name });
      await screen.findByText('Còn tối đa 6 ly');

      const input = screen.getByRole('spinbutton');

      // 1. Nhập rỗng -> fallback về 1
      fireEvent.change(input, { target: { value: '' } });
      expect(input).toHaveValue(1);

      // 2. Nhập số 0 -> fallback về 1
      fireEvent.change(input, { target: { value: '0' } });
      expect(input).toHaveValue(1);

      // 3. Nhập số âm -> fallback về 1
      fireEvent.change(input, { target: { value: '-5' } });
      expect(input).toHaveValue(1);

      // 4. Nhập chữ cái (NaN) -> fallback về 1
      fireEvent.change(input, { target: { value: 'abc' } });
      expect(input).toHaveValue(1);

      // 5. Nhập vượt quá availableStock (6) -> clamp về 6
      fireEvent.change(input, { target: { value: '20' } });
      expect(input).toHaveValue(6);

      // Luôn là số nguyên >= 1
      expect(Number(input.getAttribute('value'))).toBeGreaterThanOrEqual(1);
    });

    it('E.8 Double-click hoặc gọi handler khi disabled không tạo CartItem sai', async () => {
      (checkProductAvailabilityApi as jest.Mock).mockResolvedValue({
        productId: mockProduct.id,
        availableStock: 0,
        canOrder: false,
      });

      renderComponent();
      await screen.findByRole('heading', { name: mockProduct.name });
      await screen.findByText('Món hiện không đủ nguyên liệu');

      const addBtn = screen.getByRole('button', { name: 'Thêm vào giỏ hàng' });
      expect(addBtn).toBeDisabled();

      // Double click nhanh vào button disabled
      fireEvent.click(addBtn);
      fireEvent.click(addBtn);

      const cartJson = JSON.parse(screen.getByTestId('cart-probe').textContent!);
      expect(cartJson).toHaveLength(0);
    });
  });

  describe('ĐỢT 4.2: REMOVE FINAL LEGACY INVENTORY GATE', () => {
    it('B.1 Legacy báo hết nhưng công thức còn: UI hiển thị còn tối đa 12 ly, enable nút thêm và nhận đúng item trong cart', async () => {
      const productLegacyOutOfStock: ProductDetail = {
        ...mockProduct,
        isAvailable: true,
        canOrder: false, // Legacy inventory marks as out of stock
        inventory: { quantity: 0, reserved: 0, availableStock: 0 },
      };
      (fetchProductDetailFromApi as jest.Mock).mockResolvedValue(productLegacyOutOfStock);
      (checkProductAvailabilityApi as jest.Mock).mockResolvedValue({
        productId: mockProduct.id,
        availableStock: 12,
        canOrder: true,
      });

      renderComponent();
      await screen.findByRole('heading', { name: mockProduct.name });

      // UI hiển thị số ly theo công thức nguyên liệu, không bị chặn bởi legacy canOrder
      expect(await screen.findByText('Còn tối đa 12 ly')).toBeInTheDocument();

      const addBtn = screen.getByRole('button', { name: 'Thêm vào giỏ hàng' });
      expect(addBtn).toBeEnabled();

      // Thêm quantity hợp lệ
      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '2' } });
      expect(input).toHaveValue(2);

      await userEvent.click(addBtn);

      const cartJson = JSON.parse(screen.getByTestId('cart-probe').textContent!);
      expect(cartJson).toHaveLength(1);
      expect(cartJson[0]).toMatchObject({
        productId: mockProduct.id,
        name: mockProduct.name,
        quantity: 2,
        customization: {
          size: 'size-m-id',
          toppingIds: [],
        },
      });
    });

    it('B.2 Legacy báo còn nhưng công thức hết: không được thêm vào giỏ', async () => {
      const productLegacyInStock: ProductDetail = {
        ...mockProduct,
        isAvailable: true,
        canOrder: true,
        inventory: { quantity: 100, reserved: 0, availableStock: 100 }, // Legacy claims 100
      };
      (fetchProductDetailFromApi as jest.Mock).mockResolvedValue(productLegacyInStock);
      (checkProductAvailabilityApi as jest.Mock).mockResolvedValue({
        productId: mockProduct.id,
        availableStock: 0, // Recipe availability reveals 0
        canOrder: false,
      });

      renderComponent();
      await screen.findByRole('heading', { name: mockProduct.name });

      expect(await screen.findByText('Món hiện không đủ nguyên liệu')).toBeInTheDocument();

      const addBtn = screen.getByRole('button', { name: 'Thêm vào giỏ hàng' });
      expect(addBtn).toBeDisabled();

      fireEvent.click(addBtn);
      const cartJson = JSON.parse(screen.getByTestId('cart-probe').textContent!);
      expect(cartJson).toHaveLength(0);
    });

    it('B.3 Product bị khóa kinh doanh: product.isAvailable = false vẫn là công tắc kinh doanh hợp lệ chặn đặt món', async () => {
      const productBusinessDisabled: ProductDetail = {
        ...mockProduct,
        isAvailable: false, // Business toggle OFF
        canOrder: true,
        inventory: { quantity: 50, reserved: 0, availableStock: 50 },
      };
      (fetchProductDetailFromApi as jest.Mock).mockResolvedValue(productBusinessDisabled);
      (checkProductAvailabilityApi as jest.Mock).mockResolvedValue({
        productId: mockProduct.id,
        availableStock: 20,
        canOrder: true,
      });

      renderComponent();
      await screen.findByRole('heading', { name: mockProduct.name });

      expect(screen.getByText('Món hiện không thể đặt.')).toBeInTheDocument();

      const addBtn = screen.getByRole('button', { name: 'Thêm vào giỏ hàng' });
      expect(addBtn).toBeDisabled();

      fireEvent.click(addBtn);
      const cartJson = JSON.parse(screen.getByTestId('cart-probe').textContent!);
      expect(cartJson).toHaveLength(0);
    });

    it('B.4 Availability lỗi: dù legacy stock và product.canOrder đều báo còn, vẫn không được thêm vào giỏ', async () => {
      const productLegacyAvailable: ProductDetail = {
        ...mockProduct,
        isAvailable: true,
        canOrder: true,
        inventory: { quantity: 50, reserved: 0, availableStock: 50 },
      };
      (fetchProductDetailFromApi as jest.Mock).mockResolvedValue(productLegacyAvailable);
      (checkProductAvailabilityApi as jest.Mock).mockRejectedValue(
        new ProductApiError('Lỗi server', 500),
      );

      renderComponent();
      await screen.findByRole('heading', { name: mockProduct.name });

      expect(
        await screen.findByText('Không thể kiểm tra nguyên liệu. Vui lòng thử lại.'),
      ).toBeInTheDocument();

      const addBtn = screen.getByRole('button', { name: 'Thêm vào giỏ hàng' });
      expect(addBtn).toBeDisabled();

      fireEvent.click(addBtn);
      const cartJson = JSON.parse(screen.getByTestId('cart-probe').textContent!);
      expect(cartJson).toHaveLength(0);
    });

    it('B.5 Availability loading: dù legacy stock và product.canOrder đều báo còn, vẫn không được thêm vào giỏ', async () => {
      const productLegacyAvailable: ProductDetail = {
        ...mockProduct,
        isAvailable: true,
        canOrder: true,
        inventory: { quantity: 50, reserved: 0, availableStock: 50 },
      };
      (fetchProductDetailFromApi as jest.Mock).mockResolvedValue(productLegacyAvailable);
      (checkProductAvailabilityApi as jest.Mock).mockReturnValue(
        new Promise(() => {}), // keeps loading
      );

      renderComponent();
      await screen.findByRole('heading', { name: productLegacyAvailable.name });

      expect(screen.getByText('Đang kiểm tra nguyên liệu...')).toBeInTheDocument();

      const addBtn = screen.getByRole('button', { name: 'Thêm vào giỏ hàng' });
      expect(addBtn).toBeDisabled();

      fireEvent.click(addBtn);
      const cartJson = JSON.parse(screen.getByTestId('cart-probe').textContent!);
      expect(cartJson).toHaveLength(0);
    });

    it('B.6 Chưa chọn SIZE: không dùng availability và không được thêm vào giỏ', async () => {
      const productWithoutPreselectedSize: ProductDetail = {
        ...mockProduct,
        options: [
          { id: 'top-1', type: 'TOPPING', name: 'Trân châu', extraPrice: 5000 },
        ],
      };
      (fetchProductDetailFromApi as jest.Mock).mockResolvedValue(productWithoutPreselectedSize);

      renderComponent();
      await screen.findByRole('heading', { name: mockProduct.name });

      expect(checkProductAvailabilityApi).not.toHaveBeenCalled();
      expect(
        screen.getByText('Chọn kích cỡ để xem số lượng có thể đặt'),
      ).toBeInTheDocument();

      const addBtn = screen.getByRole('button', { name: 'Thêm vào giỏ hàng' });
      expect(addBtn).toBeDisabled();

      fireEvent.click(addBtn);
      const cartJson = JSON.parse(screen.getByTestId('cart-probe').textContent!);
      expect(cartJson).toHaveLength(0);
    });

    it('B.7 Kiểm tra handler guard: gọi handler trực tiếp không tạo CartItem khi canAddToCart = false', async () => {
      (checkProductAvailabilityApi as jest.Mock).mockResolvedValue({
        productId: mockProduct.id,
        availableStock: 0,
        canOrder: false,
      });

      renderComponent();
      await screen.findByRole('heading', { name: mockProduct.name });

      const addBtn = screen.getByRole('button', { name: 'Thêm vào giỏ hàng' });
      const buyBtn = screen.getByRole('button', { name: 'Mua ngay' });
      expect(addBtn).toBeDisabled();
      expect(buyBtn).toBeDisabled();

      // Kích hoạt handler trực tiếp
      fireEvent.click(addBtn);
      fireEvent.click(buyBtn);

      const cartJson = JSON.parse(screen.getByTestId('cart-probe').textContent!);
      expect(cartJson).toHaveLength(0);
    });
  });

  describe('ĐỢT 4.3: AVAILABILITY BADGE STATE CORRECTION', () => {
    it('1. Chưa chọn SIZE: badge hiển thị trạng thái trung lập "Chọn kích cỡ", không hiển thị "Còn món"', async () => {
      const productNoSize: ProductDetail = {
        ...mockProduct,
        options: [
          { id: 'top-1', type: 'TOPPING', name: 'Trân châu', extraPrice: 5000 },
        ],
      };
      (fetchProductDetailFromApi as jest.Mock).mockResolvedValue(productNoSize);

      renderComponent();
      await screen.findByRole('heading', { name: productNoSize.name });

      expect(screen.getByText('Chọn kích cỡ')).toBeInTheDocument();
      expect(screen.queryByText('Còn món')).not.toBeInTheDocument();
    });

    it('2. Đang loading: badge hiển thị "Đang kiểm tra", không hiển thị "Còn món" hoặc "Tạm hết món"', async () => {
      (checkProductAvailabilityApi as jest.Mock).mockReturnValue(
        new Promise(() => {}), // keeps loading
      );

      renderComponent();
      await screen.findByRole('heading', { name: mockProduct.name });

      expect(screen.getByText('Đang kiểm tra')).toBeInTheDocument();
      expect(screen.queryByText('Còn món')).not.toBeInTheDocument();
      expect(screen.queryByText('Tạm hết món')).not.toBeInTheDocument();
    });

    it('3. API error: badge hiển thị "Chưa xác định", không hiển thị "Còn món", add to cart disabled', async () => {
      (checkProductAvailabilityApi as jest.Mock).mockRejectedValue(
        new ProductApiError('Lỗi server', 500),
      );

      renderComponent();
      await screen.findByRole('heading', { name: mockProduct.name });

      expect(await screen.findByText('Chưa xác định')).toBeInTheDocument();
      expect(screen.queryByText('Còn món')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Thêm vào giỏ hàng' })).toBeDisabled();
    });

    it('4. Recipe còn hàng: badge hiển thị "Còn món"', async () => {
      (checkProductAvailabilityApi as jest.Mock).mockResolvedValue({
        productId: mockProduct.id,
        availableStock: 25,
        canOrder: true,
      });

      renderComponent();
      await screen.findByRole('heading', { name: mockProduct.name });

      expect(await screen.findByText('Còn món')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Thêm vào giỏ hàng' })).toBeEnabled();
    });

    it('5. Recipe hết hàng: badge hiển thị "Tạm hết món"', async () => {
      (checkProductAvailabilityApi as jest.Mock).mockResolvedValue({
        productId: mockProduct.id,
        availableStock: 0,
        canOrder: false,
      });

      renderComponent();
      await screen.findByRole('heading', { name: mockProduct.name });

      expect(await screen.findByText('Tạm hết món')).toBeInTheDocument();
      expect(screen.queryByText('Còn món')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Thêm vào giỏ hàng' })).toBeDisabled();
    });

    it('6. product.isAvailable = false nhưng recipe còn: badge hiển thị "Tạm ngừng bán", add to cart disabled', async () => {
      const disabledProduct: ProductDetail = {
        ...mockProduct,
        isAvailable: false,
      };
      (fetchProductDetailFromApi as jest.Mock).mockResolvedValue(disabledProduct);
      (checkProductAvailabilityApi as jest.Mock).mockResolvedValue({
        productId: mockProduct.id,
        availableStock: 30,
        canOrder: true,
      });

      renderComponent();
      await screen.findByRole('heading', { name: disabledProduct.name });

      expect(await screen.findByText('Tạm ngừng bán')).toBeInTheDocument();
      expect(screen.queryByText('Còn món')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Thêm vào giỏ hàng' })).toBeDisabled();
    });

    it('7. Legacy inventory = 0 nhưng recipe còn: sau khi API thành công vẫn hiển thị "Còn món"', async () => {
      const legacyZeroProduct: ProductDetail = {
        ...mockProduct,
        inventory: { quantity: 0, reserved: 0, availableStock: 0 },
        canOrder: false,
      };
      (fetchProductDetailFromApi as jest.Mock).mockResolvedValue(legacyZeroProduct);
      (checkProductAvailabilityApi as jest.Mock).mockResolvedValue({
        productId: mockProduct.id,
        availableStock: 15,
        canOrder: true,
      });

      renderComponent();
      await screen.findByRole('heading', { name: legacyZeroProduct.name });

      expect(await screen.findByText('Còn món')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Thêm vào giỏ hàng' })).toBeEnabled();
    });

    it('8. Legacy inventory > 0 nhưng recipe hết: hiển thị "Tạm hết món"', async () => {
      const legacyHighProduct: ProductDetail = {
        ...mockProduct,
        inventory: { quantity: 999, reserved: 0, availableStock: 999 },
        canOrder: true,
      };
      (fetchProductDetailFromApi as jest.Mock).mockResolvedValue(legacyHighProduct);
      (checkProductAvailabilityApi as jest.Mock).mockResolvedValue({
        productId: mockProduct.id,
        availableStock: 0,
        canOrder: false,
      });

      renderComponent();
      await screen.findByRole('heading', { name: legacyHighProduct.name });

      expect(await screen.findByText('Tạm hết món')).toBeInTheDocument();
      expect(screen.queryByText('Còn món')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Thêm vào giỏ hàng' })).toBeDisabled();
    });

    it('9. computeProductBadge pure function unit tests', () => {
      // 1. isAvailable = false
      expect(computeProductBadge({
        isAvailable: false,
        isSizeSelected: true,
        isLoading: false,
        error: null,
        availability: { productId: '1', availableStock: 10, canOrder: true },
      })).toBe('Tạm ngừng bán');

      // 2. isSizeSelected = false
      expect(computeProductBadge({
        isAvailable: true,
        isSizeSelected: false,
        isLoading: false,
        error: null,
        availability: null,
      })).toBe('Chọn kích cỡ');

      // 3. isLoading = true
      expect(computeProductBadge({
        isAvailable: true,
        isSizeSelected: true,
        isLoading: true,
        error: null,
        availability: null,
      })).toBe('Đang kiểm tra');

      // 4. error !== null
      expect(computeProductBadge({
        isAvailable: true,
        isSizeSelected: true,
        isLoading: false,
        error: new Error('Network error'),
        availability: null,
      })).toBe('Chưa xác định');

      // 5. availability canOrder & stock > 0
      expect(computeProductBadge({
        isAvailable: true,
        isSizeSelected: true,
        isLoading: false,
        error: null,
        availability: { productId: '1', availableStock: 5, canOrder: true },
      })).toBe('Còn món');

      // 6. availability stock = 0
      expect(computeProductBadge({
        isAvailable: true,
        isSizeSelected: true,
        isLoading: false,
        error: null,
        availability: { productId: '1', availableStock: 0, canOrder: true },
      })).toBe('Tạm hết món');

      // 7. availability canOrder = false
      expect(computeProductBadge({
        isAvailable: true,
        isSizeSelected: true,
        isLoading: false,
        error: null,
        availability: { productId: '1', availableStock: 5, canOrder: false },
      })).toBe('Tạm hết món');
    });
  });
});
