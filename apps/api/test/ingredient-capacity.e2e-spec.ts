import { PrismaClient, Prisma, OptionType } from '@prisma/client';
import guardIntegrationDatabase from './integration-test-guard';

export type RecipeInput = {
  ingredientId: string;
  stock: Prisma.Decimal;
  amount: Prisma.Decimal;
};

export type OptionInput = {
  id: string;
  productId: string;
  type: OptionType;
  recipes: RecipeInput[];
};

export type CustomizationCapacityInput = {
  productId: string;
  size: OptionInput;
  toppings: OptionInput[];
};

export function calculateOptionCapacity(recipes: RecipeInput[]): number {
  if (!recipes || recipes.length === 0) {
    return 0;
  }

  let minCapacity: Prisma.Decimal | null = null;

  for (const recipe of recipes) {
    if (recipe.amount.lte(0)) {
      throw new Error(`Invalid recipe: amount must be strictly positive (> 0), got ${recipe.amount.toString()}`);
    }

    const capacity = recipe.stock.div(recipe.amount).floor();
    const nonNegativeCapacity = capacity.lt(0) ? new Prisma.Decimal(0) : capacity;

    if (minCapacity === null || nonNegativeCapacity.lt(minCapacity)) {
      minCapacity = nonNegativeCapacity;
    }
  }

  return minCapacity === null ? 0 : minCapacity.toNumber();
}

export function calculateCustomizationCapacity(input: CustomizationCapacityInput): number {
  const { productId, size, toppings } = input;

  if (size.type !== OptionType.SIZE) {
    throw new Error(`Invalid size option: expected type SIZE, got ${size.type}`);
  }

  if (size.productId !== productId) {
    throw new Error(`Size option product mismatch: expected productId ${productId}, got ${size.productId}`);
  }

  const seenToppingIds = new Set<string>();
  for (const topping of toppings) {
    if (topping.type !== OptionType.TOPPING) {
      throw new Error(`Invalid topping option: expected type TOPPING, got ${topping.type}`);
    }

    if (topping.productId !== productId) {
      throw new Error(`Topping option product mismatch: expected productId ${productId}, got ${topping.productId}`);
    }

    if (seenToppingIds.has(topping.id)) {
      throw new Error(`Duplicate topping ID detected in customization: ${topping.id}`);
    }
    seenToppingIds.add(topping.id);
  }

  if (!size.recipes || size.recipes.length === 0) {
    return 0;
  }

  for (const topping of toppings) {
    if (!topping.recipes || topping.recipes.length === 0) {
      return 0;
    }
  }

  const ingredientStockMap = new Map<string, Prisma.Decimal>();
  const totalAmountMap = new Map<string, Prisma.Decimal>();

  function registerRecipe(recipe: RecipeInput) {
    if (recipe.amount.lte(0)) {
      throw new Error(`Invalid recipe amount: amount must be strictly positive (> 0), got ${recipe.amount.toString()}`);
    }

    const existingStock = ingredientStockMap.get(recipe.ingredientId);
    if (existingStock !== undefined) {
      if (!existingStock.equals(recipe.stock)) {
        throw new Error(
          `Inconsistent stock snapshot for ingredient ${recipe.ingredientId}: saw ${existingStock.toString()} vs ${recipe.stock.toString()}`,
        );
      }
    } else {
      ingredientStockMap.set(recipe.ingredientId, recipe.stock);
    }

    const currentTotal = totalAmountMap.get(recipe.ingredientId) ?? new Prisma.Decimal(0);
    totalAmountMap.set(recipe.ingredientId, currentTotal.plus(recipe.amount));
  }

  for (const recipe of size.recipes) {
    registerRecipe(recipe);
  }

  for (const topping of toppings) {
    for (const recipe of topping.recipes) {
      registerRecipe(recipe);
    }
  }

  let minCapacity: Prisma.Decimal | null = null;

  for (const [ingredientId, totalAmount] of totalAmountMap.entries()) {
    const stock = ingredientStockMap.get(ingredientId);
    if (!stock) {
      return 0;
    }

    const capacity = stock.div(totalAmount).floor();
    const nonNegativeCapacity = capacity.lt(0) ? new Prisma.Decimal(0) : capacity;

    if (minCapacity === null || nonNegativeCapacity.lt(minCapacity)) {
      minCapacity = nonNegativeCapacity;
    }
  }

  return minCapacity === null ? 0 : minCapacity.toNumber();
}

