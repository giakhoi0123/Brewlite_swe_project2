import { DEFAULT_CUSTOMIZATION } from '../../data/menu-options';
import { addCartItem, changeLineSize, NewCartItem, sanitizeCartItems, setLineQuantity } from '../cart';

const coffee: NewCartItem = {
  productId: 'PROD_03',
  name: 'Cà Phê Sữa Đá Sài Gòn',
  imageUrl: 'x.jpg',
  basePrice: 25000,
  customization: DEFAULT_CUSTOMIZATION,
  quantity: 1,
};

describe('cart helpers', () => {
  it('tính đơn giá khi thêm và gộp dòng trùng tùy chọn', () => {
    let items = addCartItem([], coffee);
    items = addCartItem(items, { ...coffee, quantity: 2 });
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(3);
    expect(items[0].unitPrice).toBe(25000);
  });

  it('khác topping hoặc ghi chú thì tách dòng', () => {
    let items = addCartItem([], coffee);
    items = addCartItem(items, { ...coffee, customization: { ...DEFAULT_CUSTOMIZATION, toppingIds: ['kem-cheese'] } });
    items = addCartItem(items, { ...coffee, customization: { ...DEFAULT_CUSTOMIZATION, note: 'mang đi' } });
    expect(items).toHaveLength(3);
    expect(items[1].unitPrice).toBe(33000);
  });

  it('số lượng 0 thì xóa dòng, giới hạn tối đa 99', () => {
    const items = addCartItem([], coffee);
    expect(setLineQuantity(items, items[0].lineId, 0)).toHaveLength(0);
    expect(setLineQuantity(items, items[0].lineId, 150)[0].quantity).toBe(99);
  });

  it('đổi size tính lại giá và lineId', () => {
    const items = addCartItem([], coffee);
    const changed = changeLineSize(items, items[0].lineId, 'L');
    expect(changed[0].unitPrice).toBe(31000);
    expect(changed[0].lineId).not.toBe(items[0].lineId);
  });

  it('đổi size trùng với dòng có sẵn thì gộp số lượng', () => {
    let items = addCartItem([], { ...coffee, quantity: 2 });
    items = addCartItem(items, { ...coffee, customization: { ...DEFAULT_CUSTOMIZATION, size: 'L' } });
    const merged = changeLineSize(items, items[0].lineId, 'L');
    expect(merged).toHaveLength(1);
    expect(merged[0].quantity).toBe(3);
    expect(merged[0].customization.size).toBe('L');
  });

  it('loại bỏ dữ liệu hỏng từ localStorage', () => {
    const good = addCartItem([], coffee)[0];
    expect(sanitizeCartItems([good, { lineId: 'x' }, null])).toEqual([good]);
    expect(sanitizeCartItems('abc')).toEqual([]);
  });
});
