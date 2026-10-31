import { DEFAULT_CUSTOMIZATION } from '../../data/menu-options';
import { addCartItem } from '../cart';
import { computeCartSummary, SHIPPING_FEE, validateVoucher } from '../cart-summary';

function cartWorth(price: number, quantity = 1) {
  return addCartItem([], {
    productId: 'P',
    name: 'Món',
    imageUrl: '',
    basePrice: price,
    customization: DEFAULT_CUSTOMIZATION,
    quantity,
  });
}

describe('computeCartSummary', () => {
  it('giỏ trống không tính phí giao', () => {
    expect(computeCartSummary([], null)).toMatchObject({ subtotal: 0, shipping: 0, total: 0 });
  });

  it('dưới 100k tính phí giao, từ 100k miễn phí', () => {
    expect(computeCartSummary(cartWorth(30000, 2), null)).toMatchObject({
      subtotal: 60000,
      shipping: SHIPPING_FEE,
      total: 60000 + SHIPPING_FEE,
    });
    expect(computeCartSummary(cartWorth(50000, 2), null)).toMatchObject({ shipping: 0, total: 100000 });
  });

  it('áp dụng voucher cố định và phần trăm có trần', () => {
    expect(computeCartSummary(cartWorth(60000, 2), 'BREWLITEVIP')).toMatchObject({ discount: 20000, total: 100000 });
    expect(computeCartSummary(cartWorth(100000, 3), 'SINHVIEN15').discount).toBe(30000);
    expect(computeCartSummary(cartWorth(40000), 'sinhvien15').discount).toBe(6000);
  });

  it('voucher bị vô hiệu khi đơn giảm xuống dưới mức tối thiểu', () => {
    const summary = computeCartSummary(cartWorth(40000), 'BREWLITEVIP');
    expect(summary.discount).toBe(0);
    expect(summary.voucherInactive).toBe(true);
  });
});

describe('validateVoucher', () => {
  it('báo lỗi khi trống, sai mã hoặc chưa đủ điều kiện', () => {
    expect(validateVoucher('', 100000)).toMatchObject({ ok: false });
    expect(validateVoucher('ABC', 100000)).toMatchObject({ ok: false, error: expect.stringContaining('không hợp lệ') });
    expect(validateVoucher('BREWLITEVIP', 50000)).toMatchObject({ ok: false, error: expect.stringContaining('100.000') });
    expect(validateVoucher(' coffee10 ', 50000)).toMatchObject({ ok: true });
  });
});
