import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DiscountType, LoyaltyType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EarnPointsDto } from './dto/earn-points.dto';
import { RedeemPointsDto } from './dto/redeem-points.dto';

@Injectable()
export class LoyaltyService {
  private readonly logger = new Logger(LoyaltyService.name);
  private readonly POINT_RATE = 10000; // 10.000 VNĐ = 1 điểm

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lấy thông tin điểm tích lũy và lịch sử giao dịch điểm của User
   */
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

  /**
   * Hàm cộng điểm chuẩn hóa cho PaymentService / Webhook gọi (Idempotent & Transaction-safe)
   */
  async addPoints(
    orderId: string,
    userId: string,
    amount: number,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx || this.prisma;
    const pointsToEarn = Math.floor(amount / this.POINT_RATE);

    if (pointsToEarn <= 0) {
      this.logger.log(`Order ${orderId}: Số tiền đơn hàng chưa đủ điều kiện tích điểm.`);
      return null;
    }

    try {
      // 1. Tạo bản ghi giao dịch cộng điểm (EARN)
      const log = await db.loyaltyLog.create({
        data: {
          orderId,
          userId,
          amount: new Prisma.Decimal(amount),
          points: pointsToEarn,
          type: LoyaltyType.EARN,
          reason: `Tích điểm đơn hàng #${orderId.slice(0, 8)}`,
        },
      });

      // 2. Cập nhật tổng điểm của User
      await db.user.update({
        where: { id: userId },
        data: { loyaltyPoints: { increment: pointsToEarn } },
      });

      this.logger.log(`Tích thành công ${pointsToEarn} điểm cho user ${userId} (Order: ${orderId})`);
      return log;
    } catch (error) {
      // Bắt lỗi Unique Constraint P2002 (Trùng @@unique([orderId, type])) -> Idempotency Hit
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        this.logger.warn(`[Idempotency Hit] Order ${orderId} đã được cộng điểm trước đó. Bỏ qua.`);
        return db.loyaltyLog.findUnique({
          where: {
            orderId_type: {
              orderId,
              type: LoyaltyType.EARN,
            },
          },
        });
      }
      throw error;
    }
  }

  /**
   * Cộng điểm thủ công (Admin/Custom logic)
   */
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
          orderId: dto.orderId || null,
          points: dto.points,
          type: LoyaltyType.EARN,
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

  /**
   * Trừ / Đổi điểm tích lũy
   */
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
          points: dto.points,
          type: LoyaltyType.REDEEM,
          reason: dto.description || `Sử dụng điểm đổi mã ${dto.rewardCode || ''}`.trim(),
        },
      });

      if (dto.rewardCode && typeof dto.rewardCode === 'string') {
        const formattedCode = dto.rewardCode.trim().toUpperCase();

        let discountValue = 10000;
        if (dto.points === 50) discountValue = 30000;
        else if (dto.points === 100) discountValue = 70000;

        await tx.promotion.upsert({
          where: { code: formattedCode },
          update: {
            isActive: true,
            discountValue: discountValue,
          },
          create: {
            code: formattedCode,
            description: `Voucher đổi từ ${dto.points} điểm Loyalty`,
            discountType: DiscountType.FIXED_AMOUNT,
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