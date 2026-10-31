import type { Metadata } from 'next';
import { CartView } from '../../components/cart/CartView';

export const metadata: Metadata = {
  title: 'Giỏ hàng — BrewLite',
  description: 'Xem lại đồ uống, chỉnh size, số lượng và áp dụng mã ưu đãi trước khi đặt hàng.',
};

export default function CartPage() {
  return <CartView />;
}