describe('Ingredient Capacity Algorithm & Seed Integration (e2e)', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    guardIntegrationDatabase();
    prisma = new PrismaClient();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Part 1: Real Seed Database Coverage & Verification', () => {
    it('1. verifies seed counts: 8 products, 23 options, 15 ingredients, 36 option recipes', async () => {
      const [productCount, optionCount, ingredientCount, recipeCount, distinctOptionsWithRecipes] = await Promise.all([
        prisma.product.count(),
        prisma.productOption.count(),
        prisma.ingredient.count(),
        prisma.optionRecipe.count(),
        prisma.optionRecipe.groupBy({
          by: ['productOptionId'],
        }),
      ]);

      expect(productCount).toBe(8);
      expect(optionCount).toBe(23);
      expect(ingredientCount).toBe(15);
      expect(recipeCount).toBe(36);
      expect(distinctOptionsWithRecipes).toHaveLength(23);
    });

    it('2. verifies Bạc xỉu Size M capacity = 500', async () => {
      const sizeMOption = await prisma.productOption.findUnique({
        where: { id: 'b0000000-0000-0000-0000-000000000007' },
        include: {
          recipes: {
            include: { ingredient: true },
          },
        },
      });

      expect(sizeMOption).toBeDefined();
      expect(sizeMOption!.recipes).toHaveLength(3);

      const recipesInput: RecipeInput[] = sizeMOption!.recipes.map((r) => ({
        ingredientId: r.ingredientId,
        stock: new Prisma.Decimal(r.ingredient.stock),
        amount: new Prisma.Decimal(r.amount),
      }));

      const capacity = calculateOptionCapacity(recipesInput);
      expect(capacity).toBe(500);
    });

    it('3. verifies Bạc xỉu Size L capacity = 333 (Size L <= Size M)', async () => {
      const sizeLOption = await prisma.productOption.findUnique({
        where: { id: 'b0000000-0000-0000-0000-000000000008' },
        include: {
          recipes: {
            include: { ingredient: true },
          },
        },
      });

      expect(sizeLOption).toBeDefined();
      expect(sizeLOption!.recipes).toHaveLength(3);

      const recipesInput: RecipeInput[] = sizeLOption!.recipes.map((r) => ({
        ingredientId: r.ingredientId,
        stock: new Prisma.Decimal(r.ingredient.stock),
        amount: new Prisma.Decimal(r.amount),
      }));

      const capacity = calculateOptionCapacity(recipesInput);
      expect(capacity).toBe(333);
      expect(capacity).toBeLessThanOrEqual(500);
    });

    it('4. verifies Cold Brew Size M capacity = 0 (Arabica stock = 0)', async () => {
      const coldBrewSizeM = await prisma.productOption.findUnique({
        where: { id: 'b0000000-0000-0000-0000-000000000020' },
        include: {
          recipes: {
            include: { ingredient: true },
          },
        },
      });

      expect(coldBrewSizeM).toBeDefined();
      const arabicaRecipe = coldBrewSizeM!.recipes.find(
        (r) => r.ingredientId === 'd0000000-0000-4000-8000-000000000007',
      );
      expect(arabicaRecipe).toBeDefined();
      expect(Number(arabicaRecipe!.ingredient.stock)).toBe(0);

      const recipesInput: RecipeInput[] = coldBrewSizeM!.recipes.map((r) => ({
        ingredientId: r.ingredientId,
        stock: new Prisma.Decimal(r.ingredient.stock),
        amount: new Prisma.Decimal(r.amount),
      }));

      const capacity = calculateOptionCapacity(recipesInput);
      expect(capacity).toBe(0);
    });

    it('5. verifies standalone topping capacity: Shot Espresso thêm = 3333', async () => {
      const shotEspresso = await prisma.productOption.findUnique({
        where: { id: 'b0000000-0000-0000-0000-000000000009' },
        include: {
          recipes: {
            include: { ingredient: true },
          },
        },
      });

      expect(shotEspresso).toBeDefined();
      expect(shotEspresso!.type).toBe(OptionType.TOPPING);

      const recipesInput: RecipeInput[] = shotEspresso!.recipes.map((r) => ({
        ingredientId: r.ingredientId,
        stock: new Prisma.Decimal(r.ingredient.stock),
        amount: new Prisma.Decimal(r.amount),
      }));

      const standaloneCapacity = calculateOptionCapacity(recipesInput);
      expect(standaloneCapacity).toBe(3333);
    });
  });

  describe('Part 2: Synthetic Customization & Edge Case Tests (In-Memory Pure Logic)', () => {
    it('6. correctly combines coffee amount: Size (20g) + Topping (10g) with 360g stock -> capacity = 12 (not min(18, 36))', () => {
      const coffeeIngId = 'ing-coffee';
      const stock = new Prisma.Decimal('360.000');

      const sizeOption: OptionInput = {
        id: 'opt-size',
        productId: 'prod-coffee',
        type: OptionType.SIZE,
        recipes: [{ ingredientId: coffeeIngId, stock, amount: new Prisma.Decimal('20.000') }],
      };

      const toppingOption: OptionInput = {
        id: 'opt-topping',
        productId: 'prod-coffee',
        type: OptionType.TOPPING,
        recipes: [{ ingredientId: coffeeIngId, stock, amount: new Prisma.Decimal('10.000') }],
      };

      expect(calculateOptionCapacity(sizeOption.recipes)).toBe(18);
      expect(calculateOptionCapacity(toppingOption.recipes)).toBe(36);

      const customCapacity = calculateCustomizationCapacity({
        productId: 'prod-coffee',
        size: sizeOption,
        toppings: [toppingOption],
      });

      expect(customCapacity).toBe(12);
    });

    it('7. combines multiple toppings sharing an ingredient: Size (100ml) + Topping A (20ml) + Topping B (30ml) with 900ml stock -> capacity = 6', () => {
      const milkIngId = 'ing-milk';
      const stock = new Prisma.Decimal('900.000');

      const sizeOption: OptionInput = {
        id: 'opt-size-milk',
        productId: 'prod-latte',
        type: OptionType.SIZE,
        recipes: [{ ingredientId: milkIngId, stock, amount: new Prisma.Decimal('100.000') }],
      };

      const toppingA: OptionInput = {
        id: 'opt-top-a',
        productId: 'prod-latte',
        type: OptionType.TOPPING,
        recipes: [{ ingredientId: milkIngId, stock, amount: new Prisma.Decimal('20.000') }],
      };

      const toppingB: OptionInput = {
        id: 'opt-top-b',
        productId: 'prod-latte',
        type: OptionType.TOPPING,
        recipes: [{ ingredientId: milkIngId, stock, amount: new Prisma.Decimal('30.000') }],
      };

      const customCapacity = calculateCustomizationCapacity({
        productId: 'prod-latte',
        size: sizeOption,
        toppings: [toppingA, toppingB],
      });

      expect(customCapacity).toBe(6);
    });

    it('8. handles empty recipes safely: returns 0 for empty option or missing topping recipe', () => {
      expect(calculateOptionCapacity([])).toBe(0);

      const sizeEmpty: OptionInput = {
        id: 'opt-empty',
        productId: 'prod-tea',
        type: OptionType.SIZE,
        recipes: [],
      };

      expect(
        calculateCustomizationCapacity({
          productId: 'prod-tea',
          size: sizeEmpty,
          toppings: [],
        }),
      ).toBe(0);

      const sizeValid: OptionInput = {
        id: 'opt-size-tea',
        productId: 'prod-tea',
        type: OptionType.SIZE,
        recipes: [
          {
            ingredientId: 'tea-leaf',
            stock: new Prisma.Decimal('100.000'),
            amount: new Prisma.Decimal('10.000'),
          },
        ],
      };

      const toppingEmpty: OptionInput = {
        id: 'opt-top-empty',
        productId: 'prod-tea',
        type: OptionType.TOPPING,
        recipes: [],
      };

      expect(
        calculateCustomizationCapacity({
          productId: 'prod-tea',
          size: sizeValid,
          toppings: [toppingEmpty],
        }),
      ).toBe(0);
    });

    it('9. validates option types and cross-product association: throws on invalid inputs', () => {
      const invalidSizeType: OptionInput = {
        id: 'opt-top-as-size',
        productId: 'prod-tea',
        type: OptionType.TOPPING,
        recipes: [{ ingredientId: 'tea', stock: new Prisma.Decimal(10), amount: new Prisma.Decimal(1) }],
      };

      expect(() =>
        calculateCustomizationCapacity({
          productId: 'prod-tea',
          size: invalidSizeType,
          toppings: [],
        }),
      ).toThrow('expected type SIZE');

      const validSize: OptionInput = {
        id: 'opt-valid-size',
        productId: 'prod-tea',
        type: OptionType.SIZE,
        recipes: [{ ingredientId: 'tea', stock: new Prisma.Decimal(10), amount: new Prisma.Decimal(1) }],
      };

      const invalidToppingType: OptionInput = {
        id: 'opt-size-as-top',
        productId: 'prod-tea',
        type: OptionType.SIZE,
        recipes: [{ ingredientId: 'tea', stock: new Prisma.Decimal(10), amount: new Prisma.Decimal(1) }],
      };

      expect(() =>
        calculateCustomizationCapacity({
          productId: 'prod-tea',
          size: validSize,
          toppings: [invalidToppingType],
        }),
      ).toThrow('expected type TOPPING');

      const crossProductTopping: OptionInput = {
        id: 'opt-cross-top',
        productId: 'prod-other',
        type: OptionType.TOPPING,
        recipes: [{ ingredientId: 'tea', stock: new Prisma.Decimal(10), amount: new Prisma.Decimal(1) }],
      };

      expect(() =>
        calculateCustomizationCapacity({
          productId: 'prod-tea',
          size: validSize,
          toppings: [crossProductTopping],
        }),
      ).toThrow('Topping option product mismatch');
    });

    it('10. throws on duplicate topping IDs in customization list', () => {
      const validSize: OptionInput = {
        id: 'opt-size-1',
        productId: 'prod-1',
        type: OptionType.SIZE,
        recipes: [{ ingredientId: 'ing-1', stock: new Prisma.Decimal(100), amount: new Prisma.Decimal(10) }],
      };

      const toppingA: OptionInput = {
        id: 'opt-top-dup',
        productId: 'prod-1',
        type: OptionType.TOPPING,
        recipes: [{ ingredientId: 'ing-2', stock: new Prisma.Decimal(100), amount: new Prisma.Decimal(5) }],
      };

      expect(() =>
        calculateCustomizationCapacity({
          productId: 'prod-1',
          size: validSize,
          toppings: [toppingA, toppingA],
        }),
      ).toThrow('Duplicate topping ID detected in customization');
    });

    it('11. verifies exact Decimal floor without floating point rounding errors', () => {
      const recipe1: RecipeInput = {
        ingredientId: 'ing-precise',
        stock: new Prisma.Decimal('1.000'),
        amount: new Prisma.Decimal('0.333'),
      };
      expect(calculateOptionCapacity([recipe1])).toBe(3);

      const recipe2: RecipeInput = {
        ingredientId: 'ing-precise',
        stock: new Prisma.Decimal('1.000'),
        amount: new Prisma.Decimal('0.334'),
      };
      expect(calculateOptionCapacity([recipe2])).toBe(2);
    });

    it('12. ensures input arguments are never mutated by calculation functions', () => {
      const sizeInput: OptionInput = {
        id: 'opt-immutable-size',
        productId: 'prod-immutable',
        type: OptionType.SIZE,
        recipes: [
          {
            ingredientId: 'ing-imm-1',
            stock: new Prisma.Decimal('500.000'),
            amount: new Prisma.Decimal('25.000'),
          },
        ],
      };

      const toppingInput: OptionInput = {
        id: 'opt-immutable-top',
        productId: 'prod-immutable',
        type: OptionType.TOPPING,
        recipes: [
          {
            ingredientId: 'ing-imm-2',
            stock: new Prisma.Decimal('300.000'),
            amount: new Prisma.Decimal('15.000'),
          },
        ],
      };

      const sizeBefore = JSON.stringify({
        id: sizeInput.id,
        productId: sizeInput.productId,
        type: sizeInput.type,
        recipes: sizeInput.recipes.map((r) => ({
          id: r.ingredientId,
          stock: r.stock.toString(),
          amount: r.amount.toString(),
        })),
      });

      const toppingBefore = JSON.stringify({
        id: toppingInput.id,
        productId: toppingInput.productId,
        type: toppingInput.type,
        recipes: toppingInput.recipes.map((r) => ({
          id: r.ingredientId,
          stock: r.stock.toString(),
          amount: r.amount.toString(),
        })),
      });

      calculateOptionCapacity(sizeInput.recipes);
      calculateCustomizationCapacity({
        productId: 'prod-immutable',
        size: sizeInput,
        toppings: [toppingInput],
      });

      const sizeAfter = JSON.stringify({
        id: sizeInput.id,
        productId: sizeInput.productId,
        type: sizeInput.type,
        recipes: sizeInput.recipes.map((r) => ({
          id: r.ingredientId,
          stock: r.stock.toString(),
          amount: r.amount.toString(),
        })),
      });

      const toppingAfter = JSON.stringify({
        id: toppingInput.id,
        productId: toppingInput.productId,
        type: toppingInput.type,
        recipes: toppingInput.recipes.map((r) => ({
          id: r.ingredientId,
          stock: r.stock.toString(),
          amount: r.amount.toString(),
        })),
      });

      expect(sizeAfter).toBe(sizeBefore);
      expect(toppingAfter).toBe(toppingBefore);
    });
  });
});