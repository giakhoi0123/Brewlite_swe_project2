import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ValidatePromotionDto } from './dto/validate-promotion.dto';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { DiscountType } from '@prisma/client';

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

  async findAllActive() {
    const now = new Date();
    return this.prisma.promotion.findMany({
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
      },
    });
  }

  async validateAndCalculateDiscount(dto: ValidatePromotionDto) {
    const code = dto.code.toUpperCase();
    const promotion = await this.prisma.promotion.findUnique({
      where: { code },
    });

    if (!promotion || !promotion.isActive) {
      throw new NotFoundException('Mã khuyến mãi không tồn tại hoặc đã bị vô hiệu hóa');
    }

    const now = new Date();
    if (now < promotion.startDate || now > promotion.endDate) {
      throw new BadRequestException('Mã khuyến mãi chưa đến hạn hoặc đã hết hạn sử dụng');
    }

    if (
      promotion.usageLimit !== null &&
      promotion.usedCount >= promotion.usageLimit
    ) {
      throw new BadRequestException('Mã khuyến mãi đã hết lượt sử dụng');
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