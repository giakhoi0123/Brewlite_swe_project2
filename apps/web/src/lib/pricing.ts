import { SIZE_OPTIONS, TOPPING_OPTIONS } from '../data/menu-options';
import { DrinkCustomization } from '../types/menu';
import { ProductOption } from '../types/product';

/** Giá 1 ly sau khi cộng phụ thu size và topping. */
export function calcUnitPrice(basePrice: number, customization: DrinkCustomization, options?: ProductOption[]): number {
  if (options) {
    return basePrice + options.reduce((sum, option) => sum + (
      (option.type === 'SIZE' && option.id === customization.size) ||
      (option.type === 'TOPPING' && customization.toppingIds.includes(option.id))
        ? option.extraPrice : 0
    ), 0);
  }
  const sizeExtra = SIZE_OPTIONS.find((size) => size.code === customization.size)?.extraPrice ?? 0;
  const toppingExtra = customization.toppingIds.reduce((sum, id) => {
    const topping = TOPPING_OPTIONS.find((option) => option.id === id);
    return sum + (topping?.price ?? 0);
  }, 0);
  return basePrice + sizeExtra + toppingExtra;
}
