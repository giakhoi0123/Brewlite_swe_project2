import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Order,
  OrderStatus,
  PaymentStatus,
  Prisma,
  ReservationStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PromotionsService } from '../promotions/promotions.service';
import { BaristaQueueQueryDto } from './dto/barista-queue-query.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { aggregateIngredientRequirements } from './ingredient-requirements';
import { generateOrderNumber } from './order-number';
import {
  calculateItemPrice,
  calculateOrderPricing,
  mapBaristaOrderResponse,
  mapOrderResponse,
} from './order-pricing';
import {
  allowedTransitions,
  canActorPerformTransition,
  canTransition,
  isCancellableStatus,
} from './order-state-machine';
import { validateOrderSelection } from './order-validation';
import {
  ConcurrentStockConflictException,
  IngredientNotFoundException,
  InsufficientIngredientStockException,
  InvalidOrderTransitionException,
  InvalidVoucherException,
  OrderActionForbiddenException,
  OrderCancellationNotAllowedException,
  OrderNotFoundException,
  OrderNumberConflictException,
  OrderStateConflictException,
  ReservationAlreadyConsumedException,
  ReservationNotFoundException,
  ReservationStateConflictException,
  UserNotFoundException,
} from './orders.exceptions';
import {
  BaristaOrderResponse,
  BaristaQueueResult,
  CreateOrderItemResponse,
  CreateOrderResult,
  CustomerOrderResponse,
  mapCustomerOrderResponse,
} from './orders.types';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly promotionsService: PromotionsService,
  ) {}

  /**
   * Phương thức nghiệp vụ tạo đơn hàng (Create Order):
   * 1. Nhận authenticatedUserId từ controller (JWT payload).
   * 2. Thực thi toàn bộ quy trình trong một Prisma Interactive Transaction.
   * 3. Chống overselling và deadlock bằng pessimistic row lock (SELECT FOR UPDATE) sắp xếp ID tăng dần.
   * 4. Trừ tồn kho Ingredient, ghi nhận Reservation ACTIVE và tạo Order PENDING.
   * 5. Hỗ trợ Voucher discount và Loyalty points redemption trong cùng transaction ACID.
   * 6. Retry có kiểm soát đối với các xung đột concurrency retryable (tối đa 3 lần).
   */
  async createOrder(
    authenticatedUserId: string,
    dto: CreateOrderDto,
  ): Promise<CreateOrderResult> {
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            return await this.executeCreateOrderTransaction(
              tx,
              authenticatedUserId,
              dto,
            );
          },
          {
            maxWait: 5000,
            timeout: 10000,
          },
        );
      } catch (error: unknown) {
        // Phân loại lỗi: Không retry lỗi nghiệp vụ và validation
        if (this.isNonRetryableError(error)) {
          throw error;
        }

        // Lỗi concurrency có thể retry (deadlock, serialization failure, unique order number conflict)
        const isRetryable = this.isRetryableConcurrencyError(error);

        if (isRetryable && attempt < maxAttempts) {
          this.logger.warn(
            `Giao dịch tạo đơn gặp xung đột concurrency (lần thử ${attempt}/${maxAttempts}). Đang thử lại...`,
          );
          // Exponential backoff nhẹ kèm jitter
          const backoffMs = attempt * 50 + Math.floor(Math.random() * 20);
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          continue;
        }

        // Nếu hết lượt retry hoặc lỗi không xử lý được
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (error.code === 'P2002') {
            throw new OrderNumberConflictException();
          }
          if (error.code === 'P2034') {
            throw new ConcurrentStockConflictException();
          }
        }

        throw error;
      }
    }

    throw new ConcurrentStockConflictException();
  }

  /**
   * Truy vấn chi tiết đơn hàng của khách hàng (GET /api/orders/:id):
   * - BẮT BUỘC authenticatedUserId (không cho phép optional để chống ownership bypass).
   * - Chỉ truy vấn đơn hàng thuộc quyền sở hữu của authenticatedUserId (chống IDOR).
   * - Nếu không tìm thấy hoặc đơn thuộc người khác, ném OrderNotFoundException (404)
   *   nhằm không để lộ sự tồn tại của đơn hàng.
   * - TUYỆT ĐỐI KHÔNG trả về thông tin nội bộ: reservation lines, ingredientId, stock, version.
   */
  async getCustomerOrderById(
    orderId: string,
    authenticatedUserId: string,
  ): Promise<CustomerOrderResponse> {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        orderId,
      );
    if (!isUuid) {
      throw new OrderNotFoundException(orderId);
    }

    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        userId: authenticatedUserId,
      },
      include: {
        items: {
          include: {
            orderItemOptions: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        promotion: {
          select: { code: true, description: true },
        },
      },
    });

    if (!order) {
      throw new OrderNotFoundException(orderId);
    }

    return mapCustomerOrderResponse(order);
  }

  /**
   * Truy vấn lịch sử đơn hàng của người dùng hiện tại (GET /api/orders/me):
   * - Nguồn danh tính luôn lấy từ authenticated JWT userId, sắp xếp theo createdAt giảm dần.
   * - Tuyệt đối không để lộ dữ liệu kho nội bộ (reservation lines, stock, version).
   */
  async getUserOrderHistory(userId: string): Promise<CustomerOrderResponse[]> {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      include: {
        items: {
          include: {
            orderItemOptions: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        promotion: {
          select: { code: true, description: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return orders.map((order) => mapCustomerOrderResponse(order));
  }

  /**
   * Quản lý chuyển trạng thái Order và vòng đời Inventory Reservation tập trung:
   * - Thực thi trong cùng một Prisma Transaction.
   * - Kiểm tra Idempotency: Nếu trạng thái đã là targetStatus, trả về Order hiện tại mà không lặp thao tác.
   * - Xác thực chuyển trạng thái theo pure state machine.
   * - Kiểm soát concurrency bằng optimistic locking qua trường `version` (guarded update).
   * - Cập nhật vòng đời Reservation: ACTIVE -> CONSUMED hoặc ACTIVE -> RELEASED.
   * - Hoàn kho chính xác theo snapshot lines khi hủy, khóa Ingredient theo thứ tự ID tăng dần chống deadlock.
   * - Xử lý Loyalty points & Promotion usage: hoàn điểm khi CANCELLED, tích điểm & tăng lượt dùng mã ngay khi PAID.
   */
  async transitionOrderStatus(
    orderId: string,
    targetStatus: OrderStatus,
    actor?: { userId?: string; role?: string },
    reason?: string,
  ): Promise<Order> {
    return await this.prisma.$transaction(
      async (tx) => {
        return await this.executeTransitionOrderStatusTransaction(
          tx,
          orderId,
          targetStatus,
          actor,
          reason,
        );
      },
      {
        maxWait: 5000,
        timeout: 10000,
      },
    );
  }

  /**
   * Transaction-aware boundary for modules that must update their own records
   * atomically with the Order lifecycle (for example Payments).
   *
   * The caller owns BEGIN/COMMIT/ROLLBACK. Keeping this method on OrdersService
   * ensures reservation, stock, optimistic version and status history rules are
   * not duplicated or bypassed by another module.
   */
  async transitionOrderStatusInTransaction(
    tx: Prisma.TransactionClient,
    orderId: string,
    targetStatus: OrderStatus,
    actor?: { userId?: string; role?: string },
    reason?: string,
  ): Promise<Order> {
    return await this.executeTransitionOrderStatusTransaction(
      tx,
      orderId,
      targetStatus,
      actor,
      reason,
    );
  }

  /**
   * Ranh giới tích hợp với Payment Gateway: Thông báo thanh toán thành công (PAID).
   * - Idempotent: Nếu đơn đã PAID, trả về kết quả thành công mà không trừ kho lặp.
   */
  async handlePaymentSuccess(
    orderId: string,
    actorId?: string,
  ): Promise<Order> {
    const isUuid =
      actorId &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        actorId,
      );
    return await this.transitionOrderStatus(
      orderId,
      OrderStatus.PAID,
      { userId: isUuid ? actorId : undefined, role: 'SYSTEM' },
      'Payment processed successfully',
    );
  }

  /**
   * Ranh giới tích hợp với Payment Gateway: Thông báo thanh toán thất bại (PAYMENT_FAILED).
   * - Tự động hoàn kho nguyên liệu về Ingredient.stock và đánh dấu Reservation là RELEASED.
   * - Idempotent: Nếu đơn đã PAYMENT_FAILED, không hoàn kho lần hai.
   */
  async handlePaymentFailure(
    orderId: string,
    actorId?: string,
    reason?: string,
  ): Promise<Order> {
    const isUuid =
      actorId &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        actorId,
      );
    return await this.transitionOrderStatus(
      orderId,
      OrderStatus.PAYMENT_FAILED,
      { userId: isUuid ? actorId : undefined, role: 'SYSTEM' },
      reason || 'Payment declined or failed',
    );
  }

  /**
   * Nghiệp vụ hủy đơn hàng (CANCELLED):
   * - Chỉ cho phép hủy từ PENDING hoặc PAYMENT_FAILED.
   * - Từ chối hủy nếu đơn đã PAID/PREPARING/READY/COMPLETED.
   * - Hoàn kho nguyên liệu đúng lượng snapshot nếu Reservation đang ACTIVE.
   * - Hoàn trả điểm Loyalty pointsRedeemed về tài khoản khách hàng.
   * - Idempotent: Nếu đơn đã CANCELLED, không hoàn kho hay hoàn điểm lần hai.
   */
  async cancelOrder(
    orderId: string,
    actor?: { userId?: string; role?: UserRole | string },
    reason?: string,
  ): Promise<Order> {
    const role = actor?.role || UserRole.CUSTOMER;
    return await this.transitionOrderStatus(
      orderId,
      OrderStatus.CANCELLED,
      { userId: actor?.userId, role },
      reason || 'Order cancelled',
    );
  }

  /**
   * Truy vấn hàng đợi đơn hàng phục vụ Barista pha chế (GET /api/barista/orders):
   * - Mặc định chỉ lấy các đơn ở trạng thái: PAID, PREPARING, READY.
   * - Tuyệt đối không lấy: PENDING, PAYMENT_FAILED, CANCELLED, COMPLETED.
   * - Hỗ trợ lọc theo query.status (nếu có, phải thuộc 3 trạng thái trên).
   * - Sắp xếp tất định FIFO theo thời điểm tạo đơn: createdAt ASC, id ASC.
   * - Phân trang an toàn (mặc định page=1, limit=20, tối đa 50).
   * - Tuyệt đối không có N+1 query.
   * - Trả về dữ liệu an toàn, không rò rỉ thông tin nội bộ (stock, cost, reservation lines, hash).
   */
  async getBaristaQueue(
    query: BaristaQueueQueryDto,
  ): Promise<BaristaQueueResult> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(50, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const validBaristaStatuses: readonly OrderStatus[] = [
      OrderStatus.PAID,
      OrderStatus.PREPARING,
      OrderStatus.READY,
    ];

    if (
      query.status &&
      !validBaristaStatuses.includes(query.status as unknown as OrderStatus)
    ) {
      throw new BadRequestException(
        'Trạng thái lọc trong hàng đợi Barista chỉ chấp nhận: PAID, PREPARING, READY',
      );
    }

    const where: Prisma.OrderWhereInput = {
      status: query.status
        ? (query.status as OrderStatus)
        : {
            in: [
              OrderStatus.PAID,
              OrderStatus.PREPARING,
              OrderStatus.READY,
            ],
          },
    };

    const [total, orders] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
            },
          },
          items: {
            include: {
              orderItemOptions: true,
            },
            orderBy: { createdAt: 'asc' },
          },
          payments: {
            where: { status: PaymentStatus.PAID },
            orderBy: { processedAt: 'desc' },
            take: 1,
            select: { processedAt: true },
          },
        },
      }),
    ]);

    return {
      data: orders.map((order) => mapBaristaOrderResponse(order)),
      meta: {
        total,
        page,
        limit,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  /**
   * Barista tiếp nhận đơn và bắt đầu pha chế:
   * Action: accept -> Chuyển trạng thái PAID -> PREPARING.
   * Ghi nhận OrderStatusHistory với actorId từ JWT.
   */
  async acceptBaristaOrder(
    orderId: string,
    actor?: { userId?: string; role?: string },
  ): Promise<BaristaOrderResponse> {
    const updatedOrder = await this.transitionOrderStatus(
      orderId,
      OrderStatus.PREPARING,
      actor,
      'Barista accepted order and started preparing',
    );
    return mapBaristaOrderResponse(updatedOrder);
  }

  /**
   * Barista hoàn tất pha chế món và đưa vào hàng chờ nhận:
   * Action: ready -> Chuyển trạng thái PREPARING -> READY.
   */
  async readyBaristaOrder(
    orderId: string,
    actor?: { userId?: string; role?: string },
  ): Promise<BaristaOrderResponse> {
    const updatedOrder = await this.transitionOrderStatus(
      orderId,
      OrderStatus.READY,
      actor,
      'Barista finished preparation, order ready for pickup',
    );
    return mapBaristaOrderResponse(updatedOrder);
  }

  /**
   * Barista giao hàng thành công cho khách hàng:
   * Action: complete -> Chuyển trạng thái READY -> COMPLETED.
   */
  async completeBaristaOrder(
    orderId: string,
    actor?: { userId?: string; role?: string },
  ): Promise<BaristaOrderResponse> {
    const updatedOrder = await this.transitionOrderStatus(
      orderId,
      OrderStatus.COMPLETED,
      actor,
      'Barista completed order handover to customer',
    );
    return mapBaristaOrderResponse(updatedOrder);
  }

  /**
   * Thực thi logic chuyển trạng thái đơn hàng trong phạm vi Prisma Transaction.
   */
  private async executeTransitionOrderStatusTransaction(
    tx: Prisma.TransactionClient,
    orderId: string,
    targetStatus: OrderStatus,
    actor?: { userId?: string; role?: string },
    reason?: string,
  ): Promise<Order> {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        orderId,
      );
    if (!isUuid) {
      throw new OrderNotFoundException(orderId);
    }

    // 1. Nạp Order kèm User, Reservation, Reservation Lines và Items
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
          },
        },
        reservation: {
          include: {
            lines: true,
          },
        },
        items: {
          include: {
            orderItemOptions: true,
          },
        },
        statusHistory: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!order) {
      throw new OrderNotFoundException(orderId);
    }

    // 2. IDEMPOTENCY CHECK:
    // Nếu đơn hàng đã ở targetStatus rồi, trả về nguyên bản (no-op, không tăng version, không restock lại)
    if (order.status === targetStatus) {
      this.logger.log(
        `Idempotent transition request: Order "${orderId}" is already in "${targetStatus}".`,
      );
      return order;
    }

    // 3. XÁC THỰC STATE MACHINE:
    if (!canTransition(order.status, targetStatus)) {
      if (
        targetStatus === OrderStatus.CANCELLED &&
        !isCancellableStatus(order.status)
      ) {
        throw new OrderCancellationNotAllowedException(order.id, order.status);
      }
      throw new InvalidOrderTransitionException(
        order.status,
        targetStatus,
        allowedTransitions(order.status),
      );
    }

    // 4. KIỂM TRA QUYỀN CỦA VAI TRÒ (Actor RBAC Verification theo Pure State Machine):
    if (!canActorPerformTransition(actor?.role, order.status, targetStatus)) {
      throw new OrderActionForbiddenException(
        actor?.role || 'UNKNOWN',
        order.status,
        targetStatus,
      );
    }

    // 5. QUẢN LÝ VÒNG ĐỜI INVENTORY RESERVATION & NGUYÊN LIỆU:
    const reservation = order.reservation;
    if (!reservation) {
      throw new ReservationNotFoundException(order.id);
    }

    // Sắp xếp các reservation lines theo ingredientId tăng dần để khóa theo thứ tự nhất quán chống deadlock
    const sortedLines = [...reservation.lines].sort((a, b) =>
      a.ingredientId.localeCompare(b.ingredientId),
    );
    const sortedIngredientIds = sortedLines.map((l) => l.ingredientId);

    let calculatedPointsEarned = order.pointsEarned;

    // Kịch bản A: Chuyển sang PAID (từ PENDING)
    if (targetStatus === OrderStatus.PAID) {
      if (reservation.status === ReservationStatus.RELEASED) {
        throw new InvalidOrderTransitionException(
          order.status,
          targetStatus,
          allowedTransitions(order.status),
        );
      }

      if (reservation.status === ReservationStatus.ACTIVE) {
        // Guarded update Reservation: ACTIVE -> CONSUMED
        const resUpdate = await tx.orderInventoryReservation.updateMany({
          where: {
            id: reservation.id,
            status: ReservationStatus.ACTIVE,
            version: reservation.version,
          },
          data: {
            status: ReservationStatus.CONSUMED,
            consumedAt: new Date(),
            releasedAt: null,
            version: { increment: 1 },
          },
        });

        if (resUpdate.count !== 1) {
          throw new ReservationStateConflictException(
            reservation.id,
            reservation.version,
          );
        }
      }

      // Tự động tích điểm Loyalty ngay khi thanh toán thành công (10.000 VNĐ = 1 điểm)
      if (order.pointsEarned === 0) {
        const totalAmountNum = order.total.toNumber();
        calculatedPointsEarned = Math.floor(totalAmountNum / 10000);

        if (calculatedPointsEarned > 0) {
          await tx.user.update({
            where: { id: order.userId },
            data: { loyaltyPoints: { increment: calculatedPointsEarned } },
          });

          await tx.loyaltyLog.create({
            data: {
              userId: order.userId,
              points: calculatedPointsEarned,
              reason: `Tích điểm cho đơn hàng đã thanh toán ${order.orderNumber}`.trim(),
            },
          });
        }
      }

      // Cập nhật lượt sử dụng Promotion ngay khi thanh toán thành công
      if (order.promotionId) {
        await tx.promotion.update({
          where: { id: order.promotionId },
          data: { usedCount: { increment: 1 } },
        });
      }
      // Không trừ stock lần hai vì stock đã được trừ khi tạo đơn (lúc PENDING)
    }

    // Kịch bản B: Chuyển sang CANCELLED hoặc PAYMENT_FAILED từ trạng thái chưa thanh toán.
    else if (
      targetStatus === OrderStatus.CANCELLED ||
      targetStatus === OrderStatus.PAYMENT_FAILED
    ) {
      if (reservation.status === ReservationStatus.CONSUMED) {
        throw new ReservationAlreadyConsumedException(order.id);
      }

      if (reservation.status === ReservationStatus.ACTIVE) {
        // Khóa các nguyên liệu theo thứ tự ID tăng dần chống deadlock
        const lockedIngredients = await this.lockIngredients(
          tx,
          sortedIngredientIds,
        );

        // Hoàn kho từng nguyên liệu theo đúng số lượng snapshot trong reservation lines
        for (const line of sortedLines) {
          const ingredient = lockedIngredients.get(line.ingredientId);
          if (!ingredient) {
            throw new IngredientNotFoundException(line.ingredientId);
          }

          const newStock = ingredient.stock.plus(line.amount);

          const ingUpdate = await tx.ingredient.updateMany({
            where: {
              id: ingredient.id,
              version: ingredient.version,
            },
            data: {
              stock: newStock,
              version: { increment: 1 },
            },
          });

          if (ingUpdate.count !== 1) {
            throw new ConcurrentStockConflictException(ingredient.id);
          }
        }

        // Guarded update Reservation: ACTIVE -> RELEASED
        const resUpdate = await tx.orderInventoryReservation.updateMany({
          where: {
            id: reservation.id,
            status: ReservationStatus.ACTIVE,
            version: reservation.version,
          },
          data: {
            status: ReservationStatus.RELEASED,
            releasedAt: new Date(),
            consumedAt: null,
            version: { increment: 1 },
          },
        });

        if (resUpdate.count !== 1) {
          throw new ReservationStateConflictException(
            reservation.id,
            reservation.version,
          );
        }
      }

      // Khi đơn bị CANCELLED: Hoàn lại điểm Loyalty đã trừ (nếu có)
      if (targetStatus === OrderStatus.CANCELLED && order.pointsRedeemed > 0) {
        await tx.user.update({
          where: { id: order.userId },
          data: { loyaltyPoints: { increment: order.pointsRedeemed } },
        });

        await tx.loyaltyLog.create({
          data: {
            userId: order.userId,
            points: order.pointsRedeemed,
            reason: `Hoàn lại điểm cho đơn hàng hủy ${order.orderNumber}`.trim(),
          },
        });
      }
    }

    // Kịch bản C: Chuyển sang PENDING (từ PAYMENT_FAILED - retry flow)
    else if (
      order.status === OrderStatus.PAYMENT_FAILED &&
      targetStatus === OrderStatus.PENDING
    ) {
      if (reservation.status === ReservationStatus.RELEASED) {
        const lockedIngredients = await this.lockIngredients(
          tx,
          sortedIngredientIds,
        );

        for (const line of sortedLines) {
          const ingredient = lockedIngredients.get(line.ingredientId);
          if (!ingredient) {
            throw new IngredientNotFoundException(line.ingredientId);
          }

          if (ingredient.stock.lt(line.amount)) {
            throw new InsufficientIngredientStockException(
              ingredient.id,
              ingredient.name,
              line.amount.toString(),
              ingredient.stock.toString(),
            );
          }
        }

        for (const line of sortedLines) {
          const ingredient = lockedIngredients.get(line.ingredientId)!;
          const newStock = ingredient.stock.minus(line.amount);

          const ingUpdate = await tx.ingredient.updateMany({
            where: {
              id: ingredient.id,
              version: ingredient.version,
              stock: { gte: line.amount },
            },
            data: {
              stock: newStock,
              version: { increment: 1 },
            },
          });

          if (ingUpdate.count !== 1) {
            throw new ConcurrentStockConflictException(ingredient.id);
          }
        }

        const resUpdate = await tx.orderInventoryReservation.updateMany({
          where: {
            id: reservation.id,
            status: ReservationStatus.RELEASED,
            version: reservation.version,
          },
          data: {
            status: ReservationStatus.ACTIVE,
            releasedAt: null,
            consumedAt: null,
            version: { increment: 1 },
          },
        });

        if (resUpdate.count !== 1) {
          throw new ReservationStateConflictException(
            reservation.id,
            reservation.version,
          );
        }
      }
    }

    // Kịch bản D: Chuyển sang COMPLETED (Barista giao hàng hoàn tất)
    // Chỉ tích điểm dự phòng nếu chưa tích lúc PAID
    if (targetStatus === OrderStatus.COMPLETED) {
      if (order.pointsEarned === 0 && calculatedPointsEarned === 0) {
        const totalAmountNum = order.total.toNumber();
        calculatedPointsEarned = Math.floor(totalAmountNum / 10000);

        if (calculatedPointsEarned > 0) {
          await tx.user.update({
            where: { id: order.userId },
            data: { loyaltyPoints: { increment: calculatedPointsEarned } },
          });

          await tx.loyaltyLog.create({
            data: {
              userId: order.userId,
              points: calculatedPointsEarned,
              reason: `Tích điểm cho đơn hàng hoàn tất ${order.orderNumber}`.trim(),
            },
          });
        }
      }
    }

    // 6. GUARDED UPDATE TRÊN ORDER (Optimistic Concurrency Control):
    // Chỉ cập nhật nếu id, status và version khớp chính xác bản ghi đã đọc
    const orderUpdate = await tx.order.updateMany({
      where: {
        id: order.id,
        status: order.status,
        version: order.version,
      },
      data: {
        status: targetStatus,
        version: { increment: 1 },
        pointsEarned: calculatedPointsEarned,
      },
    });

    if (orderUpdate.count !== 1) {
      throw new OrderStateConflictException(order.id, order.version);
    }

    // 7. GHI NHẬN LỊCH SỬ CHUYỂN TRẠNG THÁI (OrderStatusHistory):
    const actorUuid =
      actor?.userId &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        actor.userId,
      )
        ? actor.userId
        : null;

    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        fromStatus: order.status,
        toStatus: targetStatus,
        actorId: actorUuid,
        reason: reason ?? null,
      },
    });

    // 8. TRẢ VỀ ORDER ĐÃ CẬP NHẬT
    return await tx.order.findUniqueOrThrow({
      where: { id: order.id },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
          },
        },
        reservation: {
          include: {
            lines: true,
          },
        },
        items: {
          include: {
            orderItemOptions: true,
          },
        },
        statusHistory: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  /**
   * Thực thi toàn bộ logic tạo đơn hàng trong phạm vi một database transaction.
   */
  private async executeCreateOrderTransaction(
    tx: Prisma.TransactionClient,
    authenticatedUserId: string,
    dto: CreateOrderDto,
  ): Promise<CreateOrderResult> {
    // 1. Xác minh authenticatedUserId có User tồn tại và đọc điểm tích lũy
    const user = await tx.user.findUnique({
      where: { id: authenticatedUserId },
      select: { id: true, loyaltyPoints: true },
    });
    if (!user) {
      throw new UserNotFoundException(authenticatedUserId);
    }

    // 2. Thu thập danh sách ID duy nhất của Products và Options
    const productIds = Array.from(new Set(dto.items.map((i) => i.productId)));
    const allOptionIds = Array.from(
      new Set(dto.items.flatMap((i) => i.selectedOptions ?? [])),
    );

    // 3. Nạp danh sách Product từ database
    const products = await tx.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        name: true,
        basePrice: true,
        isAvailable: true,
      },
    });
    const productsMap = new Map(products.map((p) => [p.id, p]));

    // 4. Nạp danh sách ProductOption cùng OptionRecipe và Ingredient
    const options = await tx.productOption.findMany({
      where: { id: { in: allOptionIds } },
      include: {
        recipes: {
          include: {
            ingredient: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });
    const optionsMap = new Map(options.map((o) => [o.id, o]));

    // 5. Xác thực toàn bộ sản phẩm và tùy chọn (defense-in-depth)
    const validatedItems = validateOrderSelection(
      dto.items,
      productsMap,
      optionsMap,
    );

    // 6. Tính giá từng món hoàn toàn từ database
    const calculatedItems = validatedItems.map((item) =>
      calculateItemPrice({
        product: item.product,
        quantity: item.quantity,
        options: item.options,
        notes: item.notes,
      }),
    );

    // 7. Xử lý Voucher / Promotion boundary (nếu có)
    let voucherDiscount = new Prisma.Decimal(0);
    let promotionId: string | undefined;

    const rawSubtotal = calculatedItems.reduce(
      (acc, item) => acc.plus(item.subtotal),
      new Prisma.Decimal(0),
    );

    if (dto.voucherCode) {
      try {
        const promoResult =
          await this.promotionsService.validateAndCalculateDiscount(
            {
              code: dto.voucherCode,
              orderAmount: rawSubtotal.toNumber(),
            },
            tx,
            authenticatedUserId,
          );
        voucherDiscount = new Prisma.Decimal(promoResult.discountAmount);
        promotionId = promoResult.promotionId;
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Voucher không hợp lệ';
        throw new InvalidVoucherException(dto.voucherCode, message);
      }
    }

    // 8. Xử lý Đổi điểm Loyalty (pointsToRedeem: 1 điểm = 1.000 VNĐ)
    let pointsRedeemed = 0;
    let pointsDiscount = new Prisma.Decimal(0);

    if (dto.pointsToRedeem && dto.pointsToRedeem > 0) {
      if (user.loyaltyPoints < dto.pointsToRedeem) {
        throw new BadRequestException(
          `Số điểm tích lũy không đủ để thực hiện đổi điểm (hiện có: ${user.loyaltyPoints}, yêu cầu: ${dto.pointsToRedeem})`,
        );
      }

      // Không cho phép giảm total xuống dưới 0
      const remainingBalance = Prisma.Decimal.max(
        new Prisma.Decimal(0),
        rawSubtotal.minus(voucherDiscount),
      );
      const maxPointsCanUse = Math.ceil(remainingBalance.toNumber() / 1000);
      pointsRedeemed = Math.min(dto.pointsToRedeem, maxPointsCanUse);
      pointsDiscount = new Prisma.Decimal(pointsRedeemed * 1000);

      // Trừ điểm user bằng atomic guarded update chống race condition đồng thời
      if (pointsRedeemed > 0) {
        const userUpdateResult = await tx.user.updateMany({
          where: {
            id: authenticatedUserId,
            loyaltyPoints: { gte: pointsRedeemed },
          },
          data: {
            loyaltyPoints: { decrement: pointsRedeemed },
          },
        });

        if (userUpdateResult.count !== 1) {
          throw new BadRequestException(
            `Số điểm tích lũy không đủ để thực hiện đổi điểm (yêu cầu: ${pointsRedeemed})`,
          );
        }

        await tx.loyaltyLog.create({
          data: {
            userId: authenticatedUserId,
            points: -pointsRedeemed,
            reason: `Sử dụng ${pointsRedeemed} điểm cho đơn hàng`.trim(),
          },
        });
      }
    }

    // Tổng giảm giá = voucher discount + loyalty points discount
    const totalDiscount = voucherDiscount.plus(pointsDiscount);

    // 9. Tính tổng thanh toán cuối cùng
    const calculatedPricing = calculateOrderPricing(
      calculatedItems,
      totalDiscount,
      {
        voucherCode: dto.voucherCode,
        promotionId,
      },
    );

    // 10. Tính toán tổng định lượng nguyên liệu cần thiết (aggregate requirements)
    const ingredientInputs = validatedItems.map((item) => ({
      productId: item.product.id,
      productName: item.product.name,
      quantity: item.quantity,
      recipes: item.options.flatMap((opt) =>
        opt.recipes.map((r) => ({
          ingredientId: r.ingredientId,
          ingredientName: r.ingredient?.name,
          amount: r.amount,
        })),
      ),
    }));

    const aggregatedRequirements =
      aggregateIngredientRequirements(ingredientInputs);
    const sortedIngredientIds = aggregatedRequirements.map(
      (r) => r.ingredientId,
    );

    // 11. Khóa các dòng Ingredient bằng SELECT ... FOR UPDATE theo thứ tự id tăng dần
    const lockedIngredients = await this.lockIngredients(
      tx,
      sortedIngredientIds,
    );

    // 12. Kiểm tra đủ tồn kho cho toàn bộ nguyên liệu
    for (const req of aggregatedRequirements) {
      const ingredient = lockedIngredients.get(req.ingredientId);
      if (!ingredient) {
        throw new IngredientNotFoundException(req.ingredientId);
      }

      if (ingredient.stock.lt(req.totalAmount)) {
        throw new InsufficientIngredientStockException(
          ingredient.id,
          ingredient.name,
          req.totalAmount.toString(),
          ingredient.stock.toString(),
        );
      }
    }

    // 13. Trừ tồn kho và tăng version với optimistic lock guard
    for (const req of aggregatedRequirements) {
      const ingredient = lockedIngredients.get(req.ingredientId)!;
      const newStock = ingredient.stock.minus(req.totalAmount);

      const updateResult = await tx.ingredient.updateMany({
        where: {
          id: ingredient.id,
          version: ingredient.version,
          stock: { gte: req.totalAmount },
        },
        data: {
          stock: newStock,
          version: { increment: 1 },
        },
      });

      if (updateResult.count !== 1) {
        throw new ConcurrentStockConflictException(ingredient.id);
      }
    }

    // 14. Tạo Order trạng thái PENDING
    const orderNumber = generateOrderNumber();
    const order = await tx.order.create({
      data: {
        orderNumber,
        userId: authenticatedUserId,
        status: OrderStatus.PENDING,
        subtotal: calculatedPricing.subtotal,
        discount: calculatedPricing.discount,
        total: calculatedPricing.total,
        voucherCode: calculatedPricing.voucherCode ?? null,
        promotionId: calculatedPricing.promotionId ?? null,
        pointsEarned: 0,
        pointsRedeemed,
        notes: dto.notes ?? null,
        version: 1,
      },
    });

    // 15. Tạo OrderItem, OrderItemOption và optionsSnapshot
    for (const item of calculatedPricing.items) {
      const orderItem = await tx.orderItem.create({
        data: {
          orderId: order.id,
          productId: item.productId,
          productNameSnapshot: item.productName,
          unitPriceSnapshot: item.unitPrice,
          quantity: item.quantity,
          subtotal: item.subtotal,
          notes: item.notes ?? null,
          optionsSnapshot: item.optionsSnapshot,
        },
      });

      for (const opt of item.options) {
        await tx.orderItemOption.create({
          data: {
            orderItemId: orderItem.id,
            productOptionId: opt.optionId,
            optionNameSnapshot: opt.optionName,
            optionType: opt.optionType,
            extraPriceSnapshot: opt.extraPrice,
          },
        });
      }
    }

    // 16. Tạo đúng 1 OrderInventoryReservation trạng thái ACTIVE
    const reservation = await tx.orderInventoryReservation.create({
      data: {
        orderId: order.id,
        status: ReservationStatus.ACTIVE,
        version: 1,
      },
    });

    // 17. Tạo OrderReservationLine đã cộng gộp theo ingredientId
    for (const req of aggregatedRequirements) {
      await tx.orderReservationLine.create({
        data: {
          reservationId: reservation.id,
          ingredientId: req.ingredientId,
          amount: req.totalAmount,
        },
      });
    }

    // 18. Tạo OrderStatusHistory đầu tiên (null -> PENDING)
    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        fromStatus: null,
        toStatus: OrderStatus.PENDING,
        actorId: authenticatedUserId,
        reason: 'Order created',
      },
    });

    // 19. Ánh xạ trả về kết quả theo typed client contract
    const responseItems: CreateOrderItemResponse[] = calculatedPricing.items.map(
      (item) => ({
        productId: item.productId,
        productName: item.productName,
        unitPrice: item.unitPrice.toNumber(),
        quantity: item.quantity,
        subtotal: item.subtotal.toNumber(),
        notes: item.notes ?? null,
        options: item.optionsSnapshot,
      }),
    );

    return mapOrderResponse(order, responseItems);
  }

  /**
   * Khóa bi quan (pessimistic locking) các dòng trong bảng `ingredients` bằng câu lệnh SQL
   * SELECT ... FOR UPDATE theo thứ tự ID tăng dần để ngăn chặn triệt để deadlock.
   */
  private async lockIngredients(
    tx: Prisma.TransactionClient,
    ingredientIds: string[],
  ): Promise<
    Map<string, { id: string; name: string; stock: Prisma.Decimal; version: number }>
  > {
    if (ingredientIds.length === 0) {
      return new Map();
    }

    // Bắt buộc sắp xếp ID tăng dần theo bảng mã từ điển để thứ tự khóa tài nguyên là tất định
    const sortedIds = [...ingredientIds].sort();

    const lockedRows = await tx.$queryRaw<
      Array<{ id: string; name: string; stock: Prisma.Decimal; version: number }>
    >`
      SELECT "id", "name", "stock", "version"
      FROM "ingredients"
      WHERE "id" = ANY(${sortedIds}::uuid[])
      ORDER BY "id" ASC
      FOR UPDATE
    `;

    return new Map(lockedRows.map((row) => [row.id, row]));
  }

  /**
   * Phân loại lỗi: Xác định xem lỗi có phải do vi phạm logic nghiệp vụ hay validation không thể retry.
   */
  private isNonRetryableError(error: unknown): boolean {
    if (
      error instanceof InsufficientIngredientStockException ||
      error instanceof IngredientNotFoundException ||
      error instanceof InvalidVoucherException ||
      error instanceof UserNotFoundException ||
      error instanceof BadRequestException ||
      error instanceof NotFoundException ||
      error instanceof ForbiddenException
    ) {
      return true;
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // P2025: Record to update not found (không retry)
      // P2003: Foreign key constraint failed (không retry)
      if (['P2025', 'P2003'].includes(error.code)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Xác định xem lỗi có thuộc loại concurrency conflict có thể giải quyết bằng retry hay không:
   * - 40001: Transaction serialization failure.
   * - 40P01: Deadlock detected.
   * - P2002: Unique constraint violation (ví dụ trùng mã orderNumber ngẫu nhiên hiếm gặp).
   * - P2034: Prisma transaction write conflict.
   */
  private isRetryableConcurrencyError(error: unknown): boolean {
    if (error instanceof ConcurrentStockConflictException) {
      return true;
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (['P2002', 'P2034'].includes(error.code)) {
        return true;
      }
    }

    const errorStr = String(error);
    if (
      errorStr.includes('40001') ||
      errorStr.includes('40P01') ||
      errorStr.includes('deadlock detected') ||
      errorStr.includes('could not serialize access')
    ) {
      return true;
    }

    return false;
  }
}