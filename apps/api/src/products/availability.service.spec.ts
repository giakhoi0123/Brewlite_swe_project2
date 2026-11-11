import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AvailabilityService } from './availability.service';
import { PrismaService } from '../prisma/prisma.service';
import * as recipeHelper from './helpers/recipe-capacity.helper';

const decimal = (n: number | string) => new Prisma.Decimal(n);

describe('AvailabilityService', () => {
  const item = (
    sizeId: string,
    quantity: number,
    toppingIds: string[] = [],
    productId = 'coffee',
  ) => ({ productId, sizeId, toppingIds, quantity });

  const option = (
    id: string,
    type: string,
    amount: number,
    stock = 1000,
    ingredientId = 'milk',
  ) => ({
    id,
    type,
    recipes: [
      {
        ingredientId,
        amount: decimal(amount),
        ingredient: { id: ingredientId, name: ingredientId, stock: decimal(stock) },
      },
    ],
  });

  function service(isAvailable = true, customOptions?: any[]) {
    const options = customOptions ?? [
      option('M', 'SIZE', 100),
      option('L', 'SIZE', 150),
      option('cream', 'TOPPING', 50),
    ];

    return new AvailabilityService({
      product: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'coffee',
            isAvailable,
            options,
          },
        ]),
      },
    } as unknown as PrismaService);
  }

  // --- 1. Tests hiện hành từ main ---
  it('calculates different capacities for sizes', async () => {
    expect((await service().check({ items: [item('M', 1)] })).items[0].availableQuantity).toBe(10);
    expect((await service().check({ items: [item('L', 1)] })).items[0].availableQuantity).toBe(6);
  });

  it('combines size and topping consumption of the same ingredient', async () => {
    expect((await service().check({ items: [item('M', 7, ['cream'])] })).canOrder).toBe(false);
  });

  it('rejects a cart whose lines independently fit but collectively exceed stock', async () => {
    const result = await service().check({ items: [item('M', 5), item('L', 4)] });
    expect(result.canOrder).toBe(false);
    expect(result.items.map((i) => i.availableQuantity)).toEqual([4, 3]);
  });

  it('blocks disabled products and foreign options', async () => {
    expect((await service(false).check({ items: [item('M', 1)] })).canOrder).toBe(false);
    await expect(service().check({ items: [item('foreign', 1)] })).rejects.toThrow();
  });

  // --- 2. Tests kiểm soát exception semantics và an toàn tồn kho ---

  it('returns availableQuantity = 0 without throwing when other lines completely consume ingredients (remaining = 0)', async () => {
    // Stock sữa = 1000. Dòng 1 yêu cầu 10 ly Size M (10 * 100 = 1000). Dòng 2 yêu cầu 1 ly (100ml).
    // Dòng 1: sau khi trừ Dòng 2 (100ml), còn 900ml => availableQuantity = 9 ly.
    // Dòng 2: sau khi trừ Dòng 1 (1000ml), còn 0ml => availableQuantity = 0 ly, không throw lỗi.
    const result = await service().check({
      items: [item('M', 10), item('M', 1)],
    });

    expect(result.canOrder).toBe(false);
    expect(result.items[0].availableQuantity).toBe(9);
    expect(result.items[0].canOrder).toBe(false);
    expect(result.items[1].availableQuantity).toBe(0);
    expect(result.items[1].canOrder).toBe(false);
  });

  it('returns availableQuantity = 0 without HTTP 500 when other lines exceed available stock (remaining < 0)', async () => {
    // Stock sữa = 1000. Dòng 1 yêu cầu 15 ly Size M (15 * 100 = 1500 > 1000). Dòng 2 yêu cầu 1 ly (100ml).
    // Dòng 1: sau khi trừ Dòng 2 (100ml), còn 900ml => capacity = 9 ly.
    // Dòng 2: sau khi trừ Dòng 1 (1500ml), remaining = 1000 - 1500 = -500.
    // Phải trả về availableQuantity = 0 mà không ném lỗi 500 hay biến thành lỗi hệ thống.
    const result = await service().check({
      items: [item('M', 15), item('M', 1)],
    });

    expect(result.canOrder).toBe(false);
    expect(result.items[0].availableQuantity).toBe(9);
    expect(result.items[0].canOrder).toBe(false);
    expect(result.items[1].availableQuantity).toBe(0);
    expect(result.items[1].canOrder).toBe(false);
  });

  it('returns correct bottleneck capacity when remaining stock is positive across multiple ingredients', async () => {
    // 2 nguyên liệu: Cà phê (stock 500, cần 25 => 20 ly) và Sữa (stock 1000, cần 100 => 10 ly)
    // Bottleneck phải là 10 ly
    const multiIngredientOption = {
      id: 'M_MULTI',
      type: 'SIZE',
      recipes: [
        {
          ingredientId: 'coffee_beans',
          amount: decimal(25),
          ingredient: { id: 'coffee_beans', name: 'Coffee Beans', stock: decimal(500) },
        },
        {
          ingredientId: 'milk',
          amount: decimal(100),
          ingredient: { id: 'milk', name: 'Milk', stock: decimal(1000) },
        },
      ],
    };

    const s = service(true, [multiIngredientOption]);
    const result = await s.check({ items: [item('M_MULTI', 2)] });

    expect(result.canOrder).toBe(true);
    expect(result.items[0].availableQuantity).toBe(10);
  });

  it('throws BadRequestException when recipe amount is <= 0', async () => {
    const invalidOption = {
      id: 'M_INVALID',
      type: 'SIZE',
      recipes: [
        {
          ingredientId: 'milk',
          amount: decimal(0), // Lỗi công thức
          ingredient: { id: 'milk', name: 'Milk', stock: decimal(1000) },
        },
      ],
    };

    const s = service(true, [invalidOption]);
    await expect(s.check({ items: [item('M_INVALID', 1)] })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('throws InternalServerErrorException when database stock is negative without leaking sensitive data', async () => {
    const negativeStockOption = {
      id: 'M_NEG_STOCK',
      type: 'SIZE',
      recipes: [
        {
          ingredientId: 'secret_ingredient_x',
          amount: decimal(100),
          ingredient: { id: 'secret_ingredient_x', name: 'Secret Milk', stock: decimal(-50) },
        },
      ],
    };

    const s = service(true, [negativeStockOption]);
    try {
      await s.check({ items: [item('M_NEG_STOCK', 1)] });
      throw new Error('Expected test to throw InternalServerErrorException');
    } catch (error: any) {
      expect(error).toBeInstanceOf(InternalServerErrorException);
      expect(error.message).toBe('Lỗi dữ liệu tồn kho hệ thống.');
      expect(error.message).not.toContain('secret_ingredient_x');
      expect(error.message).not.toContain('-50');
    }
  });

  it('throws InternalServerErrorException when stock snapshots are inconsistent', async () => {
    const option1 = {
      id: 'M1',
      type: 'SIZE',
      recipes: [
        {
          ingredientId: 'milk',
          amount: decimal(100),
          ingredient: { id: 'milk', name: 'Milk', stock: decimal(1000) },
        },
      ],
    };
    const option2 = {
      id: 'TOP_INCONSISTENT',
      type: 'TOPPING',
      recipes: [
        {
          ingredientId: 'milk',
          amount: decimal(50),
          ingredient: { id: 'milk', name: 'Milk', stock: decimal(800) }, // Khác 1000
        },
      ],
    };

    const s = service(true, [option1, option2]);
    await expect(
      s.check({ items: [item('M1', 1, ['TOP_INCONSISTENT'])] }),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('rethrows unexpected unknown errors without converting them to BadRequestException', async () => {
    const spy = jest
      .spyOn(recipeHelper, 'calculateRecipeCapacity')
      .mockImplementationOnce(() => {
        throw new Error('Simulated unexpected memory or database fault');
      });

    const s = service();
    try {
      await s.check({ items: [item('M', 1)] });
      throw new Error('Expected test to rethrow unknown error');
    } catch (error: any) {
      expect(error).not.toBeInstanceOf(BadRequestException);
      expect(error.message).toBe('Simulated unexpected memory or database fault');
    } finally {
      spy.mockRestore();
    }
  });
});
