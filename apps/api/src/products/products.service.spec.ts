import { NotFoundException } from '@nestjs/common';
import { Prisma, OptionType } from '@prisma/client';
import { ProductsService } from './products.service';
import { ProductsRepository } from './products.repository';

describe('ProductsService ingredient availability', () => {
  const product = {
    id: 'coffee', name: 'Coffee', basePrice: new Prisma.Decimal(25000), imageUrl: '/coffee.jpg',
    isAvailable: true, createdAt: new Date(), updatedAt: new Date(), inventory: null,
    options: [{ id: 'M', productId: 'coffee', type: OptionType.SIZE, name: 'M', extraPrice: new Prisma.Decimal(0), createdAt: new Date(),
      recipes: [{ productOptionId: 'M', ingredientId: 'milk', amount: new Prisma.Decimal(100), ingredient: { id: 'milk', name: 'Milk', stock: new Prisma.Decimal(1000) } }] }],
  };
  const repository = { findMany: jest.fn(), findById: jest.fn() };
  const service = new ProductsService(repository as unknown as ProductsRepository);
  it('allows ordering with ingredients even without legacy inventory', async () => {
    repository.findMany.mockResolvedValue([product]);
    expect((await service.findAll({}))[0].canOrder).toBe(true);
    repository.findById.mockResolvedValue(product);
    expect((await service.findOne('coffee')).inventory).toEqual({ quantity: 10, reserved: 0, availableStock: 10 });
  });
  it('blocks missing recipes and disabled products', async () => {
    repository.findMany.mockResolvedValue([{ ...product, options: [] }, { ...product, isAvailable: false }]);
    expect((await service.findAll({})).map(p => p.canOrder)).toEqual([false, false]);
  });
  it('returns not found', async () => {
    repository.findById.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });
});
