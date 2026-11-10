import { Prisma } from '@prisma/client';

/**
 * Base domain error for recipe capacity calculation errors.
 */
export class RecipeCapacityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RecipeCapacityError';
  }
}

/**
 * Thrown when a recipe requirement amount is <= 0 or invalid.
 */
export class InvalidRecipeAmountError extends RecipeCapacityError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidRecipeAmountError';
  }
}

/**
 * Thrown when an ingredient stock is negative.
 */
export class NegativeStockError extends RecipeCapacityError {
  constructor(message: string) {
    super(message);
    this.name = 'NegativeStockError';
  }
}

/**
 * Thrown when multiple recipe lines for the same ingredient provide conflicting stock values.
 */
export class InconsistentStockError extends RecipeCapacityError {
  constructor(message: string) {
    super(message);
    this.name = 'InconsistentStockError';
  }
}

/**
 * Represents a recipe line requirement for an ingredient with its current stock snapshot.
 */
export interface RecipeRequirementItem {
  readonly ingredientId: string;
  readonly stock: Prisma.Decimal | string | number;
  readonly amount: Prisma.Decimal | string | number;
}

/**
 * Aggregated requirement breakdown per ingredient.
 */
export interface AggregatedIngredientRequirement {
  readonly ingredientId: string;
  readonly stock: Prisma.Decimal;
  readonly totalRequiredAmount: Prisma.Decimal;
  readonly capacity: number;
}

/**
 * Safely converts Prisma.Decimal, string, or number to a valid Prisma.Decimal instance.
 */
function toDecimal(value: Prisma.Decimal | string | number, fieldName: string): Prisma.Decimal {
  if (Prisma.Decimal.isDecimal(value)) {
    return value;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    try {
      return new Prisma.Decimal(value);
    } catch {
      throw new RecipeCapacityError(`Invalid decimal value for ${fieldName}: ${value}`);
    }
  }
  throw new RecipeCapacityError(
    `Invalid decimal type for ${fieldName}: expected Prisma.Decimal, string, or number`,
  );
}

/**
 * Pure calculation helper that aggregates recipe lines and determines the maximum
 * number of cups (capacity) that can be prepared based on current ingredient stocks.
 *
 * Rules:
 * 1. Empty recipe list returns safe 0 (never Infinity or NaN).
 * 2. requiredAmount <= 0 is rejected with InvalidRecipeAmountError.
 * 3. stock < 0 is rejected with NegativeStockError.
 * 4. Conflicting stock snapshots for the same ingredientId throw InconsistentStockError.
 * 5. Recipe amounts for the same ingredientId are summed before dividing available stock.
 * 6. Capacity is always floored to the nearest integer.
 * 7. Overall capacity is the bottleneck (minimum) across all required ingredients.
 * 8. If capacity exceeds Number.MAX_SAFE_INTEGER, it is safely capped to Number.MAX_SAFE_INTEGER.
 * 9. Pure function: does NOT mutate inputs, does NOT query DB, does NOT throw HTTP exceptions.
 */
export function calculateRecipeCapacity(recipes: readonly RecipeRequirementItem[]): number {
  if (!recipes || recipes.length === 0) {
    return 0;
  }

  const ingredientStockMap = new Map<string, Prisma.Decimal>();
  const totalAmountMap = new Map<string, Prisma.Decimal>();

  for (const item of recipes) {
    if (!item.ingredientId || typeof item.ingredientId !== 'string' || item.ingredientId.trim() === '') {
      throw new RecipeCapacityError('Invalid ingredientId: must be a non-empty string');
    }

    const stockDecimal = toDecimal(item.stock, 'stock');
    if (stockDecimal.lt(0)) {
      throw new NegativeStockError(
        `Ingredient stock cannot be negative for ingredient ${item.ingredientId}, got ${stockDecimal.toString()}`,
      );
    }

    const amountDecimal = toDecimal(item.amount, 'amount');
    if (amountDecimal.lte(0)) {
      throw new InvalidRecipeAmountError(
        `Recipe amount must be strictly positive (> 0) for ingredient ${item.ingredientId}, got ${amountDecimal.toString()}`,
      );
    }

    const existingStock = ingredientStockMap.get(item.ingredientId);
    if (existingStock !== undefined) {
      if (!existingStock.equals(stockDecimal)) {
        throw new InconsistentStockError(
          `Inconsistent stock snapshot for ingredient ${item.ingredientId}: saw ${existingStock.toString()} vs ${stockDecimal.toString()}`,
        );
      }
    } else {
      ingredientStockMap.set(item.ingredientId, stockDecimal);
    }

    const currentTotal = totalAmountMap.get(item.ingredientId) ?? new Prisma.Decimal(0);
    totalAmountMap.set(item.ingredientId, currentTotal.plus(amountDecimal));
  }

  let minCapacity: Prisma.Decimal | null = null;

  for (const [ingredientId, totalAmount] of totalAmountMap.entries()) {
    const stock = ingredientStockMap.get(ingredientId)!;

    if (stock.isZero()) {
      return 0;
    }

    const capacity = stock.div(totalAmount).floor();
    const nonNegativeCapacity = capacity.lt(0) ? new Prisma.Decimal(0) : capacity;

    if (minCapacity === null || nonNegativeCapacity.lt(minCapacity)) {
      minCapacity = nonNegativeCapacity;
    }
  }

  if (minCapacity === null) {
    return 0;
  }

  if (minCapacity.gt(Number.MAX_SAFE_INTEGER)) {
    return Number.MAX_SAFE_INTEGER;
  }

  return minCapacity.toNumber();
}

/**
 * Alias for calculateRecipeCapacity, maintaining backward naming consistency.
 */
export const calculateOptionCapacity = calculateRecipeCapacity;
