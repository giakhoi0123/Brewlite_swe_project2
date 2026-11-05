import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EarnPointsDto } from './dto/earn-points.dto';
import { RedeemPointsDto } from './dto/redeem-points.dto';

@Injectable()
export class LoyaltyService {
  constructor(private readonly prisma: PrismaService) {}

  // Lấy thông tin điểm và lịch sử tích điểm của User
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

  // Cộng điểm khi hoàn thành đơn hàng
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

  // Trừ điểm khi đổi quà/mã giảm giá
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
          reason: dto.description || `Sử dụng điểm cho đơn hàng ${dto.orderId || ''}`.trim(),
        },
      });

      return {
        userId: updatedUser.id,
        newPointsBalance: updatedUser.loyaltyPoints,
        log,
      };
    });
  }
}