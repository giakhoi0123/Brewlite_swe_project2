import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CartProvider } from '../../cart/CartProvider';
import { FavoritesProvider } from '../../favorites/FavoritesProvider';
import { ToastProvider } from '../../ui/ToastProvider';
import { MenuView } from '../MenuView';
import { MOCK_PRODUCTS } from '../../../data/menu-products';
import { CartProbe } from '../../../test-utils/CartProbe';

function renderMenu(initialSearch = '') {
  return render(
    <ToastProvider>
      <CartProvider>
        <FavoritesProvider>
          <MenuView products={MOCK_PRODUCTS} initialSearch={initialSearch} />
          <CartProbe />
        </FavoritesProvider>
      </CartProvider>
    </ToastProvider>,
  );
}

describe('MenuView', () => {
  beforeEach(() => window.localStorage.clear());

  it('hiển thị đủ 30 món', () => {
    renderMenu();
    expect(screen.getByTestId('count-badge')).toHaveTextContent('30 món');
    expect(within(screen.getByTestId('menu-grid')).getAllByRole('article')).toHaveLength(30);
  });

  it('lọc theo danh mục Cold Brew', async () => {
    renderMenu();
    await userEvent.click(screen.getByRole('tab', { name: /Cold Brew/ }));
    expect(screen.getByTestId('count-badge')).toHaveTextContent('3 món');
  });

  it('hiện trạng thái rỗng và nút xem lại tất cả', async () => {
    renderMenu('khong-ton-tai-xyz');
    expect(screen.getByTestId('menu-empty')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Xem tất cả 30 món' }));
    expect(screen.getByTestId('count-badge')).toHaveTextContent('30 món');
  });

  it('thêm nhanh vào giỏ', async () => {
    renderMenu();
    await userEvent.click(screen.getByRole('button', { name: 'Thêm Bạc Xỉu 3 Tầng Sài Gòn vào giỏ' }));
    expect(screen.getByTestId('cart-probe')).toHaveTextContent('1 ly · 29.000');
  });

  it('modal tùy chỉnh tính giá theo size, topping và số lượng', async () => {
    renderMenu();
    const card = screen.getByTestId('menu-card-PROD_01');
    await userEvent.click(within(card).getByRole('button', { name: /Tùy chỉnh/ }));

    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /Size L/ }));
    await userEvent.click(within(dialog).getByLabelText(/Trân châu đen dẻo/));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Tăng số lượng' }));

    // (29.000 + 6.000 + 5.000) x 2 = 80.000
    expect(within(dialog).getByTestId('modal-total')).toHaveTextContent('80.000');

    await userEvent.click(within(dialog).getByRole('button', { name: /Xác nhận thêm món/ }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('cart-probe')).toHaveTextContent('2 ly · 80.000');
  });

  it('giới hạn tối đa 3 topping', async () => {
    renderMenu();
    await userEvent.click(within(screen.getByTestId('menu-card-PROD_02')).getByRole('button', { name: /Tùy chỉnh/ }));
    const dialog = screen.getByRole('dialog');
    const checkboxes = within(dialog).getAllByRole('checkbox');
    for (const cb of checkboxes.slice(0, 4)) {
      await userEvent.click(cb);
    }
    expect(checkboxes.filter((cb) => (cb as HTMLInputElement).checked)).toHaveLength(3);
  });

  it('tên món dẫn tới trang chi tiết', () => {
    renderMenu();
    const card = screen.getByTestId('menu-card-PROD_01');
    expect(within(card).getByRole('link', { name: 'Bạc Xỉu 3 Tầng Sài Gòn' })).toHaveAttribute(
      'href',
      '/products/bac-xiu-3-tang-sai-gon',
    );
  });

  it('món hết hàng bị khóa nút thêm', () => {
    renderMenu();
    const soldOut = MOCK_PRODUCTS.find((p) => !p.isAvailable)!;
    const card = screen.getByTestId(`menu-card-${soldOut.id}`);
    expect(within(card).getByRole('button', { name: `Thêm ${soldOut.name} vào giỏ` })).toBeDisabled();
  });
});
