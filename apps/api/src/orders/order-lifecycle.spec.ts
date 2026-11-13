import {
  OrderStatus,
  Prisma,
  ReservationStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PromotionsService } from '../promotions/promotions.service';
import {
  InvalidOrderTransitionException,
} from './order-state-machine';
import {
  ConcurrentStockConflictException,
  OrderActionForbiddenException,
  OrderCancellationNotAllowedException,
  OrderNotFoundException,
  OrderStateConflictException,
  ReservationAlreadyConsumedException,
  ReservationStateConflictException,
} from './orders.exceptions';
import { OrdersService } from './orders.service';

describe('Orders Lifecycle & State Machine (Unit Tests - Section VI & VIII)', () => {
  let service: OrdersService;
  let prismaMock: any;

  const mockOrderId = '10000000-0000-4000-8000-000000000001';
  const mockUserId = '20000000-0000-4000-8000-000000000001';
  const mockReservationId = '30000000-0000-4000-8000-000000000001';

  const mockIngredientA = {
    id: 'aaa00000-0000-4000-8000-000000000001',
    name: 'Coffee Beans',
    stock: new Prisma.Decimal('100.000'),
    version: 1,
  };

  const mockIngredientB = {
    id: 'bbb00000-0000-4000-8000-000000000002',
    name: 'Fresh Milk',
    stock: new Prisma.Decimal('500.000'),
    version: 2,
  };

  const createMockOrder = (
    orderStatus: OrderStatus = OrderStatus.PENDING,
    reservationStatus: ReservationStatus = ReservationStatus.ACTIVE,
    version = 1,
  ) => ({
    id: mockOrderId,
    orderNumber: 'ORD-20261108-0001',
    userId: mockUserId,
    status: orderStatus,
    version,
    subtotal: new Prisma.Decimal('60000.00'),
    discount: new Prisma.Decimal('0.00'),
    total: new Prisma.Decimal('60000.00'),
    voucherCode: null,
    promotionId: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    reservation: {
      id: mockReservationId,
      orderId: mockOrderId,
      status: reservationStatus,
      version: 1,
      createdAt: new Date(),
      consumedAt: reservationStatus === ReservationStatus.CONSUMED ? new Date() : null,
      releasedAt: reservationStatus === ReservationStatus.RELEASED ? new Date() : null,
      updatedAt: new Date(),
      lines: [
        {
          id: 'line-1',
          reservationId: mockReservationId,
          ingredientId: mockIngredientA.id,
          amount: new Prisma.Decimal('20.000'),
        },
        {
          id: 'line-2',
          reservationId: mockReservationId,
          ingredientId: mockIngredientB.id,
          amount: new Prisma.Decimal('150.000'),
        },
      ],
    },
    items: [],
    statusHistory: [],
  });

  beforeEach(() => {
    prismaMock = {
      $transaction: jest.fn(async (cb) => {
        return await cb(prismaMock);
      }),
      order: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        updateMany: jest.fn(),
      },
      orderInventoryReservation: {
        updateMany: jest.fn(),
      },
      ingredient: {
        updateMany: jest.fn(),
      },
      payment: {
        findFirst: jest.fn(),
        updateMany: jest.fn(),
      },
      orderStatusHistory: {
        create: jest.fn().mockResolvedValue({ id: 'history-1' }),
      },
      $queryRaw: jest.fn(),
    };

    const promotionsMock = {
      validateAndCalculateDiscount: jest.fn(),
    } as unknown as PromotionsService;

    service = new OrdersService(
      prismaMock as unknown as PrismaService,
      promotionsMock,
    );
  });

  // 1. Tất cả transition hợp lệ với đúng actor
  describe('Case 1: Tất cả transition hợp lệ với đúng actor', () => {
    it.each([
      [OrderStatus.PENDING, OrderStatus.PAID, 'SYSTEM'],
      [OrderStatus.PENDING, OrderStatus.PAYMENT_FAILED, 'SYSTEM'],
      [OrderStatus.PENDING, OrderStatus.CANCELLED, UserRole.CUSTOMER],
      [OrderStatus.PAYMENT_FAILED, OrderStatus.PENDING, UserRole.CUSTOMER],
      [OrderStatus.PAYMENT_FAILED, OrderStatus.CANCELLED, UserRole.CUSTOMER],
      [OrderStatus.PAID, OrderStatus.PREPARING, UserRole.BARISTA],
      [OrderStatus.PREPARING, OrderStatus.READY, UserRole.BARISTA],
      [OrderStatus.READY, OrderStatus.COMPLETED, UserRole.BARISTA],
    ])('allows valid transition from %s to %s for actor %s', async (from, to, actorRole) => {
      const reservationStatus =
        from === OrderStatus.PENDING
          ? ReservationStatus.ACTIVE
          : from === OrderStatus.PAYMENT_FAILED
            ? ReservationStatus.RELEASED
            : ReservationStatus.CONSUMED;

      const mockOrder = createMockOrder(from, reservationStatus);
      prismaMock.order.findUnique.mockResolvedValue(mockOrder);
      prismaMock.order.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.orderInventoryReservation.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.ingredient.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.$queryRaw.mockResolvedValue([
        { ...mockIngredientA },
        { ...mockIngredientB },
      ]);
      prismaMock.order.findUniqueOrThrow.mockResolvedValue({
        ...mockOrder,
        status: to,
        version: mockOrder.version + 1,
      });

      const updated = await service.transitionOrderStatus(mockOrderId, to, { role: actorRole });
      expect(updated.status).toBe(to);
      expect(prismaMock.order.updateMany).toHaveBeenCalledWith({
        where: { id: mockOrderId, status: from, version: mockOrder.version },
        data: { status: to, version: { increment: 1 } },
      });
    });
  });

  // 2. Tất cả transition không hợp lệ từ terminal states
  describe('Case 2: Tất cả transition không hợp lệ từ terminal states', () => {
    it.each(Object.values(OrderStatus))(
      'rejects any transition from COMPLETED to %s',
      async (target) => {
        const mockOrder = createMockOrder(
          OrderStatus.COMPLETED,
          ReservationStatus.CONSUMED,
        );
        prismaMock.order.findUnique.mockResolvedValue(mockOrder);

        if (target === OrderStatus.COMPLETED) {
          // Idempotent: returns current order
          const res = await service.transitionOrderStatus(mockOrderId, target, { role: UserRole.BARISTA });
          expect(res.status).toBe(OrderStatus.COMPLETED);
        } else if (target === OrderStatus.CANCELLED) {
          await expect(
            service.transitionOrderStatus(mockOrderId, target, { role: UserRole.MANAGER }),
          ).rejects.toThrow(OrderCancellationNotAllowedException);
        } else {
          await expect(
            service.transitionOrderStatus(mockOrderId, target, { role: UserRole.BARISTA }),
          ).rejects.toThrow(InvalidOrderTransitionException);
        }
      },
    );

    it.each(Object.values(OrderStatus))(
      'rejects any transition from CANCELLED to %s',
      async (target) => {
        const mockOrder = createMockOrder(
          OrderStatus.CANCELLED,
          ReservationStatus.RELEASED,
        );
        prismaMock.order.findUnique.mockResolvedValue(mockOrder);

        if (target === OrderStatus.CANCELLED) {
          const res = await service.transitionOrderStatus(mockOrderId, target, { role: UserRole.CUSTOMER });
          expect(res.status).toBe(OrderStatus.CANCELLED);
        } else {
          await expect(
            service.transitionOrderStatus(mockOrderId, target, { role: UserRole.CUSTOMER }),
          ).rejects.toThrow(InvalidOrderTransitionException);
        }
      },
    );
  });

  // 3. Không cho bỏ qua bước (State skipping)
  describe('Case 3: Không cho bỏ qua bước', () => {
    it.each([
      [OrderStatus.PENDING, OrderStatus.PREPARING],
      [OrderStatus.PENDING, OrderStatus.READY],
      [OrderStatus.PENDING, OrderStatus.COMPLETED],
      [OrderStatus.PAID, OrderStatus.READY],
      [OrderStatus.PAID, OrderStatus.COMPLETED],
      [OrderStatus.PREPARING, OrderStatus.COMPLETED],
    ])('rejects skipped transition from %s to %s', async (from, to) => {
      const mockOrder = createMockOrder(from);
      prismaMock.order.findUnique.mockResolvedValue(mockOrder);

      await expect(
        service.transitionOrderStatus(mockOrderId, to, { role: UserRole.BARISTA }),
      ).rejects.toThrow(InvalidOrderTransitionException);
    });
  });

  // 4. Không cho chuyển ngược trạng thái (Backward transitions)
  describe('Case 4: Không cho chuyển ngược trạng thái', () => {
    it.each([
      [OrderStatus.PREPARING, OrderStatus.PAID],
      [OrderStatus.READY, OrderStatus.PREPARING],
      [OrderStatus.READY, OrderStatus.PAID],
      [OrderStatus.COMPLETED, OrderStatus.READY],
    ])('rejects backward transition from %s to %s', async (from, to) => {
      const mockOrder = createMockOrder(from, ReservationStatus.CONSUMED);
      prismaMock.order.findUnique.mockResolvedValue(mockOrder);

      await expect(
        service.transitionOrderStatus(mockOrderId, to, { role: UserRole.BARISTA }),
      ).rejects.toThrow(InvalidOrderTransitionException);
    });
  });

  // 5. Order không tồn tại (HTTP 404)
  describe('Case 5: Order không tồn tại', () => {
    it('throws OrderNotFoundException when order does not exist', async () => {
      prismaMock.order.findUnique.mockResolvedValue(null);

      await expect(
        service.transitionOrderStatus('non-existent-id', OrderStatus.PAID, { role: 'SYSTEM' }),
      ).rejects.toThrow(OrderNotFoundException);
    });
  });

  // 6. Guarded update thất bại do version conflict (HTTP 409)
  describe('Case 6: Guarded update thất bại do version conflict', () => {
    it('throws OrderStateConflictException when order updateMany count is 0', async () => {
      const mockOrder = createMockOrder(OrderStatus.PENDING, ReservationStatus.ACTIVE, 3);
      prismaMock.order.findUnique.mockResolvedValue(mockOrder);
      prismaMock.orderInventoryReservation.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.order.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.transitionOrderStatus(mockOrderId, OrderStatus.PAID, { role: 'SYSTEM' }),
      ).rejects.toThrow(OrderStateConflictException);
    });

    it('throws ReservationStateConflictException when reservation updateMany count is 0', async () => {
      const mockOrder = createMockOrder(OrderStatus.PENDING, ReservationStatus.ACTIVE, 1);
      prismaMock.order.findUnique.mockResolvedValue(mockOrder);
      prismaMock.orderInventoryReservation.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.transitionOrderStatus(mockOrderId, OrderStatus.PAID, { role: 'SYSTEM' }),
      ).rejects.toThrow(ReservationStateConflictException);
    });
  });

  // 7. Payment-success callback bị gửi hai lần (Idempotency)
  describe('Case 7: Payment-success callback bị gửi hai lần', () => {
    it('returns the existing paid order immediately on second call without modifying DB', async () => {
      const alreadyPaidOrder = createMockOrder(
        OrderStatus.PAID,
        ReservationStatus.CONSUMED,
        2,
      );
      prismaMock.order.findUnique.mockResolvedValue(alreadyPaidOrder);

      const result = await service.handlePaymentSuccess(mockOrderId, '20000000-0000-4000-8000-000000000001');

      expect(result.status).toBe(OrderStatus.PAID);
      expect(prismaMock.order.updateMany).not.toHaveBeenCalled();
      expect(prismaMock.orderInventoryReservation.updateMany).not.toHaveBeenCalled();
      expect(prismaMock.ingredient.updateMany).not.toHaveBeenCalled();
      expect(prismaMock.orderStatusHistory.create).not.toHaveBeenCalled();
    });
  });

  // 8. Cancel đơn ACTIVE hoàn kho đúng số lượng
  describe('Case 8: Cancel đơn ACTIVE hoàn kho đúng số lượng', () => {
    it('restocks ingredients and sets reservation to RELEASED', async () => {
      const mockOrder = createMockOrder(OrderStatus.PENDING, ReservationStatus.ACTIVE);
      prismaMock.order.findUnique.mockResolvedValue(mockOrder);
      prismaMock.$queryRaw.mockResolvedValue([
        { ...mockIngredientA },
        { ...mockIngredientB },
      ]);
      prismaMock.ingredient.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.orderInventoryReservation.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.order.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.order.findUniqueOrThrow.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.CANCELLED,
      });

      const result = await service.cancelOrder(mockOrderId, { userId: mockUserId, role: UserRole.CUSTOMER });

      expect(result.status).toBe(OrderStatus.CANCELLED);

      expect(prismaMock.ingredient.updateMany).toHaveBeenCalledWith({
        where: { id: mockIngredientA.id, version: mockIngredientA.version },
        data: {
          stock: new Prisma.Decimal('120.000'),
          version: { increment: 1 },
        },
      });

      expect(prismaMock.ingredient.updateMany).toHaveBeenCalledWith({
        where: { id: mockIngredientB.id, version: mockIngredientB.version },
        data: {
          stock: new Prisma.Decimal('650.000'),
          version: { increment: 1 },
        },
      });

      expect(prismaMock.orderInventoryReservation.updateMany).toHaveBeenCalledWith({
        where: {
          id: mockReservationId,
          status: ReservationStatus.ACTIVE,
          version: 1,
        },
        data: {
          status: ReservationStatus.RELEASED,
          releasedAt: expect.any(Date),
          consumedAt: null,
          version: { increment: 1 },
        },
      });
    });
  });

  // 9. Retry cancel không hoàn kho lần hai (Double Restock Prevention)
  describe('Case 9: Retry cancel không hoàn kho lần hai', () => {
    it('returns existing cancelled order without modifying ingredient stock on repeated cancel', async () => {
      const alreadyCancelledOrder = createMockOrder(
        OrderStatus.CANCELLED,
        ReservationStatus.RELEASED,
        3,
      );
      prismaMock.order.findUnique.mockResolvedValue(alreadyCancelledOrder);

      const result = await service.cancelOrder(mockOrderId);

      expect(result.status).toBe(OrderStatus.CANCELLED);
      expect(prismaMock.ingredient.updateMany).not.toHaveBeenCalled();
      expect(prismaMock.orderInventoryReservation.updateMany).not.toHaveBeenCalled();
      expect(prismaMock.order.updateMany).not.toHaveBeenCalled();
    });

    it('does not restock again when moving from PAYMENT_FAILED to CANCELLED if already RELEASED', async () => {
      const paymentFailedOrder = createMockOrder(
        OrderStatus.PAYMENT_FAILED,
        ReservationStatus.RELEASED,
        2,
      );
      prismaMock.order.findUnique.mockResolvedValue(paymentFailedOrder);
      prismaMock.order.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.order.findUniqueOrThrow.mockResolvedValue({
        ...paymentFailedOrder,
        status: OrderStatus.CANCELLED,
      });

      await service.transitionOrderStatus(mockOrderId, OrderStatus.CANCELLED, { role: UserRole.CUSTOMER });

      expect(prismaMock.ingredient.updateMany).not.toHaveBeenCalled();
      expect(prismaMock.orderInventoryReservation.updateMany).not.toHaveBeenCalled();
      expect(prismaMock.order.updateMany).toHaveBeenCalled();
    });
  });

  // 10. Reservation đã CONSUMED không được hoàn bởi luồng hủy thông thường.
  describe('Case 10: Reject cancellation after inventory was consumed', () => {
    it('throws ReservationAlreadyConsumedException if reservation is CONSUMED during cancellation', async () => {
      const pendingOrderWithConsumedRes = createMockOrder(
        OrderStatus.PENDING,
        ReservationStatus.CONSUMED,
      );
      prismaMock.order.findUnique.mockResolvedValue(pendingOrderWithConsumedRes);

      await expect(service.cancelOrder(mockOrderId)).rejects.toThrow(
        ReservationAlreadyConsumedException,
      );
    });
  });

  // 11. CONSUMED không trừ stock lần hai
  describe('Case 11: CONSUMED không trừ stock lần hai', () => {
    it('marks reservation as CONSUMED but does NOT update ingredient stock on payment success', async () => {
      const pendingOrder = createMockOrder(OrderStatus.PENDING, ReservationStatus.ACTIVE);
      prismaMock.order.findUnique.mockResolvedValue(pendingOrder);
      prismaMock.orderInventoryReservation.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.order.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.order.findUniqueOrThrow.mockResolvedValue({
        ...pendingOrder,
        status: OrderStatus.PAID,
      });

      await service.handlePaymentSuccess(mockOrderId);

      expect(prismaMock.orderInventoryReservation.updateMany).toHaveBeenCalledWith({
        where: {
          id: mockReservationId,
          status: ReservationStatus.ACTIVE,
          version: 1,
        },
        data: {
          status: ReservationStatus.CONSUMED,
          consumedAt: expect.any(Date),
          releasedAt: null,
          version: { increment: 1 },
        },
      });

      expect(prismaMock.ingredient.updateMany).not.toHaveBeenCalled();
    });
  });

  // 12. RELEASED không thể chuyển sang CONSUMED
  describe('Case 12: RELEASED không thể chuyển sang CONSUMED', () => {
    it('rejects moving to PAID if reservation has already been RELEASED', async () => {
      const pendingWithReleasedRes = createMockOrder(
        OrderStatus.PENDING,
        ReservationStatus.RELEASED,
      );
      prismaMock.order.findUnique.mockResolvedValue(pendingWithReleasedRes);

      await expect(
        service.transitionOrderStatus(mockOrderId, OrderStatus.PAID, { role: 'SYSTEM' }),
      ).rejects.toThrow(InvalidOrderTransitionException);
    });
  });

  // 13. Nhiều ingredient được hoàn theo snapshot
  describe('Case 13: Nhiều ingredient được hoàn theo snapshot', () => {
    it('restocks multiple ingredients according to reservation lines snapshot without looking up recipes', async () => {
      const customLines = [
        { id: 'l1', reservationId: mockReservationId, ingredientId: 'i-1', amount: new Prisma.Decimal('10.5') },
        { id: 'l2', reservationId: mockReservationId, ingredientId: 'i-2', amount: new Prisma.Decimal('25.0') },
        { id: 'l3', reservationId: mockReservationId, ingredientId: 'i-3', amount: new Prisma.Decimal('3.25') },
      ];

      const mockOrder = {
        ...createMockOrder(OrderStatus.PENDING, ReservationStatus.ACTIVE),
        reservation: {
          id: mockReservationId,
          status: ReservationStatus.ACTIVE,
          version: 1,
          lines: customLines,
        },
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder);
      prismaMock.$queryRaw.mockResolvedValue([
        { id: 'i-1', name: 'Tea', stock: new Prisma.Decimal('50'), version: 1 },
        { id: 'i-2', name: 'Water', stock: new Prisma.Decimal('500'), version: 1 },
        { id: 'i-3', name: 'Honey', stock: new Prisma.Decimal('20'), version: 1 },
      ]);
      prismaMock.ingredient.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.orderInventoryReservation.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.order.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.order.findUniqueOrThrow.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.CANCELLED,
      });

      await service.cancelOrder(mockOrderId);

      expect(prismaMock.ingredient.updateMany).toHaveBeenCalledTimes(3);
      expect(prismaMock.ingredient.updateMany).toHaveBeenCalledWith({
        where: { id: 'i-1', version: 1 },
        data: { stock: new Prisma.Decimal('60.5'), version: { increment: 1 } },
      });
      expect(prismaMock.ingredient.updateMany).toHaveBeenCalledWith({
        where: { id: 'i-2', version: 1 },
        data: { stock: new Prisma.Decimal('525.0'), version: { increment: 1 } },
      });
      expect(prismaMock.ingredient.updateMany).toHaveBeenCalledWith({
        where: { id: 'i-3', version: 1 },
        data: { stock: new Prisma.Decimal('23.25'), version: { increment: 1 } },
      });
    });
  });

  // 14. Lock ingredient theo thứ tự ID tăng dần
  describe('Case 14: Lock ingredient theo thứ tự ID tăng dần', () => {
    it('sorts ingredients by ID in ascending order before locking to prevent deadlocks', async () => {
      const unorderedLines = [
        { id: 'l1', reservationId: mockReservationId, ingredientId: 'zzz-uuid', amount: new Prisma.Decimal('5') },
        { id: 'l2', reservationId: mockReservationId, ingredientId: 'aaa-uuid', amount: new Prisma.Decimal('10') },
        { id: 'l3', reservationId: mockReservationId, ingredientId: 'mmm-uuid', amount: new Prisma.Decimal('15') },
      ];

      const mockOrder = {
        ...createMockOrder(OrderStatus.PENDING, ReservationStatus.ACTIVE),
        reservation: {
          id: mockReservationId,
          status: ReservationStatus.ACTIVE,
          version: 1,
          lines: unorderedLines,
        },
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder);

      const lockSpy = jest.spyOn<any, any>(service as any, 'lockIngredients');
      lockSpy.mockResolvedValue(
        new Map([
          ['aaa-uuid', { id: 'aaa-uuid', name: 'A', stock: new Prisma.Decimal(100), version: 1 }],
          ['mmm-uuid', { id: 'mmm-uuid', name: 'M', stock: new Prisma.Decimal(100), version: 1 }],
          ['zzz-uuid', { id: 'zzz-uuid', name: 'Z', stock: new Prisma.Decimal(100), version: 1 }],
        ]),
      );

      prismaMock.ingredient.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.orderInventoryReservation.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.order.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.order.findUniqueOrThrow.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.CANCELLED,
      });

      await service.cancelOrder(mockOrderId);

      expect(lockSpy).toHaveBeenCalledWith(
        expect.anything(),
        ['aaa-uuid', 'mmm-uuid', 'zzz-uuid'],
      );
    });
  });

  // 15. Lỗi giữa quá trình hoàn kho rollback toàn bộ
  describe('Case 15: Lỗi giữa quá trình hoàn kho rollback toàn bộ', () => {
    it('aborts and rolls back the transaction if an ingredient update fails halfway', async () => {
      const mockOrder = createMockOrder(OrderStatus.PENDING, ReservationStatus.ACTIVE);
      prismaMock.order.findUnique.mockResolvedValue(mockOrder);
      prismaMock.$queryRaw.mockResolvedValue([
        { ...mockIngredientA },
        { ...mockIngredientB },
      ]);

      prismaMock.ingredient.updateMany
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 0 });

      await expect(service.cancelOrder(mockOrderId)).rejects.toThrow(
        ConcurrentStockConflictException,
      );

      expect(prismaMock.orderInventoryReservation.updateMany).not.toHaveBeenCalled();
      expect(prismaMock.order.updateMany).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // SECTION VI: SECURITY HARDENING & STATE MACHINE CLEANUP (Đợt 2D.1)
  // =========================================================================
  describe('Section VI: Security Hardening & RBAC Enforcement (Đợt 2D.1)', () => {
    // 1. PAYMENT/SYSTEM được phép PENDING -> PAID
    it('VI.1: allows PAYMENT / SYSTEM for PENDING -> PAID', async () => {
      const pendingOrder = createMockOrder(OrderStatus.PENDING, ReservationStatus.ACTIVE);
      prismaMock.order.findUnique.mockResolvedValue(pendingOrder);
      prismaMock.orderInventoryReservation.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.order.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.order.findUniqueOrThrow.mockResolvedValue({
        ...pendingOrder,
        status: OrderStatus.PAID,
      });

      for (const role of ['SYSTEM', 'PAYMENT']) {
        const res = await service.transitionOrderStatus(mockOrderId, OrderStatus.PAID, { role });
        expect(res.status).toBe(OrderStatus.PAID);
      }
    });

    // 2. CUSTOMER không được phép PENDING -> PAID
    it('VI.2: forbids CUSTOMER from marking PENDING -> PAID', async () => {
      const pendingOrder = createMockOrder(OrderStatus.PENDING, ReservationStatus.ACTIVE);
      prismaMock.order.findUnique.mockResolvedValue(pendingOrder);

      await expect(
        service.transitionOrderStatus(mockOrderId, OrderStatus.PAID, { role: UserRole.CUSTOMER }),
      ).rejects.toThrow(OrderActionForbiddenException);
    });

    // 3. BARISTA không được phép PENDING -> PAID
    it('VI.3: forbids BARISTA from marking PENDING -> PAID', async () => {
      const pendingOrder = createMockOrder(OrderStatus.PENDING, ReservationStatus.ACTIVE);
      prismaMock.order.findUnique.mockResolvedValue(pendingOrder);

      await expect(
        service.transitionOrderStatus(mockOrderId, OrderStatus.PAID, { role: UserRole.BARISTA }),
      ).rejects.toThrow(OrderActionForbiddenException);
    });

    // 4. CUSTOMER không được phép PAID -> PREPARING
    it('VI.4: forbids CUSTOMER from PAID -> PREPARING', async () => {
      const paidOrder = createMockOrder(OrderStatus.PAID, ReservationStatus.CONSUMED);
      prismaMock.order.findUnique.mockResolvedValue(paidOrder);

      await expect(
        service.transitionOrderStatus(mockOrderId, OrderStatus.PREPARING, { role: UserRole.CUSTOMER }),
      ).rejects.toThrow(OrderActionForbiddenException);
    });

    // 5. CUSTOMER không được phép PREPARING -> READY
    it('VI.5: forbids CUSTOMER from PREPARING -> READY', async () => {
      const preparingOrder = createMockOrder(OrderStatus.PREPARING, ReservationStatus.CONSUMED);
      prismaMock.order.findUnique.mockResolvedValue(preparingOrder);

      await expect(
        service.transitionOrderStatus(mockOrderId, OrderStatus.READY, { role: UserRole.CUSTOMER }),
      ).rejects.toThrow(OrderActionForbiddenException);
    });

    // 6. CUSTOMER không được phép READY -> COMPLETED
    it('VI.6: forbids CUSTOMER from READY -> COMPLETED', async () => {
      const readyOrder = createMockOrder(OrderStatus.READY, ReservationStatus.CONSUMED);
      prismaMock.order.findUnique.mockResolvedValue(readyOrder);

      await expect(
        service.transitionOrderStatus(mockOrderId, OrderStatus.COMPLETED, { role: UserRole.CUSTOMER }),
      ).rejects.toThrow(OrderActionForbiddenException);
    });

    // 7. BARISTA được phép PAID -> PREPARING
    it('VI.7: allows BARISTA for PAID -> PREPARING', async () => {
      const paidOrder = createMockOrder(OrderStatus.PAID, ReservationStatus.CONSUMED);
      prismaMock.order.findUnique.mockResolvedValue(paidOrder);
      prismaMock.order.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.order.findUniqueOrThrow.mockResolvedValue({
        ...paidOrder,
        status: OrderStatus.PREPARING,
      });

      const res = await service.transitionOrderStatus(mockOrderId, OrderStatus.PREPARING, { role: UserRole.BARISTA });
      expect(res.status).toBe(OrderStatus.PREPARING);
    });

    // 8. BARISTA được phép PREPARING -> READY
    it('VI.8: allows BARISTA for PREPARING -> READY', async () => {
      const preparingOrder = createMockOrder(OrderStatus.PREPARING, ReservationStatus.CONSUMED);
      prismaMock.order.findUnique.mockResolvedValue(preparingOrder);
      prismaMock.order.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.order.findUniqueOrThrow.mockResolvedValue({
        ...preparingOrder,
        status: OrderStatus.READY,
      });

      const res = await service.transitionOrderStatus(mockOrderId, OrderStatus.READY, { role: UserRole.BARISTA });
      expect(res.status).toBe(OrderStatus.READY);
    });

    // 9. BARISTA được phép READY -> COMPLETED
    it('VI.9: allows BARISTA for READY -> COMPLETED', async () => {
      const readyOrder = createMockOrder(OrderStatus.READY, ReservationStatus.CONSUMED);
      prismaMock.order.findUnique.mockResolvedValue(readyOrder);
      prismaMock.order.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.order.findUniqueOrThrow.mockResolvedValue({
        ...readyOrder,
        status: OrderStatus.COMPLETED,
      });

      const res = await service.transitionOrderStatus(mockOrderId, OrderStatus.COMPLETED, { role: UserRole.BARISTA });
      expect(res.status).toBe(OrderStatus.COMPLETED);
    });

    // 10. Payment callback lặp vẫn idempotent
    it('VI.10: repeated payment callback remains idempotent without DB updates', async () => {
      const paidOrder = createMockOrder(OrderStatus.PAID, ReservationStatus.CONSUMED, 2);
      prismaMock.order.findUnique.mockResolvedValue(paidOrder);

      const res = await service.handlePaymentSuccess(mockOrderId);
      expect(res.status).toBe(OrderStatus.PAID);
      expect(prismaMock.order.updateMany).not.toHaveBeenCalled();
      expect(prismaMock.orderInventoryReservation.updateMany).not.toHaveBeenCalled();
      expect(prismaMock.ingredient.updateMany).not.toHaveBeenCalled();
      expect(prismaMock.orderStatusHistory.create).not.toHaveBeenCalled();
    });

    // 11 - 14: Sai actor không làm thay đổi Order, Reservation, Ingredient, hoặc History
    it('VI.11-14: unauthorized actor does NOT create history, bump version, or modify stock', async () => {
      const pendingOrder = createMockOrder(OrderStatus.PENDING, ReservationStatus.ACTIVE, 1);
      prismaMock.order.findUnique.mockResolvedValue(pendingOrder);

      await expect(
        service.transitionOrderStatus(mockOrderId, OrderStatus.PAID, { role: UserRole.CUSTOMER }),
      ).rejects.toThrow(OrderActionForbiddenException);

      // Verify no database modifications were invoked:
      expect(prismaMock.order.updateMany).not.toHaveBeenCalled();
      expect(prismaMock.orderInventoryReservation.updateMany).not.toHaveBeenCalled();
      expect(prismaMock.ingredient.updateMany).not.toHaveBeenCalled();
      expect(prismaMock.orderStatusHistory.create).not.toHaveBeenCalled();
    });

    // 15. Exception transition không hợp lệ chuẩn hóa: chỉ dùng InvalidOrderTransitionException
    it('VI.15: standardized InvalidOrderTransitionException with HTTP 409 status', async () => {
      const pendingOrder = createMockOrder(OrderStatus.PENDING, ReservationStatus.ACTIVE);
      prismaMock.order.findUnique.mockResolvedValue(pendingOrder);

      try {
        await service.transitionOrderStatus(mockOrderId, OrderStatus.COMPLETED, { role: UserRole.BARISTA });
        fail('Should have thrown InvalidOrderTransitionException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(InvalidOrderTransitionException);
        expect(err.getStatus()).toBe(409);
      }
    });

    // 16. Terminal state vẫn không thể chuyển tiếp
    it('VI.16: terminal states COMPLETED and CANCELLED cannot transition', async () => {
      const completedOrder = createMockOrder(OrderStatus.COMPLETED, ReservationStatus.CONSUMED);
      prismaMock.order.findUnique.mockResolvedValue(completedOrder);

      await expect(
        service.transitionOrderStatus(mockOrderId, OrderStatus.PENDING, { role: 'SYSTEM' }),
      ).rejects.toThrow(InvalidOrderTransitionException);

      const cancelledOrder = createMockOrder(OrderStatus.CANCELLED, ReservationStatus.RELEASED);
      prismaMock.order.findUnique.mockResolvedValue(cancelledOrder);

      await expect(
        service.transitionOrderStatus(mockOrderId, OrderStatus.PENDING, { role: 'SYSTEM' }),
      ).rejects.toThrow(InvalidOrderTransitionException);
    });

    // 17. Retry PAYMENT_FAILED -> PENDING chỉ được actor hợp lệ thực hiện
    it('VI.17: retry PAYMENT_FAILED -> PENDING allowed for CUSTOMER/SYSTEM, forbidden for BARISTA', async () => {
      const failedOrder = createMockOrder(OrderStatus.PAYMENT_FAILED, ReservationStatus.RELEASED);
      prismaMock.order.findUnique.mockResolvedValue(failedOrder);
      prismaMock.$queryRaw.mockResolvedValue([
        { ...mockIngredientA },
        { ...mockIngredientB },
      ]);
      prismaMock.ingredient.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.orderInventoryReservation.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.order.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.order.findUniqueOrThrow.mockResolvedValue({
        ...failedOrder,
        status: OrderStatus.PENDING,
      });

      // CUSTOMER được phép retry
      const retryRes = await service.transitionOrderStatus(mockOrderId, OrderStatus.PENDING, { role: UserRole.CUSTOMER });
      expect(retryRes.status).toBe(OrderStatus.PENDING);

      // BARISTA bị cấm retry thanh toán
      await expect(
        service.transitionOrderStatus(mockOrderId, OrderStatus.PENDING, { role: UserRole.BARISTA }),
      ).rejects.toThrow(OrderActionForbiddenException);
    });
  });
});
