import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEFAULT_CUSTOMIZATION } from '../../../data/menu-options';
import { addCartItem } from '../../../lib/cart';
import { checkCartAvailability } from '../../../services/product-api';
import { ToastProvider } from '../../ui/ToastProvider';
import { CartProvider } from '../CartProvider';
import { CartView } from '../CartView';

const push = jest.fn();
const mockFetch = jest.fn();
const checkAvailability = checkCartAvailability as jest.Mock;

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));
jest.mock('../../../services/product-api', () => ({
  checkCartAvailability: jest.fn(),
}));

function seedCart() {
  let items = addCartItem([], {
    productId: 'PROD_03',
    name: 'Cà Phê Sữa Đá Sài Gòn',
    imageUrl: 'a.jpg',
    basePrice: 25000,
    customization: { ...DEFAULT_CUSTOMIZATION, toppingIds: ['shot-espresso'], note: 'Ít đá' },
    quantity: 2,
  });
  items = addCartItem(items, {
    productId: 'PROD_01',
    name: 'Bạc Xỉu 3 Tầng Sài Gòn',
    imageUrl: 'b.jpg',
    basePrice: 29000,
    customization: DEFAULT_CUSTOMIZATION,
    quantity: 1,
  });
  window.localStorage.setItem('brewlite-cart', JSON.stringify({ items, voucherCode: null }));
}

function renderCart() {
  return render(
    <ToastProvider>
      <CartProvider>
        <CartView />
      </CartProvider>
    </ToastProvider>,
  );
}

describe('CartView', () => {
  beforeEach(() => {
    window.localStorage.clear();
    push.mockClear();
    checkAvailability.mockReset();
    checkAvailability.mockImplementation(async (items: unknown[]) => ({
      canOrder: true,
      items: items.map((_, index) => ({
        index,
        availableQuantity: 99,
        canOrder: true,
      })),
    }));
    mockFetch.mockReset();
    mockFetch.mockImplementation(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const code = JSON.parse(String(init?.body)).code;
      const valid = code === 'COFFEE10';
      return {
        ok: valid,
        status: valid ? 200 : 400,
        json: async () =>
          valid
            ? { code: 'COFFEE10', discountAmount: 10000 }
            : { message: 'Mã giảm giá không hợp lệ hoặc đã hết hạn.' },
      } as Response;
    });
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  it('hiển thị trạng thái trống khi chưa có món', async () => {
    renderCart();
    expect(await screen.findByTestId('cart-empty')).toBeInTheDocument();
  });

  it('hiển thị món, tùy chọn và tổng tiền đúng', async () => {
    seedCart();
    renderCart();
    const line = await screen.findByTestId('cart-line-PROD_03');
    expect(within(line).getByText(/Thêm 1 shot Espresso Robusta/)).toBeInTheDocument();
    expect(within(line).getByText(/Ghi chú: Ít đá/)).toBeInTheDocument();
    // (25.000 + 10.000) x 2 + 29.000 = 99.000 -> chưa đủ freeship
    expect(screen.getByTestId('cart-count-badge')).toHaveTextContent('3 sản phẩm');
    expect(screen.getByTestId('summary-subtotal')).toHaveTextContent('99.000');
    expect(screen.getByTestId('summary-shipping')).toHaveTextContent('15.000');
    expect(screen.getByTestId('summary-total')).toHaveTextContent('114.000');
  });

  it('tăng số lượng cập nhật thành tiền và được freeship', async () => {
    seedCart();
    renderCart();
    await userEvent.click(await screen.findByRole('button', { name: 'Tăng số lượng Bạc Xỉu 3 Tầng Sài Gòn' }));
    expect(within(screen.getByTestId('cart-line-PROD_01')).getByTestId('line-subtotal')).toHaveTextContent('58.000');
    expect(screen.getByTestId('summary-shipping')).toHaveTextContent('Miễn phí');
    expect(screen.getByTestId('summary-total')).toHaveTextContent('128.000');
  });

  it('đổi size tính lại đơn giá', async () => {
    seedCart();
    renderCart();
    await userEvent.selectOptions(await screen.findByLabelText('Chọn size cho Bạc Xỉu 3 Tầng Sài Gòn'), 'L');
    expect(within(screen.getByTestId('cart-line-PROD_01')).getByTestId('line-subtotal')).toHaveTextContent('35.000');
  });

  it('giảm về 0 thì hỏi xác nhận rồi mới xóa', async () => {
    seedCart();
    renderCart();
    await userEvent.click(await screen.findByRole('button', { name: 'Giảm số lượng Bạc Xỉu 3 Tầng Sài Gòn' }));
    const dialog = screen.getByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Hủy' }));
    expect(screen.getByTestId('cart-line-PROD_01')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Xóa Bạc Xỉu 3 Tầng Sài Gòn' }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Xóa món' }));
    expect(screen.queryByTestId('cart-line-PROD_01')).not.toBeInTheDocument();
  });

  it('xóa tất cả đưa về trạng thái trống', async () => {
    seedCart();
    renderCart();
    await userEvent.click(await screen.findByRole('button', { name: 'Xóa tất cả' }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Xóa tất cả' }));
    expect(screen.getByTestId('cart-empty')).toBeInTheDocument();
  });

  it('áp dụng voucher hợp lệ và báo lỗi mã sai', async () => {
    seedCart();
    renderCart();
    const input = await screen.findByLabelText('Mã ưu đãi / Voucher');
    await userEvent.type(input, 'SAIMA');
    await userEvent.click(screen.getByRole('button', { name: 'Áp dụng' }));
    expect(screen.getByText('Mã giảm giá không hợp lệ hoặc đã hết hạn.')).toBeInTheDocument();

    await userEvent.clear(input);
    await userEvent.type(input, 'coffee10');
    await userEvent.click(screen.getByRole('button', { name: 'Áp dụng' }));
    expect(screen.getByTestId('summary-discount')).toHaveTextContent('10.000');
    // 99.000 - 10.000 + 15.000
    expect(screen.getByTestId('summary-total')).toHaveTextContent('104.000');
  });
});
