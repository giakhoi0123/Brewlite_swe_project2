import { getProductBySlug, MOCK_PRODUCTS } from '../../data/menu-products';
import { discountPercent, getGalleryImages, getRelatedProducts } from '../product-detail';
import { slugify } from '../slug';

describe('slugify', () => {
  it('chuyển tên tiếng Việt thành slug', () => {
    expect(slugify('Trà Đào Cam Sả Tươi Mát')).toBe('tra-dao-cam-sa-tuoi-mat');
    expect(slugify('  Cacao & Socola!! ')).toBe('cacao-socola');
  });

  it('30 món có slug không trùng và tra cứu được', () => {
    const slugs = MOCK_PRODUCTS.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(30);
    expect(getProductBySlug('ca-phe-sua-da-sai-gon')?.code).toBe('P03');
    expect(getProductBySlug('khong-co')).toBeUndefined();
  });
});

describe('product detail helpers', () => {
  const product = getProductBySlug('ca-phe-sua-da-sai-gon')!;

  it('gallery có 4 ảnh, ảnh đầu là ảnh của món, không trùng', () => {
    const images = getGalleryImages(product, MOCK_PRODUCTS);
    expect(images).toHaveLength(4);
    expect(images[0]).toBe(product.imageUrl);
    expect(new Set(images).size).toBe(4);
  });

  it('món gợi ý không chứa chính nó, ưu tiên cùng danh mục, chỉ món còn hàng', () => {
    const related = getRelatedProducts(product, MOCK_PRODUCTS);
    expect(related).toHaveLength(4);
    expect(related.some((p) => p.id === product.id)).toBe(false);
    expect(related.every((p) => p.isAvailable)).toBe(true);
    expect(related.every((p) => p.categoryId === product.categoryId)).toBe(true);
  });

  it('tính % tiết kiệm', () => {
    expect(discountPercent(product)).toBe(14); // 25k so với 29k
    expect(discountPercent(getProductBySlug('bac-xiu-3-tang-sai-gon')!)).toBeNull();
  });
});
