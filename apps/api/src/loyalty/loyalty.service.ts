import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DiscountType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EarnPointsDto } from './dto/earn-points.dto';
import { RedeemPointsDto } from './dto/redeem-points.dto';

@Injectable()
export class LoyaltyService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserLoyaltyInfo(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        loyaltyPoints: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    const history = await this.prisma.loyaltyLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      userId: user.id,
      fullName: user.fullName,
      currentPoints: user.loyaltyPoints,
      history,
    };
  }

  async earnPoints(dto: EarnPointsDto) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: dto.userId } });
      if (!user) {
        throw new NotFoundException('Không tìm thấy người dùng');
      }

      const updatedUser = await tx.user.update({
        where: { id: dto.userId },
        data: { loyaltyPoints: { increment: dto.points } },
      });

      const log = await tx.loyaltyLog.create({
        data: {
          userId: dto.userId,
          points: dto.points,
          reason: dto.description || `Cộng điểm cho đơn hàng ${dto.orderId || ''}`.trim(),
        },
      });

      return {
        userId: updatedUser.id,
        newPointsBalance: updatedUser.loyaltyPoints,
        log,
      };
    });
  }

  async redeemPoints(dto: RedeemPointsDto) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: dto.userId } });
      if (!user) {
        throw new NotFoundException('Không tìm thấy người dùng');
      }

      if (user.loyaltyPoints < dto.points) {
        throw new BadRequestException('Số điểm tích lũy không đủ để thực hiện đổi điểm');
      }

      const updatedUser = await tx.user.update({
        where: { id: dto.userId },
        data: { loyaltyPoints: { decrement: dto.points } },
      });

      const log = await tx.loyaltyLog.create({
        data: {
          userId: dto.userId,
          points: -dto.points,
          reason: dto.description || `Sử dụng điểm đổi mã ${dto.rewardCode || ''}`.trim(),
        },
      });

      if (dto.rewardCode && typeof dto.rewardCode === 'string') {
        const formattedCode = dto.rewardCode.trim().toUpperCase();

        let discountValue = 10000;
        if (dto.points === 50) discountValue = 30000;
        else if (dto.points === 100) discountValue = 70000;

        await tx.promotion.upsert({
          where: { code: dto.rewardCode },
          update: {
            isActive: true,
            discountValue: discountValue,
          },
          create: {
            code: dto.rewardCode,
            description: `Voucher đổi từ ${dto.points} điểm Loyalty`,
            discountType: DiscountType.FIXED_AMOUNT, // DÙNG CHÍNH XÁC FIXED_AMOUNT
            discountValue: discountValue,
            minOrderAmount: 0,
            isActive: true,
            startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
            endDate: new Date('2027-12-31T23:59:59.000Z'),
          },
        });
      }

      return {
        userId: updatedUser.id,
        newPointsBalance: updatedUser.loyaltyPoints,
        log,
      };
    });
  }
}