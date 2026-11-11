import { Prisma } from '@prisma/client';
import { AggregatedIngredientRequirement } from './orders.types';

export interface OptionRecipeSource {
  ingredientId: string;
  ingredientName?: string;
  amount: Prisma.Decimal | number | string;
}

export interface ItemIngredientInput {
  quantity: number;
  recipes: OptionRecipeSource[];
}

/**
 * Tổng hợp toàn bộ lượng nguyên liệu cần thiết cho đơn hàng:
 * - Nhân recipe.amount với quantity của từng OrderItem.
 * - Cộng dồn theo ingredientId qua mọi option (SIZE, TOPPING) và qua mọi OrderItem.
 * - Sắp xếp kết quả theo ingredientId tăng dần để đảm bảo thứ tự khóa ổn định (Deadlock Prevention).
 * - Sử dụng hoàn toàn Prisma.Decimal.
 */
export function aggregateIngredientRequirements(
  items: ItemIngredientInput[],
): AggregatedIngredientRequirement[] {
  const map = new Map<
    string,
    { ingredientId: string; ingredientName?: string; totalAmount: Prisma.Decimal }
  >();

  for (const item of items) {
    const quantityDecimal = new Prisma.Decimal(item.quantity);

    for (const recipe of item.recipes) {
      const recipeAmountDecimal = new Prisma.Decimal(recipe.amount);
      const neededForThisLine = recipeAmountDecimal.mul(quantityDecimal);

      const existing = map.get(recipe.ingredientId);
      if (existing) {
        existing.totalAmount = existing.totalAmount.plus(neededForThisLine);
        if (!existing.ingredientName && recipe.ingredientName) {
          existing.ingredientName = recipe.ingredientName;
        }
      } else {
        map.set(recipe.ingredientId, {
          ingredientId: recipe.ingredientId,
          ingredientName: recipe.ingredientName,
          totalAmount: neededForThisLine,
        });
      }
    }
  }

  // Sắp xếp tăng dần theo ingredientId (Deadlock Prevention)
  return Array.from(map.values()).sort((a, b) =>
    a.ingredientId.localeCompare(b.ingredientId),
  );
}
