import { AvailabilityService } from './availability.service';
import { Test, TestingModule } from '@nestjs/testing';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { OptionType } from '@prisma/client';

describe('ProductsController', () => {
  let controller: ProductsController;
  let service: jest.Mocked<ProductsService>;

  const mockProductResponse = {
    id: 'a0000000-0000-0000-0000-000000000001',
    name: 'Cà phê đen đá',
    basePrice: 25000,
    imageUrl: 'https://example.com/image.jpg',
    isAvailable: true,
    canOrder: true,
    createdAt: '2026-10-31T00:00:00.000Z',
  };

  const mockProductDetailResponse = {
    ...mockProductResponse,
    options: [
      {
        id: 'b0000000-0000-0000-0000-000000000001',
        type: OptionType.SIZE,
        name: 'Size L',
        extraPrice: 6000,
      },
    ],
    inventory: {
      quantity: 100,
      reserved: 10,
      availableStock: 90,
    },
  };

  beforeEach(async () => {
    const mockService = {
      findAll: jest.fn(),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [{ provide: AvailabilityService, useValue: { check: jest.fn() } },
        {
          provide: ProductsService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<ProductsController>(ProductsController);
    service = module.get(ProductsService);
  });

  describe('getProducts', () => {
    it('should return an array of products', async () => {
      service.findAll.mockResolvedValue([mockProductResponse]);

      const result = await controller.getProducts({});

      expect(service.findAll).toHaveBeenCalledWith({});
      expect(result).toEqual([mockProductResponse]);
    });

    it('should forward search query to service', async () => {
      service.findAll.mockResolvedValue([mockProductResponse]);

      const result = await controller.getProducts({ search: 'cà phê' });

      expect(service.findAll).toHaveBeenCalledWith({ search: 'cà phê' });
      expect(result).toEqual([mockProductResponse]);
    });
  });

  describe('getProductById', () => {
    it('should return product detail by id', async () => {
      service.findOne.mockResolvedValue(mockProductDetailResponse);

      const result = await controller.getProductById('a0000000-0000-0000-0000-000000000001');

      expect(service.findOne).toHaveBeenCalledWith('a0000000-0000-0000-0000-000000000001');
      expect(result).toEqual(mockProductDetailResponse);
    });
  });
});
