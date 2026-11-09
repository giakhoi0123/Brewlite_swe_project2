import { Prisma } from '@prisma/client';
import {
  calculateRecipeCapacity,
  calculateOptionCapacity,
  RecipeRequirementItem,
  InvalidRecipeAmountError,
  NegativeStockError,
  InconsistentStockError,
  RecipeCapacityError,
} from './recipe-capacity.helper';

describe('Recipe Capacity Calculator (Pure Production Helper)', () => {
  describe('A. Single Ingredient Calculation', () => {
    it('returns 36 when stock is 360 and required amount is 10', () => {
      const input: RecipeRequirementItem[] = [
        {
          ingredientId: 'ing-coffee',
          stock: new Prisma.Decimal('360.000'),
          amount: new Prisma.Decimal('10.000'),
        },
      ];

      const capacity = calculateRecipeCapacity(input);
      expect(capacity).toBe(36);
    });
  });

  describe('B. Multiple Ingredients Bottleneck', () => {
    it('returns the minimum capacity (15) when individual capacities are 18, 15, 30', () => {
      const input: RecipeRequirementItem[] = [
        {
          ingredientId: 'ing-coffee',
          stock: new Prisma.Decimal('360.000'),
          amount: new Prisma.Decimal('20.000'), // 360 / 20 = 18
        },
        {
          ingredientId: 'ing-milk',
          stock: new Prisma.Decimal('450.000'),
          amount: new Prisma.Decimal('30.000'), // 450 / 30 = 15 (bottleneck)
        },
        {
          ingredientId: 'ing-sugar',
          stock: new Prisma.Decimal('300.000'),
          amount: new Prisma.Decimal('10.000'), // 300 / 10 = 30
        },
      ];

      const capacity = calculateRecipeCapacity(input);
      expect(capacity).toBe(15);
    });
  });

  describe('C. High Precision Decimal Arithmetic', () => {
    it('accurately computes capacity = 4 for stock 1.250 and required 0.300', () => {
      const input: RecipeRequirementItem[] = [
        {
          ingredientId: 'ing-vanilla',
          stock: new Prisma.Decimal('1.250'),
          amount: new Prisma.Decimal('0.300'),
        },
      ];

      const capacity = calculateRecipeCapacity(input);
      expect(capacity).toBe(4);
    });

    it('accurately computes without floating point rounding error for 1.000 / 0.333 = 3', () => {
      const input: RecipeRequirementItem[] = [
        {
          ingredientId: 'ing-precise',
          stock: new Prisma.Decimal('1.000'),
          amount: new Prisma.Decimal('0.333'),
        },
      ];

      expect(calculateRecipeCapacity(input)).toBe(3);
    });
  });

  describe('D. Floor Rounding Policy', () => {
    it('always floors down fractional results (e.g., 10 / 3 = 3, not 3.333 or 4)', () => {
      const input: RecipeRequirementItem[] = [
        {
          ingredientId: 'ing-tea',
          stock: new Prisma.Decimal('10.000'),
          amount: new Prisma.Decimal('3.000'),
        },
      ];

      expect(calculateRecipeCapacity(input)).toBe(3);
    });

    it('floors 1.000 / 0.334 to 2 (since 2 * 0.334 = 0.668 <= 1.000 < 3 * 0.334 = 1.002)', () => {
      const input: RecipeRequirementItem[] = [
        {
          ingredientId: 'ing-precise-2',
          stock: new Prisma.Decimal('1.000'),
          amount: new Prisma.Decimal('0.334'),
        },
      ];

      expect(calculateRecipeCapacity(input)).toBe(2);
    });
  });

  describe('E. Zero Stock Handling', () => {
    it('returns 0 immediately if any ingredient stock is 0', () => {
      const input: RecipeRequirementItem[] = [
        {
          ingredientId: 'ing-coffee',
          stock: new Prisma.Decimal('500.000'),
          amount: new Prisma.Decimal('25.000'),
        },
        {
          ingredientId: 'ing-milk',
          stock: new Prisma.Decimal('0.000'),
          amount: new Prisma.Decimal('50.000'),
        },
      ];

      expect(calculateRecipeCapacity(input)).toBe(0);
    });
  });

  describe('F. Multiple Options Sharing One Ingredient', () => {
    it('sums amounts for the same ingredient before dividing stock (Size 20g + Topping 10g with 360g stock -> 12, not min(18, 36)=18)', () => {
      const input: RecipeRequirementItem[] = [
        {
          ingredientId: 'ing-coffee',
          stock: new Prisma.Decimal('360.000'),
          amount: new Prisma.Decimal('20.000'), // from SIZE
        },
        {
          ingredientId: 'ing-coffee',
          stock: new Prisma.Decimal('360.000'),
          amount: new Prisma.Decimal('10.000'), // from TOPPING
        },
      ];

      // Total required = 20 + 10 = 30. Stock = 360. Capacity = 360 / 30 = 12.
      expect(calculateRecipeCapacity(input)).toBe(12);
    });
  });

  describe('G. Topping Adding Shared Ingredient Reduces Capacity Correctly', () => {
    it('demonstrates that adding a topping sharing an ingredient properly reduces available cups', () => {
      const sizeOnly: RecipeRequirementItem[] = [
        {
          ingredientId: 'ing-milk',
          stock: new Prisma.Decimal('900.000'),
          amount: new Prisma.Decimal('100.000'), // 900 / 100 = 9
        },
      ];
      expect(calculateRecipeCapacity(sizeOnly)).toBe(9);

      const sizeWithTopping: RecipeRequirementItem[] = [
        ...sizeOnly,
        {
          ingredientId: 'ing-milk',
          stock: new Prisma.Decimal('900.000'),
          amount: new Prisma.Decimal('50.000'), // Topping extra milk: 100 + 50 = 150 -> 900 / 150 = 6
        },
      ];
      expect(calculateRecipeCapacity(sizeWithTopping)).toBe(6);
    });
  });

  describe('H. Multiple Distinct Ingredients Bottleneck', () => {
    it('takes the lowest capacity across all distinct ingredients', () => {
      const input: RecipeRequirementItem[] = [
        {
          ingredientId: 'ing-tea-leaves',
          stock: new Prisma.Decimal('1000.000'),
          amount: new Prisma.Decimal('20.000'), // 1000 / 20 = 50
        },
        {
          ingredientId: 'ing-peach-syrup',
          stock: new Prisma.Decimal('200.000'),
          amount: new Prisma.Decimal('25.000'), // 200 / 25 = 8 (bottleneck)
        },
        {
          ingredientId: 'ing-peach-slice',
          stock: new Prisma.Decimal('30.000'),
          amount: new Prisma.Decimal('3.000'), // 30 / 3 = 10
        },
      ];

      expect(calculateRecipeCapacity(input)).toBe(8);
    });
  });

  describe('I. Empty Input Handling', () => {
    it('returns safe 0 for empty array, never Infinity or NaN', () => {
      expect(calculateRecipeCapacity([])).toBe(0);
    });

    it('returns safe 0 for null/undefined cast, never throws', () => {
      expect(calculateRecipeCapacity(null as unknown as RecipeRequirementItem[])).toBe(0);
      expect(calculateRecipeCapacity(undefined as unknown as RecipeRequirementItem[])).toBe(0);
    });
  });

  describe('J. Zero Required Amount Rejection', () => {
    it('rejects required amount = 0 with InvalidRecipeAmountError and prevents division by zero', () => {
      const input: RecipeRequirementItem[] = [
        {
          ingredientId: 'ing-water',
          stock: new Prisma.Decimal('1000.000'),
          amount: new Prisma.Decimal('0.000'),
        },
      ];

      expect(() => calculateRecipeCapacity(input)).toThrow(InvalidRecipeAmountError);
      expect(() => calculateRecipeCapacity(input)).toThrow('strictly positive (> 0)');
    });
  });

  describe('K. Negative Required Amount Rejection', () => {
    it('rejects negative required amount with InvalidRecipeAmountError', () => {
      const input: RecipeRequirementItem[] = [
        {
          ingredientId: 'ing-coffee',
          stock: new Prisma.Decimal('500.000'),
          amount: new Prisma.Decimal('-10.000'),
        },
      ];

      expect(() => calculateRecipeCapacity(input)).toThrow(InvalidRecipeAmountError);
    });
  });

  describe('L. Negative Stock Rejection', () => {
    it('rejects negative stock with NegativeStockError', () => {
      const input: RecipeRequirementItem[] = [
        {
          ingredientId: 'ing-coffee',
          stock: new Prisma.Decimal('-50.000'),
          amount: new Prisma.Decimal('20.000'),
        },
      ];

      expect(() => calculateRecipeCapacity(input)).toThrow(NegativeStockError);
      expect(() => calculateRecipeCapacity(input)).toThrow('stock cannot be negative');
    });
  });

  describe('M. Input Immutability', () => {
    it('does not mutate input array or objects (verified with Object.freeze)', () => {
      const item1 = Object.freeze({
        ingredientId: 'ing-coffee',
        stock: new Prisma.Decimal('500.000'),
        amount: new Prisma.Decimal('25.000'),
      });
      const item2 = Object.freeze({
        ingredientId: 'ing-milk',
        stock: new Prisma.Decimal('1000.000'),
        amount: new Prisma.Decimal('100.000'),
      });
      const input = Object.freeze([item1, item2]);

      const result = calculateRecipeCapacity(input);
      expect(result).toBe(10);
      expect(item1.stock.toString()).toBe('500');
      expect(item2.stock.toString()).toBe('1000');
    });
  });

  describe('N. Very Large Values & Overflow Policy', () => {
    it('safely caps capacity at Number.MAX_SAFE_INTEGER when result exceeds safe integer range', () => {
      const input: RecipeRequirementItem[] = [
        {
          ingredientId: 'ing-massive',
          stock: new Prisma.Decimal('1e30'),
          amount: new Prisma.Decimal('1.000'),
        },
      ];

      const capacity = calculateRecipeCapacity(input);
      expect(capacity).toBe(Number.MAX_SAFE_INTEGER);
      expect(Number.isSafeInteger(capacity)).toBe(true);
    });

    it('returns exact value when capacity is within Number.MAX_SAFE_INTEGER', () => {
      const input: RecipeRequirementItem[] = [
        {
          ingredientId: 'ing-big',
          stock: new Prisma.Decimal('1000000000.000'),
          amount: new Prisma.Decimal('2.000'),
        },
      ];

      const capacity = calculateRecipeCapacity(input);
      expect(capacity).toBe(500000000);
    });
  });

  describe('O. Idempotency & Determinism', () => {
    it('returns identical result across repeated calls with identical input', () => {
      const input: RecipeRequirementItem[] = [
        {
          ingredientId: 'ing-1',
          stock: new Prisma.Decimal('1234.560'),
          amount: new Prisma.Decimal('12.340'),
        },
      ];

      const call1 = calculateRecipeCapacity(input);
      const call2 = calculateRecipeCapacity(input);
      const call3 = calculateRecipeCapacity(input);

      expect(call1).toBe(100);
      expect(call2).toBe(100);
      expect(call3).toBe(100);
    });
  });

  describe('P. Pure In-Memory Execution', () => {
    it('executes synchronously in memory without requiring database connections or services', () => {
      const input: RecipeRequirementItem[] = [
        {
          ingredientId: 'ing-pure',
          stock: new Prisma.Decimal('100.000'),
          amount: new Prisma.Decimal('10.000'),
        },
      ];

      const startTime = Date.now();
      const capacity = calculateRecipeCapacity(input);
      const duration = Date.now() - startTime;

      expect(capacity).toBe(10);
      expect(duration).toBeLessThan(50);
    });
  });

  describe('Additional Robustness & Edge Cases', () => {
    it('rejects inconsistent stock snapshots for the same ingredientId', () => {
      const input: RecipeRequirementItem[] = [
        {
          ingredientId: 'ing-coffee',
          stock: new Prisma.Decimal('360.000'),
          amount: new Prisma.Decimal('20.000'),
        },
        {
          ingredientId: 'ing-coffee',
          stock: new Prisma.Decimal('400.000'), // Different stock for same ingredient!
          amount: new Prisma.Decimal('10.000'),
        },
      ];

      expect(() => calculateRecipeCapacity(input)).toThrow(InconsistentStockError);
      expect(() => calculateRecipeCapacity(input)).toThrow('Inconsistent stock snapshot');
    });

    it('rejects blank or empty ingredientId', () => {
      const input: RecipeRequirementItem[] = [
        {
          ingredientId: '   ',
          stock: new Prisma.Decimal('100.000'),
          amount: new Prisma.Decimal('10.000'),
        },
      ];

      expect(() => calculateRecipeCapacity(input)).toThrow(RecipeCapacityError);
      expect(() => calculateRecipeCapacity(input)).toThrow('Invalid ingredientId');
    });

    it('supports string and number representations in RecipeRequirementItem', () => {
      const input: RecipeRequirementItem[] = [
        {
          ingredientId: 'ing-mix',
          stock: '250.000',
          amount: 25,
        },
      ];

      expect(calculateRecipeCapacity(input)).toBe(10);
    });

    it('rejects unparseable decimal strings', () => {
      const input: RecipeRequirementItem[] = [
        {
          ingredientId: 'ing-bad',
          stock: 'not-a-number',
          amount: new Prisma.Decimal('10.000'),
        },
      ];

      expect(() => calculateRecipeCapacity(input)).toThrow(RecipeCapacityError);
      expect(() => calculateRecipeCapacity(input)).toThrow('Invalid decimal value for stock');
    });

    it('exports calculateOptionCapacity as an alias for backward compatibility', () => {
      expect(calculateOptionCapacity).toBe(calculateRecipeCapacity);
    });
  });
});
