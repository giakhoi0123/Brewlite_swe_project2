import { useCart } from '../components/cart/CartProvider';
import { formatCurrency } from '../utils/format';

/** Chỉ dùng trong test: hiển thị số ly và tổng tiền hiện có trong giỏ. */
export const CartProbe: React.FC = () => {
  const { totalQuantity, totalPrice } = useCart();
  return (
    <output data-testid="cart-probe">
      {totalQuantity} ly · {formatCurrency(totalPrice)}
    </output>
  );
};
