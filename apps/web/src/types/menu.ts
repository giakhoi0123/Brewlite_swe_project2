export type MenuCategoryId =
  | 'ca-phe'
  | 'cold-brew'
  | 'tra-sua'
  | 'tra-matcha'
  | 'tra-trai-cay'
  | 'cacao'
  | 'giai-nhiet';

export interface MenuCategory {
  id: MenuCategoryId;
  label: string;
  shortLabel: string;
}

export type BadgeTone = 'caramel' | 'peach' | 'espresso' | 'cream' | 'latte';

export type IconKey =
  | 'star'
  | 'trending'
  | 'leaf'
  | 'flame'
  | 'award'
  | 'clock'
  | 'flower'
  | 'zap'
  | 'school'
  | 'sparkles'
  | 'coffee'
  | 'snowflake'
  | 'droplets'
  | 'milk'
  | 'citrus';

export interface MenuBadge {
  label: string;
  tone: BadgeTone;
  icon: IconKey;
}

export interface MenuProduct {
  id: string;
  code: string;
  /** Đường dẫn thân thiện cho trang chi tiết, sinh từ tên món. */
  slug: string;
  name: string;
  categoryId: MenuCategoryId;
  description: string;
  basePrice: number;
  /** Giá gốc trước khuyến mãi (nếu có). */
  originalPrice?: number;
  imageUrl: string;
  rating: number;
  reviewCount: number;
  soldCount: number;
  isAvailable: boolean;
  badge?: MenuBadge;
}

export type SortOption = 'default' | 'best-seller' | 'price-asc' | 'price-desc' | 'rating';

export type SizeCode = 'M' | 'L';

export interface SizeOption {
  code: SizeCode;
  label: string;
  volume: string;
  extraPrice: number;
}

export interface ToppingOption {
  id: string;
  name: string;
  price: number;
}

export interface DrinkCustomization {
  size: SizeCode;
  sugar: string;
  ice: string;
  toppingIds: string[];
  /** Ghi chú cho Barista. */
  note?: string;
}

export interface ProductTag {
  label: string;
  icon: IconKey;
}

export interface ProductStory {
  ingredients: string;
  origin: string;
  flavor: string;
  serving: string;
}

export interface FlavorScore {
  label: string;
  score: number;
}

export interface CategoryDetail {
  series: string;
  tags: ProductTag[];
  story: ProductStory;
  flavor: FlavorScore[];
}
