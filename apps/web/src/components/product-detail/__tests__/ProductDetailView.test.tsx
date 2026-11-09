import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CartProvider } from '../../cart/CartProvider';
import { FavoritesProvider } from '../../favorites/FavoritesProvider';
import { ToastProvider } from '../../ui/ToastProvider';
import { ProductDetailView } from '../ProductDetailView';
import { getProductBySlug, MOCK_PRODUCTS } from '../../../data/menu-products';
import { CartProbe } from '../../../test-utils/CartProbe';
import { checkCartAvailability } from '../../../services/product-api';

const push = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));
jest.mock('../../../services/product-api', () => ({
  checkCartAvailability: jest.fn(),
}));

const checkAvailability = checkCartAvailability as jest.Mock;

function renderDetail(slug = 'ca-phe-sua-da-sai-gon') {
  const product = getProductBySlug(slug)!;
  render(
    <ToastProvider>
      <CartProvider>
        <FavoritesProvider>
          <ProductDetailView product={product} allProducts={MOCK_PRODUCTS} />
          <CartProbe />
        </FavoritesProvider>
      </CartProvider>
    </ToastProvider>,
  );
  return product;
}

describe('ProductDetailView', () => {
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
  });

  it('hiển thị tên, giá khuyến mãi và breadcrumb danh mục', () => {
    renderDetail();
    expect(screen.getByRole('heading', { level: 1, name: 'Cà Phê Sữa Đá Sài Gòn' })).toBeInTheDocument();
    expect(screen.getByText('Tiết kiệm 14%')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cà phê' })).toHaveAttribute('href', '/products?danh-muc=ca-phe');
  });

  it('đổi ảnh khi bấm thumbnail', async () => {
    renderDetail();
    const main = screen.getByTestId('gallery-main-image');
    const firstSrc = main.getAttribute('src');
    await userEvent.click(screen.getByRole('button', { name: 'Xem ảnh 2' }));
    expect(screen.getByTestId('gallery-main-image').getAttribute('src')).not.toBe(firstSrc);
  });

  it('tính tổng theo size, topping và số lượng rồi thêm vào giỏ', async () => {
    renderDetail();
    await userEvent.click(screen.getByRole('button', { name: /Size L/ }));
    await userEvent.click(screen.getByLabelText(/Thêm 1 shot Espresso Robusta/));
    await userEvent.click(screen.getByRole('button', { name: 'Tăng số lượng' }));

    // (25.000 + 6.000 + 10.000) x 2 = 82.000
    expect(screen.getByTestId('detail-total')).toHaveTextContent('82.000');

    await userEvent.click(screen.getByRole('button', { name: /THÊM VÀO GIỎ HÀNG/ }));
    expect(screen.getByTestId('cart-probe')).toHaveTextContent('2 ly · 82.000');
    expect(push).not.toHaveBeenCalled();
  });

  it('Mua ngay thêm vào giỏ và chuyển sang trang giỏ hàng', async () => {
    renderDetail();
    await userEvent.click(screen.getByRole('button', { name: /MUA NGAY/ }));
    expect(screen.getByTestId('cart-probe')).toHaveTextContent('1 ly · 25.000');
    await waitFor(() => expect(push).toHaveBeenCalledWith('/gio-hang'));
  });

  it('thêm nhanh món gợi ý', async () => {
    renderDetail();
    const related = screen.getAllByTestId(/^related-/);
    expect(related).toHaveLength(4);
    await userEvent.click(within(related[0]).getByRole('button', { name: /Thêm nhanh/ }));
    expect(screen.getByTestId('cart-probe')).toHaveTextContent('1 ly');
  });

  it('món hết hàng bị khóa nút mua', () => {
    renderDetail('cold-brew-chanh-tonic');
    expect(screen.getByRole('button', { name: /TẠM HẾT MÓN/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /MUA NGAY/ })).toBeDisabled();
  });
});
