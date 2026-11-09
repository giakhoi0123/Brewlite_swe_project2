import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { ProductsRepository } from './products.repository';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { OptionType, Prisma } from '@prisma/client';

describe('ProductsService', () => {
  let service: ProductsService;
  let repository: jest.Mocked<ProductsRepository>;

  const mockProduct = {
    id: 'a0000000-0000-0000-0000-000000000001',
    name: 'Cà phê đen đá',
    basePrice: new Prisma.Decimal(25000),
    imageUrl: 'https://example.com/black-coffee.jpg',
    isAvailable: true,
    inventory: { quantity: 8, reserved: 3 },
    createdAt: new Date('2026-10-31T00:00:00.000Z'),
    updatedAt: new Date('2026-10-31T00:00:00.000Z'),
  };

  const mockProductWithDetails = {
    ...mockProduct,
    options: [
      {
        id: 'b0000000-0000-0000-0000-000000000001',
        productId: mockProduct.id,
        type: OptionType.SIZE,
        name: 'Size L',
        extraPrice: new Prisma.Decimal(6000),
        createdAt: new Date('2026-10-31T00:00:00.000Z'),
      },
    ],
    inventory: {
      id: 'c0000000-0000-0000-0000-000000000001',
      productId: mockProduct.id,
      quantity: 100,
      reserved: 10,
      updatedAt: new Date('2026-10-31T00:00:00.000Z'),
    },
  };

  beforeEach(async () => {
    const mockRepo = {
      findMany: jest.fn(),
      findById: jest.fn(),
      findProductWithOptionsAndRecipes: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: ProductsRepository,
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    repository = module.get(ProductsRepository);
  });

  describe('findAll', () => {
    it('should return a list of mapped products', async () => {
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

  describe('orderability across catalog, search and detail', () => {
    it.each([
      { label: 'available stock', isAvailable: true, inventory: { quantity: 8, reserved: 3 }, canOrder: true, stock: 5 },
      { label: 'zero stock', isAvailable: true, inventory: { quantity: 0, reserved: 0 }, canOrder: false, stock: 0 },
      { label: 'fully reserved physical stock', isAvailable: true, inventory: { quantity: 8, reserved: 8 }, canOrder: false, stock: 0 },
      { label: 'sale disabled with stock', isAvailable: false, inventory: { quantity: 8, reserved: 0 }, canOrder: false, stock: 8 },
      { label: 'missing inventory', isAvailable: true, inventory: null, canOrder: false, stock: null },
      { label: 'reservations exceed quantity', isAvailable: true, inventory: { quantity: 3, reserved: 8 }, canOrder: false, stock: 0 },
    ])('$label', async ({ isAvailable, inventory, canOrder, stock }) => {
      const product = { ...mockProductWithDetails, isAvailable, inventory };
      repository.findMany.mockResolvedValue([product]);
      repository.findById.mockResolvedValue(product);

      const list = await service.findAll({});
      const search = await service.findAll({ search: product.name });
      const detail = await service.findOne(product.id);

      for (const response of [list[0], search[0], detail]) {
        expect(response).toMatchObject({ id: product.id, isAvailable, canOrder });
      }
      expect(detail.inventory).toEqual(
        inventory ? { ...inventory, availableStock: stock } : null,
      );
      expect(repository.findMany).toHaveBeenNthCalledWith(1, undefined);
      expect(repository.findMany).toHaveBeenNthCalledWith(2, product.name);
    });
  });

  describe('findOne', () => {
    it('should return product details including options and calculated available stock', async () => {
      repository.findById.mockResolvedValue(mockProductWithDetails);

      const result = await service.findOne(mockProduct.id);

      expect(repository.findById).toHaveBeenCalledWith(mockProduct.id);
      expect(result.id).toBe(mockProduct.id);
      expect(result.basePrice).toBe(25000);
      expect(result.options).toHaveLength(1);
      expect(result.options[0]).toEqual({
        id: 'b0000000-0000-0000-0000-000000000001',
        type: OptionType.SIZE,
        name: 'Size L',
        extraPrice: 6000,
      });
      expect(result.inventory).toEqual({
        quantity: 100,
        reserved: 10,
        availableStock: 90,
      });
    });

    it('should throw NotFoundException when product does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findOne('non-existent-uuid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('checkAvailability', () => {
    const validProductId = 'a0000000-0000-0000-0000-000000000001';
    const sizeMId = 'b0000000-0000-0000-0000-000000000001';
    const sizeLId = 'b0000000-0000-0000-0000-000000000002';
    const toppingId = 'b0000000-0000-0000-0000-000000000003';
    const coffeeIngId = 'd0000000-0000-4000-8000-000000000001';
    const jellyIngId = 'd0000000-0000-4000-8000-000000000009';

    it('throws NotFoundException when product does not exist', async () => {
      repository.findProductWithOptionsAndRecipes.mockResolvedValue(null);

      await expect(
        service.checkAvailability('non-existent-id', { selectedOptions: [sizeMId] }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when an option does not belong to the product', async () => {
      repository.findProductWithOptionsAndRecipes.mockResolvedValue({
        id: validProductId,
        isAvailable: true,
        options: [
          {
            id: sizeMId,
            productId: validProductId,
            type: OptionType.SIZE,
            recipes: [],
          },
        ],
      });

      await expect(
        service.checkAvailability(validProductId, {
          selectedOptions: [sizeMId, 'alien-option-id'],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when selectedOptions contains duplicate IDs', async () => {
      await expect(
        service.checkAvailability(validProductId, {
          selectedOptions: [sizeMId, sizeMId],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.findProductWithOptionsAndRecipes).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when no SIZE option is selected', async () => {
      repository.findProductWithOptionsAndRecipes.mockResolvedValue({
        id: validProductId,
        isAvailable: true,
        options: [
          {
            id: toppingId,
            productId: validProductId,
            type: OptionType.TOPPING,
            recipes: [],
          },
        ],
      });

      await expect(
        service.checkAvailability(validProductId, { selectedOptions: [toppingId] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when multiple SIZE options are selected', async () => {
      repository.findProductWithOptionsAndRecipes.mockResolvedValue({
        id: validProductId,
        isAvailable: true,
        options: [
          {
            id: sizeMId,
            productId: validProductId,
            type: OptionType.SIZE,
            recipes: [],
          },
          {
            id: sizeLId,
            productId: validProductId,
            type: OptionType.SIZE,
            recipes: [],
          },
        ],
      });

      await expect(
        service.checkAvailability(validProductId, { selectedOptions: [sizeMId, sizeLId] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('calculates capacity correctly for valid SIZE option', async () => {
      repository.findProductWithOptionsAndRecipes.mockResolvedValue({
        id: validProductId,
        isAvailable: true,
        options: [
          {
            id: sizeMId,
            productId: validProductId,
            type: OptionType.SIZE,
            recipes: [
              {
                amount: new Prisma.Decimal('25.000'),
                ingredient: {
                  id: coffeeIngId,
                  stock: new Prisma.Decimal('500.000'),
                },
              },
            ],
          },
        ],
      });

      const result = await service.checkAvailability(validProductId, {
        selectedOptions: [sizeMId],
      });

      expect(result).toEqual({
        productId: validProductId,
        availableStock: 20,
        canOrder: true,
      });
    });

    it('sums amounts when SIZE and TOPPING share the same ingredient', async () => {
      repository.findProductWithOptionsAndRecipes.mockResolvedValue({
        id: validProductId,
        isAvailable: true,
        options: [
          {
            id: sizeMId,
            productId: validProductId,
            type: OptionType.SIZE,
            recipes: [
              {
                amount: new Prisma.Decimal('20.000'),
                ingredient: { id: coffeeIngId, stock: new Prisma.Decimal('360.000') },
              },
            ],
          },
          {
            id: toppingId,
            productId: validProductId,
            type: OptionType.TOPPING,
            recipes: [
              {
                amount: new Prisma.Decimal('10.000'),
                ingredient: { id: coffeeIngId, stock: new Prisma.Decimal('360.000') },
              },
            ],
          },
        ],
      });

      const result = await service.checkAvailability(validProductId, {
        selectedOptions: [sizeMId, toppingId],
      });

      expect(result.availableStock).toBe(12);
      expect(result.canOrder).toBe(true);
    });

    it('takes the bottleneck capacity across distinct ingredients', async () => {
      repository.findProductWithOptionsAndRecipes.mockResolvedValue({
        id: validProductId,
        isAvailable: true,
        options: [
          {
            id: sizeMId,
            productId: validProductId,
            type: OptionType.SIZE,
            recipes: [
              {
                amount: new Prisma.Decimal('25.000'),
                ingredient: { id: coffeeIngId, stock: new Prisma.Decimal('500.000') },
              },
            ],
          },
          {
            id: toppingId,
            productId: validProductId,
            type: OptionType.TOPPING,
            recipes: [
              {
                amount: new Prisma.Decimal('40.000'),
                ingredient: { id: jellyIngId, stock: new Prisma.Decimal('200.000') },
              },
            ],
          },
        ],
      });

      const result = await service.checkAvailability(validProductId, {
        selectedOptions: [sizeMId, toppingId],
      });

      expect(result.availableStock).toBe(5);
      expect(result.canOrder).toBe(true);
    });

    it('returns capacity = 0 and canOrder = false when an option has no recipes', async () => {
      repository.findProductWithOptionsAndRecipes.mockResolvedValue({
        id: validProductId,
        isAvailable: true,
        options: [
          {
            id: sizeMId,
            productId: validProductId,
            type: OptionType.SIZE,
            recipes: [],
          },
        ],
      });

      const result = await service.checkAvailability(validProductId, {
        selectedOptions: [sizeMId],
      });

      expect(result.availableStock).toBe(0);
      expect(result.canOrder).toBe(false);
    });

    it('returns capacity = 0 and canOrder = false when ingredient stock is 0', async () => {
      repository.findProductWithOptionsAndRecipes.mockResolvedValue({
        id: validProductId,
        isAvailable: true,
        options: [
          {
            id: sizeMId,
            productId: validProductId,
            type: OptionType.SIZE,
            recipes: [
              {
                amount: new Prisma.Decimal('25.000'),
                ingredient: { id: coffeeIngId, stock: new Prisma.Decimal('0.000') },
              },
            ],
          },
        ],
      });

      const result = await service.checkAvailability(validProductId, {
        selectedOptions: [sizeMId],
      });

      expect(result.availableStock).toBe(0);
      expect(result.canOrder).toBe(false);
    });

    it('returns canOrder = false when product.isAvailable is false', async () => {
      repository.findProductWithOptionsAndRecipes.mockResolvedValue({
        id: validProductId,
        isAvailable: false,
        options: [
          {
            id: sizeMId,
            productId: validProductId,
            type: OptionType.SIZE,
            recipes: [
              {
                amount: new Prisma.Decimal('25.000'),
                ingredient: { id: coffeeIngId, stock: new Prisma.Decimal('500.000') },
              },
            ],
          },
        ],
      });

      const result = await service.checkAvailability(validProductId, {
        selectedOptions: [sizeMId],
      });

      expect(result.availableStock).toBe(20);
      expect(result.canOrder).toBe(false);
    });

    it('response contract only contains productId, availableStock, and canOrder', async () => {
      repository.findProductWithOptionsAndRecipes.mockResolvedValue({
        id: validProductId,
        isAvailable: true,
        options: [
          {
            id: sizeMId,
            productId: validProductId,
            type: OptionType.SIZE,
            recipes: [
              {
                amount: new Prisma.Decimal('25.000'),
                ingredient: { id: coffeeIngId, stock: new Prisma.Decimal('500.000') },
              },
            ],
          },
        ],
      });

      const result = await service.checkAvailability(validProductId, {
        selectedOptions: [sizeMId],
      });

      expect(Object.keys(result).sort()).toEqual(
        ['availableStock', 'canOrder', 'productId'].sort(),
      );
      expect(result).not.toHaveProperty('recipes');
      expect(result).not.toHaveProperty('stock');
      expect(result).not.toHaveProperty('version');
    });

    it('does not perform any mutation on repository', async () => {
      repository.findProductWithOptionsAndRecipes.mockResolvedValue({
        id: validProductId,
        isAvailable: true,
        options: [
          {
            id: sizeMId,
            productId: validProductId,
            type: OptionType.SIZE,
            recipes: [
              {
                amount: new Prisma.Decimal('25.000'),
                ingredient: { id: coffeeIngId, stock: new Prisma.Decimal('500.000') },
              },
            ],
          },
        ],
      });

      await service.checkAvailability(validProductId, { selectedOptions: [sizeMId] });

      expect(repository.findMany).not.toHaveBeenCalled();
      expect(repository.findById).not.toHaveBeenCalled();
      expect(repository.findProductWithOptionsAndRecipes).toHaveBeenCalledTimes(1);
    });

    it('maps domain error into BadRequestException', async () => {
      repository.findProductWithOptionsAndRecipes.mockResolvedValue({
        id: validProductId,
        isAvailable: true,
        options: [
          {
            id: sizeMId,
            productId: validProductId,
            type: OptionType.SIZE,
            recipes: [
              {
                amount: new Prisma.Decimal('-10.000'),
                ingredient: { id: coffeeIngId, stock: new Prisma.Decimal('500.000') },
              },
            ],
          },
        ],
      });

      await expect(
        service.checkAvailability(validProductId, { selectedOptions: [sizeMId] }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
