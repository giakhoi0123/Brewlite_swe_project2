import { MOCK_PRODUCTS } from '../../data/menu-products';
import { countByCategory, filterAndSortProducts, normalizeSearchText } from '../menu-filter';

describe('normalizeSearchText', () => {
  it('bỏ dấu tiếng Việt và chữ đ', () => {
    expect(normalizeSearchText('  Bạc Xỉu Đá ')).toBe('bac xiu da');
  });
});

describe('filterAndSortProducts', () => {
  const base = { category: 'all' as const, search: '', sort: 'default' as const };

  it('mock data có 30 sản phẩm với id và code không trùng', () => {
    expect(MOCK_PRODUCTS).toHaveLength(30);
    expect(new Set(MOCK_PRODUCTS.map((p) => p.id)).size).toBe(30);
    expect(new Set(MOCK_PRODUCTS.map((p) => p.code)).size).toBe(30);
  });

  it('trả về toàn bộ theo thứ tự gốc khi không lọc', () => {
    expect(filterAndSortProducts(MOCK_PRODUCTS, base)).toEqual(MOCK_PRODUCTS);
  });

  it('lọc theo danh mục', () => {
    const result = filterAndSortProducts(MOCK_PRODUCTS, { ...base, category: 'cold-brew' });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((p) => p.categoryId === 'cold-brew')).toBe(true);
  });

  it('tìm kiếm không dấu và theo mã món', () => {
    expect(filterAndSortProducts(MOCK_PRODUCTS, { ...base, search: 'bac xiu' }).map((p) => p.code)).toEqual(['P01']);
    expect(filterAndSortProducts(MOCK_PRODUCTS, { ...base, search: 'p14' }).map((p) => p.code)).toEqual(['P14']);
  });

  it('sắp xếp theo giá tăng/giảm', () => {
    const asc = filterAndSortProducts(MOCK_PRODUCTS, { ...base, sort: 'price-asc' }).map((p) => p.basePrice);
    const desc = filterAndSortProducts(MOCK_PRODUCTS, { ...base, sort: 'price-desc' }).map((p) => p.basePrice);
    expect(asc).toEqual([...asc].sort((a, b) => a - b));
    expect(desc).toEqual([...desc].sort((a, b) => b - a));
  });

  it('không làm thay đổi mảng gốc khi sắp xếp', () => {
    const snapshot = [...MOCK_PRODUCTS];
    filterAndSortProducts(MOCK_PRODUCTS, { ...base, sort: 'best-seller' });
    expect(MOCK_PRODUCTS).toEqual(snapshot);
  });

  it('countByCategory cộng đủ 30 món', () => {
    const counts = countByCategory(MOCK_PRODUCTS);
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(30);
  });
});
