import { SIZE_OPTIONS, TOPPING_OPTIONS } from '../data/menu-options';
import { DrinkCustomization } from '../types/menu';

/** Giá 1 ly sau khi cộng phụ thu size và topping. */
export function calcUnitPrice(basePrice: number, customization: DrinkCustomization): number {
  const sizeExtra = SIZE_OPTIONS.find((size) => size.code === customization.size)?.extraPrice ?? 0;
  const toppingExtra = customization.toppingIds.reduce((sum, id) => {
    const topping = TOPPING_OPTIONS.find((option) => option.id === id);
    return sum + (topping?.price ?? 0);
  }, 0);
  return basePrice + sizeExtra + toppingExtra;
}
