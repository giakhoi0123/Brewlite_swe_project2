import { MenuProduct } from '../types/menu';

/**
 * Ảnh cho gallery: ảnh chính của món + ảnh các món cùng danh mục (giống bản vẽ),
 * thiếu thì lấy thêm từ món khác.
 */
export function getGalleryImages(product: MenuProduct, all: MenuProduct[], count = 4): string[] {
  const others = [
    ...all.filter((p) => p.id !== product.id && p.categoryId === product.categoryId),
    ...all.filter((p) => p.categoryId !== product.categoryId),
  ];
  const images = [product.imageUrl];
  for (const p of others) {
    if (images.length >= count) break;
    if (!images.includes(p.imageUrl)) images.push(p.imageUrl);
  }
  return images;
}

/** Món gợi ý: ưu tiên cùng danh mục, còn hàng, bán chạy nhất. */
export function getRelatedProducts(product: MenuProduct, all: MenuProduct[], count = 4): MenuProduct[] {
  const candidates = all.filter((p) => p.id !== product.id && p.isAvailable);
  const sameCategory = candidates
    .filter((p) => p.categoryId === product.categoryId)
    .sort((a, b) => b.soldCount - a.soldCount);
  const others = candidates
    .filter((p) => p.categoryId !== product.categoryId)
    .sort((a, b) => b.soldCount - a.soldCount);
  return [...sameCategory, ...others].slice(0, count);
}

export function discountPercent(product: MenuProduct): number | null {
  if (!product.originalPrice || product.originalPrice <= product.basePrice) return null;
  return Math.round((1 - product.basePrice / product.originalPrice) * 100);
}
