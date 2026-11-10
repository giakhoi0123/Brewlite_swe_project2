import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { PromotionsService } from './promotions.service';
import { DiscountType } from '@prisma/client';

describe('PromotionsService', () => {
  let service: PromotionsService;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      promotion: {
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromotionsService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<PromotionsService>(PromotionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('thực hiện tính discount bằng custom transaction client tx khi được truyền vào', async () => {
    const customTxMock: any = {
      promotion: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'promo-uuid-tx',
          code: 'TXDISCOUNT',
          isActive: true,
          startDate: new Date(Date.now() - 3600 * 1000),
          endDate: new Date(Date.now() + 3600 * 1000),
          usageLimit: null,
          usedCount: 0,
          minOrderAmount: 20000,
          discountType: DiscountType.PERCENTAGE,
          discountValue: 10,
          maxDiscount: 15000,
        }),
      },
    };

    const result = await service.validateAndCalculateDiscount(
      { code: 'TXDISCOUNT', orderAmount: 100000 },
      customTxMock,
    );

    expect(customTxMock.promotion.findUnique).toHaveBeenCalledWith({
      where: { code: 'TXDISCOUNT' },
    });
    // Đảm bảo không gọi this.prisma ngoài transaction
    expect(prismaMock.promotion.findUnique).not.toHaveBeenCalled();
    expect(result.discountAmount).toBe(10000);
    expect(result.finalAmount).toBe(90000);
  });
});
