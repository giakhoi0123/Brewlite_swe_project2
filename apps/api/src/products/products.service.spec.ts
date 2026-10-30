import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { ProductsRepository } from './products.repository';
import { NotFoundException } from '@nestjs/common';
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
});
