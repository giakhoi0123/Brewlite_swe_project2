import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DiscountType, LoyaltyType, OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EarnPointsDto } from './dto/earn-points.dto';
import { RedeemPointsDto } from './dto/redeem-points.dto';

@Injectable()
export class LoyaltyService {
  private readonly logger = new Logger(LoyaltyService.name);
  private readonly POINT_RATE = 10000; // 10.000 VNĐ = 1 điểm

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lấy thông tin điểm tích lũy, lịch sử giao dịch điểm và danh sách voucher đổi điểm còn khả dụng
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

    const history = await this.prisma.loyaltyTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    // Trích xuất các mã REDEEM... từ lịch sử đổi điểm của user
    const redeemedEntries: Array<{ code: string; redeemedAt: Date }> = [];
    const seenCodes = new Set<string>();

    for (const log of history) {
      if (log.type === LoyaltyType.REDEEM && log.reason) {
        const match = log.reason.match(/(REDEEM[A-Z0-9-]+)/i);
        if (match) {
          const code = match[1].toUpperCase();
          if (!seenCodes.has(code)) {
            seenCodes.add(code);
            redeemedEntries.push({ code, redeemedAt: log.createdAt });
          }
        }
      }
    }

    let availableVouchers: Array<{
      code: string;
      name: string;
      discountValue: number;
      redeemedAt: Date;
    }> = [];

    if (redeemedEntries.length > 0) {
      const codes = redeemedEntries.map((item) => item.code);

      const [promotions, usedOrders] = await Promise.all([
        this.prisma.promotion.findMany({
          where: {
            code: { in: codes },
            isActive: true,
          },
          select: {
            code: true,
            discountValue: true,
            usageLimit: true,
            usedCount: true,
          },
        }),
        this.prisma.order.findMany({
          where: {
            userId,
            voucherCode: { in: codes },
            status: {
              notIn: [OrderStatus.CANCELLED, OrderStatus.PAYMENT_FAILED],
            },
          },
          select: { voucherCode: true },
        }),
      ]);

      const promoMap = new Map(promotions.map((p) => [p.code.toUpperCase(), p]));
      const usedCodeSet = new Set(
        usedOrders
          .map((o) => o.voucherCode?.toUpperCase())
          .filter((c): c is string => Boolean(c)),
      );

      availableVouchers = redeemedEntries
        .filter((entry) => {
          if (usedCodeSet.has(entry.code)) return false;
          const promo = promoMap.get(entry.code);
          if (!promo) return false;
          if (promo.usageLimit !== null && promo.usedCount >= promo.usageLimit) {
            return false;
          }
          return true;
        })
        .map((entry) => {
          const promo = promoMap.get(entry.code)!;
          const discountValue = Number(promo.discountValue);
          return {
            code: entry.code,
            name: `Voucher giảm ${discountValue.toLocaleString('vi-VN')} VNĐ`,
            discountValue,
            redeemedAt: entry.redeemedAt,
          };
        });
    }

    return {
      userId: user.id,
      fullName: user.fullName,
      currentPoints: user.loyaltyPoints,
      history,
      availableVouchers,
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
      const log = await db.loyaltyTransaction.create({
        data: {
          orderId,
          userId,
          amount: new Prisma.Decimal(amount),
          points: pointsToEarn,
          type: LoyaltyType.EARN,
          reason: `Tích điểm đơn hàng #${orderId.slice(0, 8)}`,
        },
      });

      await db.user.update({
        where: { id: userId },
        data: { loyaltyPoints: { increment: pointsToEarn } },
      });

      this.logger.log(`Tích thành công ${pointsToEarn} điểm cho user ${userId} (Order: ${orderId})`);
      return log;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        this.logger.warn(`[Idempotency Hit] Order ${orderId} đã được cộng điểm trước đó. Bỏ qua.`);
        return db.loyaltyTransaction.findUnique({
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

      const log = await tx.loyaltyTransaction.create({
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

      const log = await tx.loyaltyTransaction.create({
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
            discountValue,
            usageLimit: 1,
            usedCount: 0,
          },
          create: {
            code: formattedCode,
            description: `Voucher đổi từ ${dto.points} điểm Loyalty`,
            discountType: DiscountType.FIXED_AMOUNT,
            discountValue,
            minOrderAmount: 0,
            isActive: true,
            usageLimit: 1,
            usedCount: 0,
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