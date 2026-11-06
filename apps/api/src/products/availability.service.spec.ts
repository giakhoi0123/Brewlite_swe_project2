import { Prisma } from '@prisma/client';
import { AvailabilityService } from './availability.service';
import { PrismaService } from '../prisma/prisma.service';

const decimal = (n: number) => new Prisma.Decimal(n);
describe('AvailabilityService', () => {
  const item = (sizeId: string, quantity: number, toppingIds: string[] = []) => ({ productId: 'coffee', sizeId, toppingIds, quantity });
  const option = (id: string, type: string, amount: number) => ({ id, type, recipes: [{ ingredientId: 'milk', amount: decimal(amount), ingredient: { stock: decimal(1000) } }] });
  function service(isAvailable = true) {
    return new AvailabilityService({ product: { findMany: jest.fn().mockResolvedValue([{ id: 'coffee', isAvailable, options: [option('M', 'SIZE', 100), option('L', 'SIZE', 150), option('cream', 'TOPPING', 50)] }]) } } as unknown as PrismaService);
  }
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
    expect(result.items.map(i => i.availableQuantity)).toEqual([4, 3]);
  });
  it('blocks disabled products and foreign options', async () => {
    expect((await service(false).check({ items: [item('M', 1)] })).canOrder).toBe(false);
    await expect(service().check({ items: [item('foreign', 1)] })).rejects.toThrow();
  });
});
