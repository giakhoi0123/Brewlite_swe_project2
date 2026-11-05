import { DrinkCustomization, SizeCode } from '../types/menu';
import { calcUnitPrice } from './pricing';
import { ProductOption } from '../types/product';

export interface CartItem {
  lineId: string;
  productId: string;
  name: string;
  imageUrl: string;
  /** Giá cơ bản chưa phụ thu — để tính lại khi đổi size trong giỏ. */
  basePrice: number;
  customization: DrinkCustomization;
  unitPrice: number;
  quantity: number;
  /** Snapshot tùy chọn API; undefined dành cho giỏ cũ dùng danh mục local. */
  productOptions?: ProductOption[];
}

export type NewCartItem = Omit<CartItem, 'lineId' | 'unitPrice'>;

export const MAX_LINE_QUANTITY = 99;

// Cùng món + cùng tùy chọn thì gộp chung một dòng trong giỏ.
export function buildLineId(productId: string, c: DrinkCustomization): string {
  return [productId, c.size, c.sugar, c.ice, [...c.toppingIds].sort().join('+'), c.note?.trim() ?? ''].join('|');
}

/** Thêm dòng; nếu trùng lineId thì cộng dồn số lượng. */
function mergeLine(items: CartItem[], line: CartItem): CartItem[] {
  const existing = items.find((i) => i.lineId === line.lineId);
  if (!existing) return [...items, line];
  return items.map((i) =>
    i.lineId === line.lineId ? { ...i, quantity: Math.min(MAX_LINE_QUANTITY, i.quantity + line.quantity) } : i,
  );
}

export function addCartItem(items: CartItem[], item: NewCartItem): CartItem[] {
  return mergeLine(items, {
    ...item,
    lineId: buildLineId(item.productId, item.customization),
    unitPrice: calcUnitPrice(item.basePrice, item.customization, item.productOptions),
  });
}

export function setLineQuantity(items: CartItem[], lineId: string, quantity: number): CartItem[] {
  if (quantity <= 0) return removeLine(items, lineId);
  const q = Math.min(MAX_LINE_QUANTITY, Math.floor(quantity));
  return items.map((i) => (i.lineId === lineId ? { ...i, quantity: q } : i));
}

export function removeLine(items: CartItem[], lineId: string): CartItem[] {
  return items.filter((i) => i.lineId !== lineId);
}

/** Đổi size một dòng: tính lại giá; nếu trùng với dòng khác sẵn có thì gộp lại, giữ vị trí dòng cũ. */
export function changeLineSize(items: CartItem[], lineId: string, size: SizeCode): CartItem[] {
  const index = items.findIndex((i) => i.lineId === lineId);
  if (index === -1 || items[index].customization.size === size) return items;

  const current = items[index];
  if (current.productOptions && !current.productOptions.some((o) => o.type === 'SIZE' && o.id === size)) return items;
  const customization = { ...current.customization, size };
  const updated: CartItem = {
    ...current,
    customization,
    lineId: buildLineId(current.productId, customization),
    unitPrice: calcUnitPrice(current.basePrice, customization, current.productOptions),
  };

  const duplicate = items.find((i, idx) => idx !== index && i.lineId === updated.lineId);
  if (duplicate) {
    return items
      .filter((_, idx) => idx !== index)
      .map((i) =>
        i.lineId === updated.lineId
          ? { ...i, quantity: Math.min(MAX_LINE_QUANTITY, i.quantity + current.quantity) }
          : i,
      );
  }
  return items.map((i, idx) => (idx === index ? updated : i));
}

/** Bỏ các dòng hỏng (dữ liệu cũ trong localStorage thiếu field). */
export function sanitizeCartItems(raw: unknown): CartItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (i): i is CartItem =>
      i &&
      typeof i.lineId === 'string' &&
      typeof i.productId === 'string' &&
      typeof i.basePrice === 'number' &&
      typeof i.unitPrice === 'number' &&
      typeof i.quantity === 'number' &&
      i.quantity > 0 &&
      i.customization &&
      Array.isArray(i.customization.toppingIds),
  );
}
