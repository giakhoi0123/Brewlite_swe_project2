import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ValidatePromotionDto } from './dto/validate-promotion.dto';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { DiscountType, OrderStatus, Prisma } from '@prisma/client';

export type PromotionDatabaseClient =
  | Pick<PrismaService, 'promotion'>
  | PrismaService
  | Prisma.TransactionClient;

@Injectable()
export class PromotionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePromotionDto) {
    const existing = await this.prisma.promotion.findUnique({
      where: { code: dto.code.toUpperCase() },
    });

    if (existing) {
      throw new BadRequestException('Mã khuyến mãi đã tồn tại');
    }

    return this.prisma.promotion.create({
      data: {
        ...dto,
        code: dto.code.toUpperCase(),
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
      },
    });
  }

  async findAllActive(userId?: string) {
    const now = new Date();
    const promotions = await this.prisma.promotion.findMany({
      where: {
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
      },
      select: {
        id: true,
        code: true,
        description: true,
        discountType: true,
        discountValue: true,
        minOrderAmount: true,
        maxDiscount: true,
        endDate: true,
        usageLimit: true,
        usedCount: true,
      },
    });

    // 1. Loại bỏ các mã đã hết tổng lượt sử dụng trên toàn hệ thống
    let availablePromotions = promotions.filter(
      (promo) =>
        promo.usageLimit === null || promo.usedCount < promo.usageLimit,
    );

    // 2. Nếu có userId, ẩn luôn các mã mà khách hàng này đã từng áp dụng
    if (userId && availablePromotions.length > 0) {
      const usedOrders = await this.prisma.order.findMany({
        where: {
          userId,
          promotionId: {
            in: availablePromotions.map((p) => p.id),
          },
          status: {
            notIn: [OrderStatus.CANCELLED, OrderStatus.PAYMENT_FAILED],
          },
        },
        select: { promotionId: true },
      });

      const usedPromotionIds = new Set(
        usedOrders
          .map((o) => o.promotionId)
          .filter((id): id is string => id !== null),
      );

      availablePromotions = availablePromotions.filter(
        (promo) => !usedPromotionIds.has(promo.id),
      );
    }

    return availablePromotions.map((promotion) => {
      const responsePromotion = { ...promotion };
      Reflect.deleteProperty(responsePromotion, 'usageLimit');
      Reflect.deleteProperty(responsePromotion, 'usedCount');
      return responsePromotion;
    });
  }

  async validateAndCalculateDiscount(
    dto: ValidatePromotionDto,
    db: PromotionDatabaseClient = this.prisma,
    userId?: string,
  ) {
    const code = dto.code.toUpperCase();
    const promotion = await db.promotion.findUnique({
      where: { code },
    });

    if (!promotion || !promotion.isActive) {
      throw new NotFoundException(
        'Mã khuyến mãi không tồn tại hoặc đã bị vô hiệu hóa',
      );
    }

    // Cộng thêm 1 phút buffer vào now để tránh lệch millisecond/múi giờ khi vừa tạo mã xong
    const now = new Date();
    const validFrom = new Date(now.getTime() + 60 * 1000);

    if (validFrom < promotion.startDate || now > promotion.endDate) {
      throw new BadRequestException(
        'Mã khuyến mãi chưa đến hạn hoặc đã hết hạn sử dụng',
      );
    }

    if (
      promotion.usageLimit !== null &&
      promotion.usedCount >= promotion.usageLimit
    ) {
      throw new BadRequestException('Mã khuyến mãi đã hết lượt sử dụng');
    }

    // Chặn 1 khách hàng sử dụng lại mã khuyến mãi đã dùng ở đơn hợp lệ trước đó
    if (userId && 'order' in db && db.order) {
      const existingUsage = await db.order.findFirst({
        where: {
          userId,
          promotionId: promotion.id,
          status: {
            notIn: [OrderStatus.CANCELLED, OrderStatus.PAYMENT_FAILED],
          },
        },
        select: { id: true },
      });

      if (existingUsage) {
        throw new BadRequestException('Bạn đã sử dụng mã khuyến mãi này rồi');
      }
    }

    const orderAmount = dto.orderAmount;
    const minOrderAmount = Number(promotion.minOrderAmount);

    if (orderAmount < minOrderAmount) {
      throw new BadRequestException(
        `Đơn hàng chưa đạt giá trị tối thiểu ${minOrderAmount.toLocaleString('vi-VN')} VNĐ`,
      );
    }

    let discountAmount = 0;
    const discountValue = Number(promotion.discountValue);

    if (promotion.discountType === DiscountType.PERCENTAGE) {
      discountAmount = (orderAmount * discountValue) / 100;
      if (promotion.maxDiscount !== null) {
        const maxDiscount = Number(promotion.maxDiscount);
        if (discountAmount > maxDiscount) {
          discountAmount = maxDiscount;
        }
      }
    } else if (promotion.discountType === DiscountType.FIXED_AMOUNT) {
      discountAmount = discountValue;
    }

    if (discountAmount > orderAmount) {
      discountAmount = orderAmount;
    }

    const finalAmount = orderAmount - discountAmount;

    return {
      promotionId: promotion.id,
      code: promotion.code,
      discountType: promotion.discountType,
      discountValue,
      originalAmount: orderAmount,
      discountAmount,
      finalAmount,
    };
  }
}
