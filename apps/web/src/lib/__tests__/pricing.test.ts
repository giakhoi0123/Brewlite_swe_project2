import { calcUnitPrice } from '../pricing';

describe('calcUnitPrice', () => {
  const base = { size: 'M' as const, sugar: '100%', ice: '100%', toppingIds: [] };

  it('size M không phụ thu', () => {
    expect(calcUnitPrice(29000, base)).toBe(29000);
  });

  it('cộng phụ thu size L và topping', () => {
    expect(calcUnitPrice(29000, { ...base, size: 'L', toppingIds: ['tran-chau-den', 'shot-espresso'] })).toBe(
      29000 + 6000 + 5000 + 10000,
    );
  });

  it('bỏ qua topping không tồn tại', () => {
    expect(calcUnitPrice(30000, { ...base, toppingIds: ['khong-co'] })).toBe(30000);
  });
});
