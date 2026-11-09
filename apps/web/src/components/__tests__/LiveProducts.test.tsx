import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MenuPage from '../../app/products/page';
import ProductPage from '../../app/products/[slug]/page';
import { CartProvider, useCart } from '../cart/CartProvider';
import { CartView } from '../cart/CartView';
import { FavoritesProvider } from '../favorites/FavoritesProvider';
import { ToastProvider } from '../ui/ToastProvider';
import { checkCartAvailability, fetchProductsFromApi, fetchProductDetailFromApi, ProductApiError } from '../../services/product-api';
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
  (checkCartAvailability as jest.Mock).mockImplementation(async (items: unknown[]) => ({
    canOrder: true,
    items: items.map((_, index) => ({
      index,
      availableQuantity: 3,
      canOrder: true,
    })),
  }));
});

it('trang thực đơn dùng dữ liệu API và link UUID, tìm không dấu và không hiển thị đánh giá mẫu', async () => {
  (fetchProductsFromApi as jest.Mock).mockResolvedValue([product]);
  setup(<MenuPage searchParams={{}} />);
  expect(screen.getByText('Đang tải thực đơn...')).toBeInTheDocument();
  expect(await screen.findByRole('link', { name: 'Chọn món' })).toHaveAttribute('href', `/products/${product.id}`);
  expect(screen.queryByText('1,500+ Review')).not.toBeInTheDocument();
  await userEvent.type(screen.getByRole('searchbox'), 'ca phe');
  expect(screen.getByText(product.name)).toBeInTheDocument();
  await userEvent.clear(screen.getByRole('searchbox'));
  await userEvent.type(screen.getByRole('searchbox'), 'khong co');
  expect(screen.getByText('Không tìm thấy món phù hợp.')).toBeInTheDocument();
});

it('lỗi API có retry và không thay bằng sản phẩm mẫu; hỗ trợ thực đơn trống', async () => {
  (fetchProductsFromApi as jest.Mock).mockRejectedValueOnce(new Error('API chưa sẵn sàng')).mockResolvedValueOnce([]);
  setup(<MenuPage searchParams={{}} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('API chưa sẵn sàng');
  expect(screen.queryByText('Bạc Xỉu 3 Tầng Sài Gòn')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  expect(await screen.findByText('Thực đơn hiện chưa có sản phẩm.')).toBeInTheDocument();
});

it('món bị backend đánh dấu không thể đặt hiển thị tạm hết', async () => {
  (fetchProductsFromApi as jest.Mock).mockResolvedValue([{ ...product, canOrder: false }]);
  setup(<MenuPage searchParams={{}} />);
  expect(await screen.findByText('Tạm hết món')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Chọn món' })).not.toBeInTheDocument();
});

it('chi tiết, phụ thu, UUID và đổi size trong giỏ đều dùng dữ liệu backend', async () => {
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
  const addButton = screen.getByRole('button', { name: 'Thêm vào giỏ hàng' });
  await waitFor(() => expect(addButton).toBeEnabled());
  await userEvent.click(addButton);
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
  (checkCartAvailability as jest.Mock).mockResolvedValue({
    canOrder: false,
    items: [{ index: 0, availableQuantity: 0, canOrder: false }],
  });
  (fetchProductDetailFromApi as jest.Mock).mockResolvedValue({ ...product, inventory: null, canOrder: false });
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
