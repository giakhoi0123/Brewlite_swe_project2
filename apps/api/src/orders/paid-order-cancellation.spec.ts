import {
  OrderStatus,
  Prisma,
  ReservationStatus,
  UserRole,
} from '@prisma/client';
import { PromotionsService } from '../promotions/promotions.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  OrderActionForbiddenException,
  OrderCancellationNotAllowedException,
  OrderRefundUnavailableException,
  OrderStateConflictException,
} from './orders.exceptions';
import { OrdersService } from './orders.service';
import { PaidOrderRefundPort } from './ports/paid-order-refund.port';

describe('OrdersService paid-order cancellation by Barista', () => {
  const orderId = '10000000-0000-4000-8000-000000000001';
  const actorId = '20000000-0000-4000-8000-000000000001';
  const reservationId = '30000000-0000-4000-8000-000000000001';
  const ingredientId = '40000000-0000-4000-8000-000000000001';

  function setup(status: OrderStatus = OrderStatus.PAID) {
    const paidOrder = {
      id: orderId,
      status,
      version: 2,
      reservation: {
        id: reservationId,
        status: ReservationStatus.CONSUMED,
        version: 2,
        lines: [
          {
            id: '50000000-0000-4000-8000-000000000001',
            reservationId,
            ingredientId,
            amount: new Prisma.Decimal(30),
          },
        ],
      },
    };
    const tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ role: UserRole.BARISTA }),
      },
      order: {
        findUnique: jest.fn().mockResolvedValue(paidOrder),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: orderId,
          status: OrderStatus.CANCELLED,
          version: 3,
        }),
      },
      ingredient: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      orderInventoryReservation: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      orderStatusHistory: { create: jest.fn().mockResolvedValue({}) },
      $queryRaw: jest.fn().mockResolvedValue([
        {
          id: ingredientId,
          name: 'Coffee',
          stock: new Prisma.Decimal(70),
          version: 4,
        },
      ]),
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const refund = {
      refundPaidOrderInTransaction: jest.fn().mockResolvedValue({
        refundId: '60000000-0000-4000-8000-000000000001',
        paymentId: '70000000-0000-4000-8000-000000000001',
        amount: new Prisma.Decimal(45000),
        status: 'REFUNDED' as const,
        alreadyRefunded: false,
      }),
    };
    const service = new OrdersService(
      prisma as unknown as PrismaService,
      {} as PromotionsService,
      refund as PaidOrderRefundPort,
    );
    return { service, prisma, refund, tx, paidOrder };
  }

  const barista = { userId: actorId, role: UserRole.BARISTA };

  it('refunds and restores the exact 30g snapshot once for a PAID order', async () => {
    const { service, refund, tx } = setup();

    const result = await service.cancelPaidOrderByBarista(
      orderId,
      barista,
      'Customer requested cancellation',
    );

    expect(result.order.status).toBe(OrderStatus.CANCELLED);
    expect(result.alreadyCancelled).toBe(false);
    expect(refund.refundPaidOrderInTransaction).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ orderId, actorId }),
    );
    expect(tx.ingredient.updateMany).toHaveBeenCalledWith({
      where: { id: ingredientId, version: 4 },
      data: { stock: new Prisma.Decimal(100), version: { increment: 1 } },
    });
    expect(tx.orderInventoryReservation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: ReservationStatus.CONSUMED,
          version: 2,
        }),
        data: expect.objectContaining({ status: ReservationStatus.RELEASED }),
      }),
    );
    expect(tx.orderStatusHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fromStatus: OrderStatus.PAID,
        toStatus: OrderStatus.CANCELLED,
        actorId,
      }),
    });
  });

  it('replays the existing refund for CANCELLED without restoring stock again', async () => {
    const { service, refund, tx } = setup(OrderStatus.CANCELLED);
    refund.refundPaidOrderInTransaction.mockResolvedValueOnce({
      refundId: '60000000-0000-4000-8000-000000000001',
      paymentId: '70000000-0000-4000-8000-000000000001',
      amount: new Prisma.Decimal(45000),
      status: 'REFUNDED',
      alreadyRefunded: true,
    });
    const result = await service.cancelPaidOrderByBarista(orderId, barista);

    expect(result.alreadyCancelled).toBe(true);
    expect(result.refund.alreadyRefunded).toBe(true);
    expect(tx.ingredient.updateMany).not.toHaveBeenCalled();
    expect(tx.orderInventoryReservation.updateMany).not.toHaveBeenCalled();
    expect(tx.order.updateMany).not.toHaveBeenCalled();
    expect(tx.orderStatusHistory.create).not.toHaveBeenCalled();
  });

  it.each([OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.COMPLETED])(
    'rejects cancellation when the database status is %s',
    async (status) => {
      const { service, refund, tx } = setup(status);

      await expect(
        service.cancelPaidOrderByBarista(orderId, barista),
      ).rejects.toBeInstanceOf(OrderCancellationNotAllowedException);
      expect(refund.refundPaidOrderInTransaction).not.toHaveBeenCalled();
      expect(tx.ingredient.updateMany).not.toHaveBeenCalled();
    },
  );

  it('rejects a non-BARISTA before opening the transaction', async () => {
    const { service, prisma, refund } = setup();

    await expect(
      service.cancelPaidOrderByBarista(orderId, {
        userId: actorId,
        role: UserRole.MANAGER,
      }),
    ).rejects.toBeInstanceOf(OrderActionForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(refund.refundPaidOrderInTransaction).not.toHaveBeenCalled();
  });

  it('fails closed before the transaction when no refund provider is bound', async () => {
    const { prisma } = setup();
    const service = new OrdersService(
      prisma as unknown as PrismaService,
      {} as PromotionsService,
    );

    await expect(
      service.cancelPaidOrderByBarista(orderId, barista),
    ).rejects.toBeInstanceOf(OrderRefundUnavailableException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects when the persisted database role is no longer BARISTA', async () => {
    const { service, refund, tx } = setup();
    tx.user.findUnique.mockResolvedValueOnce({ role: UserRole.CUSTOMER });

    await expect(
      service.cancelPaidOrderByBarista(orderId, barista),
    ).rejects.toBeInstanceOf(OrderActionForbiddenException);
    expect(refund.refundPaidOrderInTransaction).not.toHaveBeenCalled();
    expect(tx.order.findUnique).not.toHaveBeenCalled();
  });

  it('does not mutate Orders or inventory when recording the refund fails', async () => {
    const { service, refund, tx } = setup();
    refund.refundPaidOrderInTransaction.mockRejectedValueOnce(
      new Error('refund persistence failed'),
    );

    await expect(
      service.cancelPaidOrderByBarista(orderId, barista),
    ).rejects.toThrow('refund persistence failed');
    expect(tx.ingredient.updateMany).not.toHaveBeenCalled();
    expect(tx.orderInventoryReservation.updateMany).not.toHaveBeenCalled();
    expect(tx.order.updateMany).not.toHaveBeenCalled();
    expect(tx.orderStatusHistory.create).not.toHaveBeenCalled();
  });

  it('fails the cancellation on an accept/cancel optimistic-lock race', async () => {
    const { service, tx } = setup();
    tx.order.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      service.cancelPaidOrderByBarista(orderId, barista),
    ).rejects.toBeInstanceOf(OrderStateConflictException);
  });
});
