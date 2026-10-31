import { MenuCategoryId, MenuProduct, SortOption } from '../types/menu';

export type CategoryFilter = MenuCategoryId | 'all';

/** Bỏ dấu tiếng Việt để tìm "bac xiu" vẫn ra "Bạc Xỉu". */
export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

export function filterAndSortProducts(
  products: MenuProduct[],
  options: { category: CategoryFilter; search: string; sort: SortOption },
): MenuProduct[] {
  const query = normalizeSearchText(options.search);

  const filtered = products.filter((product) => {
    const matchCategory = options.category === 'all' || product.categoryId === options.category;
    const matchSearch =
      !query ||
      normalizeSearchText(product.name).includes(query) ||
      normalizeSearchText(product.code).includes(query);
    return matchCategory && matchSearch;
  });

  const sorted = [...filtered];
  switch (options.sort) {
    case 'price-asc':
      sorted.sort((a, b) => a.basePrice - b.basePrice);
      break;
    case 'price-desc':
      sorted.sort((a, b) => b.basePrice - a.basePrice);
      break;
    case 'rating':
      sorted.sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount);
      break;
    case 'best-seller':
      sorted.sort((a, b) => b.soldCount - a.soldCount);
      break;
    default:
      break;
  }
  return sorted;
}

export function countByCategory(products: MenuProduct[]): Record<string, number> {
  return products.reduce<Record<string, number>>((acc, product) => {
    acc[product.categoryId] = (acc[product.categoryId] ?? 0) + 1;
    return acc;
  }, {});
}
