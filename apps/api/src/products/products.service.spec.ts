import { NotFoundException } from '@nestjs/common';
import { Prisma, OptionType } from '@prisma/client';
import { ProductsService } from './products.service';
import { ProductsRepository } from './products.repository';

describe('ProductsService', () => {
  let repository: {
    findMany: jest.Mock;
    findById: jest.Mock;
  };
  let service: ProductsService;

  const mockProduct = {
    id: 'a0000000-0000-0000-0000-000000000001',
    name: 'Cà phê đen đá',
    basePrice: new Prisma.Decimal(25000),
    imageUrl: 'https://example.com/black-coffee.jpg',
    isAvailable: true,
    options: [
      {
        id: 'b0000000-0000-0000-0000-000000000001',
        productId: 'a0000000-0000-0000-0000-000000000001',
        type: OptionType.SIZE,
        name: 'Size M',
        extraPrice: new Prisma.Decimal(0),
        createdAt: new Date('2026-10-31T00:00:00.000Z'),
        recipes: [
          {
            productOptionId: 'b0000000-0000-0000-0000-000000000001',
            ingredientId: 'milk',
            amount: new Prisma.Decimal(100),
            ingredient: {
              id: 'milk',
              name: 'Milk',
              stock: new Prisma.Decimal(1000),
            },
          },
        ],
      },
    ],
    createdAt: new Date('2026-10-31T00:00:00.000Z'),
    updatedAt: new Date('2026-10-31T00:00:00.000Z'),
  };

  beforeEach(() => {
    repository = {
      findMany: jest.fn(),
      findById: jest.fn(),
    };
    service = new ProductsService(repository as unknown as ProductsRepository);
  });

  describe('findAll', () => {
    it('should return a list of mapped products with canOrder based on recipe capacity', async () => {
      repository.findMany.mockResolvedValue([mockProduct]);

      const result = await service.findAll({});

      expect(repository.findMany).toHaveBeenCalledWith(undefined);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: mockProduct.id,
        name: 'Cà phê đen đá',
        basePrice: 25000,
        imageUrl: mockProduct.imageUrl,
        isAvailable: true,
        canOrder: true,
        createdAt: '2026-10-31T00:00:00.000Z',
      });
    });

    it('should pass search query to repository and handle case-insensitive search', async () => {
      repository.findMany.mockResolvedValue([mockProduct]);

      const result = await service.findAll({ search: 'đen' });

      expect(repository.findMany).toHaveBeenCalledWith('đen');
      expect(result).toHaveLength(1);
    });

    it('should return an empty array when no products match without throwing error', async () => {
      repository.findMany.mockResolvedValue([]);

      const result = await service.findAll({ search: 'KhôngTồnTại' });

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return mapped product detail with options and recipe inventory', async () => {
      repository.findById.mockResolvedValue(mockProduct);

      const result = await service.findOne(mockProduct.id);

      expect(repository.findById).toHaveBeenCalledWith(mockProduct.id);
      expect(result).toEqual({
        id: mockProduct.id,
        name: 'Cà phê đen đá',
        basePrice: 25000,
        imageUrl: mockProduct.imageUrl,
        isAvailable: true,
        canOrder: true,
        createdAt: '2026-10-31T00:00:00.000Z',
        options: [
          {
            id: 'b0000000-0000-0000-0000-000000000001',
            type: OptionType.SIZE,
            name: 'Size M',
            extraPrice: 0,
          },
        ],
        inventory: {
          quantity: 10,
          reserved: 0,
          availableStock: 10,
        },
      });
    });

    it('should throw NotFoundException when product is not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('ingredient availability & recipe capacity (tests from main)', () => {
    const product = {
      id: 'coffee',
      name: 'Coffee',
      basePrice: new Prisma.Decimal(25000),
      imageUrl: '/coffee.jpg',
      isAvailable: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      options: [
        {
          id: 'M',
          productId: 'coffee',
          type: OptionType.SIZE,
          name: 'M',
          extraPrice: new Prisma.Decimal(0),
          createdAt: new Date(),
          recipes: [
            {
              productOptionId: 'M',
              ingredientId: 'milk',
              amount: new Prisma.Decimal(100),
              ingredient: { id: 'milk', name: 'Milk', stock: new Prisma.Decimal(1000) },
            },
          ],
        },
      ],
    };

    it('allows ordering with ingredients without legacy database inventory', async () => {
      repository.findMany.mockResolvedValue([product]);
      expect((await service.findAll({}))[0].canOrder).toBe(true);

      repository.findById.mockResolvedValue(product);
      expect((await service.findOne('coffee')).inventory).toEqual({
        quantity: 10,
        reserved: 0,
        availableStock: 10,
      });
    });

    it('calculates capacity based on bottleneck ingredient', async () => {
      const bottleneckProduct = {
        ...product,
        options: [
          {
            ...product.options[0],
            recipes: [
              {
                productOptionId: 'M',
                ingredientId: 'milk',
                amount: new Prisma.Decimal(100),
                ingredient: { id: 'milk', name: 'Milk', stock: new Prisma.Decimal(1000) }, // 10 servings
              },
              {
                productOptionId: 'M',
                ingredientId: 'beans',
                amount: new Prisma.Decimal(30),
                ingredient: { id: 'beans', name: 'Beans', stock: new Prisma.Decimal(120) }, // 4 servings (bottleneck)
              },
            ],
          },
        ],
      };

      repository.findById.mockResolvedValue(bottleneckProduct);
      const detail = await service.findOne('coffee');
      expect(detail.canOrder).toBe(true);
      expect(detail.inventory).toEqual({
        quantity: 4,
        reserved: 0,
        availableStock: 4,
      });
    });

    it('blocks missing recipes and disabled products', async () => {
      repository.findMany.mockResolvedValue([
        { ...product, options: [{ ...product.options[0], recipes: [] }] },
      ]);
      expect((await service.findAll({}))[0].canOrder).toBe(false);

      repository.findById.mockResolvedValue({
        ...product,
        options: [{ ...product.options[0], recipes: [] }],
      });
      const noRecipeDetail = await service.findOne('coffee');
      expect(noRecipeDetail.canOrder).toBe(false);
      expect(noRecipeDetail.inventory).toEqual({
        quantity: 0,
        reserved: 0,
        availableStock: 0,
      });

      repository.findMany.mockResolvedValue([{ ...product, isAvailable: false }]);
      expect((await service.findAll({}))[0].canOrder).toBe(false);
    });
  });
});
