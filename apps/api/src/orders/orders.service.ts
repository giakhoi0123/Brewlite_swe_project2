import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrderStatus, LoyaltyType, Prisma } from '@prisma/client';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loyaltyService: LoyaltyService,
  ) {}

  // Quy tắc Order State Machine (Đã cập nhật đầy đủ OrderStatus.PAID)
  private readonly validTransitions: Record<OrderStatus, OrderStatus[]> = {
    [OrderStatus.PENDING]: [OrderStatus.PROCESSING, OrderStatus.PAID, OrderStatus.CANCELLED],
    [OrderStatus.PROCESSING]: [OrderStatus.PAID, OrderStatus.COMPLETED, OrderStatus.CANCELLED],
    [OrderStatus.PAID]: [OrderStatus.PROCESSING, OrderStatus.COMPLETED, OrderStatus.CANCELLED],
    [OrderStatus.COMPLETED]: [],
    [OrderStatus.CANCELLED]: [],
  };

  async createOrder(dto: CreateOrderDto) {
    const totalAmount = dto.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    let discountAmount = 0;
    let promotionId: string | null = null;

    // 1. Áp dụng Mã khuyến mãi (Xác thực trực tiếp qua DB)
    if (dto.promoCode) {
      const promo = await this.prisma.promotion.findUnique({
        where: { code: dto.promoCode },
      });

      if (!promo || !promo.isActive) {
        throw new BadRequestException('Mã khuyến mãi không tồn tại hoặc đã bị khóa');
      }

      const now = new Date();
      if (now < promo.startDate || now > promo.endDate) {
        throw new BadRequestException('Mã khuyến mãi nằm ngoài thời gian áp dụng');
      }

      if (promo.usageLimit !== null && promo.usedCount >= promo.usageLimit) {
        throw new BadRequestException('Mã khuyến mãi đã hết lượt sử dụng');
      }

      if (totalAmount < Number(promo.minOrderAmount)) {
        throw new BadRequestException(
          `Đơn hàng phải tối thiểu ${Number(promo.minOrderAmount).toLocaleString('vi-VN')} VNĐ để áp dụng mã này`,
        );
      }

      if (promo.discountType === 'PERCENTAGE') {
        discountAmount = (totalAmount * Number(promo.discountValue)) / 100;
        if (promo.maxDiscount) {
          discountAmount = Math.min(discountAmount, Number(promo.maxDiscount));
        }
      } else {
        discountAmount = Number(promo.discountValue);
      }

      promotionId = promo.id;
    }

    // 2. Áp dụng Tích điểm Loyalty (1 điểm = 1.000 VNĐ)
    let pointsRedeemed = 0;
    if (dto.pointsToRedeem && dto.pointsToRedeem > 0) {
      await this.loyaltyService.redeemPoints({
        userId: dto.userId,
        points: dto.pointsToRedeem,
      });
      pointsRedeemed = dto.pointsToRedeem;
      discountAmount += pointsRedeemed * 1000;
    }

    const finalAmount = Math.max(0, totalAmount - discountAmount);

    // 3. Khởi tạo đơn hàng trong Database
    return this.prisma.order.create({
      data: {
        userId: dto.userId,
        promotionId,
        totalAmount: new Prisma.Decimal(totalAmount),
        discountAmount: new Prisma.Decimal(discountAmount),
        finalAmount: new Prisma.Decimal(finalAmount),
        pointsRedeemed,
        status: OrderStatus.PENDING,
        items: {
          create: dto.items.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: new Prisma.Decimal(item.unitPrice),
            subtotal: new Prisma.Decimal(item.unitPrice * item.quantity),
          })),
        },
      },
      include: { items: true, promotion: true },
    });
  }

  // Chuyển đổi trạng thái đơn (State Machine Execution)
  async updateOrderStatus(orderId: string, dto: UpdateOrderStatusDto) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');

    const allowedNextStatuses = this.validTransitions[order.status];
    if (!allowedNextStatuses.includes(dto.status)) {
      throw new BadRequestException(
        `Không thể chuyển trạng thái đơn hàng từ ${order.status} sang ${dto.status}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Đơn hàng COMPLETED -> Tích điểm Idempotent (truyền tx) & tăng lượt dùng Promotion
      if (dto.status === OrderStatus.COMPLETED) {
        // Gọi addPoints truyền tx (Tự bỏ qua nếu Kiệt đã cộng điểm lúc PAID)
        await this.loyaltyService.addPoints(
          order.id,
          order.userId,
          Number(order.finalAmount),
          tx,
        );

        if (order.promotionId) {
          await tx.promotion.update({
            where: { id: order.promotionId },
            data: { usedCount: { increment: 1 } },
          });
        }
      }

      // Đơn hàng CANCELLED -> Hoàn lại điểm đã sử dụng trực tiếp trong tx
      if (dto.status === OrderStatus.CANCELLED && order.pointsRedeemed > 0) {
        await tx.user.update({
          where: { id: order.userId },
          data: { loyaltyPoints: { increment: order.pointsRedeemed } },
        });

        await tx.loyaltyLog.create({
          data: {
            userId: order.userId,
            orderId: order.id,
            points: order.pointsRedeemed,
            type: LoyaltyType.REVERSE,
            reason: `Hoàn lại ${order.pointsRedeemed} điểm do đơn hàng #${order.id.slice(0, 8)} bị hủy`,
          },
        });
      }

      return tx.order.update({
        where: { id: orderId },
        data: { status: dto.status },
        include: { items: true },
      });
    });
  }

  // Lịch sử đơn hàng (GET /orders/me)
  async getUserOrderHistory(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      include: {
        items: true,
        promotion: {
          select: { code: true, description: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOrderById(orderId: string, userId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { items: true, promotion: true },
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    return order;
  }
}