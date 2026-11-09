import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MenuPage from '../../app/products/page';
import ProductPage from '../../app/products/[slug]/page';
import { CartProvider, useCart } from '../cart/CartProvider';
import { CartView } from '../cart/CartView';
import { FavoritesProvider } from '../favorites/FavoritesProvider';
import { ToastProvider } from '../ui/ToastProvider';
import { fetchProductsFromApi, fetchProductDetailFromApi, checkCartAvailability, ProductApiError } from '../../services/product-api';
import { ProductDetail } from '../../types/product';

jest.mock('../../services/product-api', () => ({
  ...jest.requireActual('../../services/product-api'),
  fetchProductsFromApi: jest.fn(),
  fetchProductDetailFromApi: jest.fn(),
  checkCartAvailability: jest.fn(),
}));
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));

const product: ProductDetail = {
  id: 'a0000000-0000-4000-8000-000000000001', name: 'Cà phê từ API',
  basePrice: 25000, imageUrl: '/coffee.jpg', isAvailable: true, canOrder: true,
  inventory: { quantity: 5, reserved: 2, availableStock: 3 },
  options: [
    { id: 'size-m-uuid', type: 'SIZE', name: 'Vừa', extraPrice: 2000 },
    { id: 'size-l-uuid', type: 'SIZE', name: 'Lớn', extraPrice: 9000 },
    { id: 'topping-uuid', type: 'TOPPING', name: 'Topping từ API', extraPrice: 7000 },
  ],
};

function mockAvailability(availableQuantity = 3, canOrder = true) {
  return async (items: any[]) => ({
    canOrder,
    items: items.map((it: any, idx: number) => ({
      index: idx,
      productId: it.productId,
      sizeId: it.sizeId ?? it.customization?.size,
      requestedQuantity: it.quantity,
      availableQuantity,
      canOrder,
    })),
  });
}

function CartProbe() {
  const { items } = useCart();
  return <output data-testid="live-cart">{JSON.stringify(items)}</output>;
}
function setup(ui: React.ReactNode) {
  return render(<ToastProvider><CartProvider><FavoritesProvider>{ui}<CartProbe /></FavoritesProvider></CartProvider></ToastProvider>);
}
beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  (checkCartAvailability as jest.Mock).mockImplementation(mockAvailability(3, true));
});

it('trang thực đơn dùng dữ liệu API và link UUID, tìm không dấu và không hiển thị đánh giá mẫu', async () => {
  (fetchProductsFromApi as jest.Mock).mockResolvedValue([product]);
  setup(<MenuPage searchParams={{}} />);
  expect(await screen.findByRole('heading', { name: product.name })).toBeInTheDocument();
  expect(screen.queryByText(/★/)).not.toBeInTheDocument();
  await userEvent.type(screen.getByRole('searchbox'), 'ca phe');
  expect(await screen.findByRole('heading', { name: product.name })).toBeInTheDocument();
});

it('trang chi tiết tính đúng giá theo size/topping và thêm vào giỏ', async () => {
  (fetchProductDetailFromApi as jest.Mock).mockResolvedValue(product);
  const view = setup(<ProductPage params={{ slug: product.id }} />);
  await screen.findByRole('heading', { name: product.name });
  expect(fetchProductDetailFromApi).toHaveBeenCalledWith(product.id, expect.any(AbortSignal));
  expect(screen.getByTestId('api-detail-total')).toHaveTextContent('27.000');
  await userEvent.click(screen.getByRole('button', { name: /Lớn/ }));
  await userEvent.click(screen.getByRole('checkbox', { name: /Topping từ API/ }));
  expect(screen.getByTestId('api-detail-total')).toHaveTextContent('41.000');
  await userEvent.clear(screen.getByRole('spinbutton'));
  await userEvent.type(screen.getByRole('spinbutton'), '9');
  expect(screen.getByRole('spinbutton')).toHaveValue(3);
  await userEvent.click(screen.getByRole('button', { name: 'Thêm vào giỏ hàng' }));
  await waitFor(() => expect(JSON.parse(screen.getByTestId('live-cart').textContent!)[0]).toMatchObject({
    productId: product.id, unitPrice: 41000, quantity: 3,
    customization: { size: 'size-l-uuid', toppingIds: ['topping-uuid'] },
  }));
  view.unmount();
  setup(<CartView />);
  expect(await screen.findByRole('combobox', { name: `Chọn size cho ${product.name}` })).toHaveValue('size-l-uuid');
  await userEvent.selectOptions(screen.getByRole('combobox', { name: `Chọn size cho ${product.name}` }), 'size-m-uuid');
  expect(JSON.parse(screen.getByTestId('live-cart').textContent!)[0].unitPrice).toBe(34000);
});

it('chi tiết hết tồn kho vô hiệu hóa đặt món', async () => {
  (fetchProductDetailFromApi as jest.Mock).mockResolvedValue({ ...product, inventory: null, canOrder: false });
  (checkCartAvailability as jest.Mock).mockImplementation(mockAvailability(0, false));
  setup(<ProductPage params={{ slug: product.id }} />);
  expect(await screen.findByRole('button', { name: 'Thêm vào giỏ hàng' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Mua ngay' })).toBeDisabled();
});

it('chi tiết không tồn tại hiển thị lỗi và có thể tải lại', async () => {
  (fetchProductDetailFromApi as jest.Mock).mockRejectedValueOnce(new ProductApiError('Không có sản phẩm', 404)).mockResolvedValueOnce(product);
  setup(<ProductPage params={{ slug: product.id }} />);
  expect(await screen.findByRole('heading', { name: 'Không tìm thấy món' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  expect(await screen.findByRole('heading', { name: product.name })).toBeInTheDocument();
});
