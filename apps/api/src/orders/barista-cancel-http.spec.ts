import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { OrderStatus, Prisma, UserRole } from '@prisma/client';
import * as request from 'supertest';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { BaristaController } from './barista.controller';
import {
  OrderCancellationNotAllowedException,
  OrderRefundUnavailableException,
} from './orders.exceptions';
import { OrdersService } from './orders.service';

describe('POST /api/barista/orders/:orderId/cancel HTTP contract', () => {
  const orderId = '10000000-0000-4000-8000-000000000001';
  const actorId = '20000000-0000-4000-8000-000000000001';
  let app: INestApplication;
  let mode: 'SUCCESS' | 'PREPARING' | 'REFUND_UNAVAILABLE';
  let refundWrites: number;
  let inventoryRestoreWrites: number;
  let cancelled: boolean;

  const authGuard: CanActivate = {
    canActivate(context: ExecutionContext) {
      const req = context.switchToHttp().getRequest();
      const token = String(req.headers.authorization || '').replace(
        'Bearer ',
        '',
      );
      const roles: Record<string, UserRole> = {
        barista: UserRole.BARISTA,
        customer: UserRole.CUSTOMER,
        manager: UserRole.MANAGER,
      };
      if (!roles[token]) throw new UnauthorizedException();
      req.user = { userId: actorId, role: roles[token] };
      return true;
    },
  };

  const ordersService = {
    async cancelPaidOrderByBarista(
      requestedOrderId: string,
      actor: { userId: string; role: UserRole },
    ) {
      expect(requestedOrderId).toBe(orderId);
      expect(actor).toEqual({ userId: actorId, role: UserRole.BARISTA });
      if (mode === 'PREPARING') {
        throw new OrderCancellationNotAllowedException(
          orderId,
          OrderStatus.PREPARING,
        );
      }
      if (mode === 'REFUND_UNAVAILABLE') {
        throw new OrderRefundUnavailableException();
      }
      const replay = cancelled;
      if (!cancelled) {
        refundWrites += 1;
        inventoryRestoreWrites += 1;
        cancelled = true;
      }
      return {
        order: { id: orderId, status: OrderStatus.CANCELLED },
        refund: {
          refundId: '30000000-0000-4000-8000-000000000001',
          paymentId: '40000000-0000-4000-8000-000000000001',
          amount: new Prisma.Decimal(45000),
          status: 'REFUNDED' as const,
          alreadyRefunded: replay,
        },
        alreadyCancelled: replay,
      };
    },
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [BaristaController],
      providers: [
        { provide: OrdersService, useValue: ordersService },
        RolesGuard,
        Reflector,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(authGuard)
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  beforeEach(() => {
    mode = 'SUCCESS';
    refundWrites = 0;
    inventoryRestoreWrites = 0;
    cancelled = false;
  });

  afterAll(async () => app.close());

  it('returns the simulated refund and replays it without duplicate writes', async () => {
    const first = await request(app.getHttpServer())
      .post(`/api/barista/orders/${orderId}/cancel`)
      .set('Authorization', 'Bearer barista')
      .send({ reason: 'Customer changed their mind' })
      .expect(200);

    expect(first.body).toEqual({
      orderId,
      status: OrderStatus.CANCELLED,
      refund: {
        refundId: '30000000-0000-4000-8000-000000000001',
        paymentId: '40000000-0000-4000-8000-000000000001',
        amount: 45000,
        status: 'REFUNDED',
      },
      alreadyCancelled: false,
    });

    const replay = await request(app.getHttpServer())
      .post(`/api/barista/orders/${orderId}/cancel`)
      .set('Authorization', 'Bearer barista')
      .send({})
      .expect(200);

    expect(replay.body.alreadyCancelled).toBe(true);
    expect(replay.body.refund).toEqual(first.body.refund);
    expect(refundWrites).toBe(1);
    expect(inventoryRestoreWrites).toBe(1);
  });

  it('returns a reloadable 409 contract when preparation has started', async () => {
    mode = 'PREPARING';
    const response = await request(app.getHttpServer())
      .post(`/api/barista/orders/${orderId}/cancel`)
      .set('Authorization', 'Bearer barista')
      .send({})
      .expect(409);

    expect(response.body).toEqual(
      expect.objectContaining({
        code: 'ORDER_ALREADY_PREPARING',
        orderId,
        currentStatus: OrderStatus.PREPARING,
      }),
    );
  });

  it('returns 401 without authentication', () =>
    request(app.getHttpServer())
      .post(`/api/barista/orders/${orderId}/cancel`)
      .send({})
      .expect(401));

  it.each(['customer', 'manager'])('returns 403 for %s', (token) =>
    request(app.getHttpServer())
      .post(`/api/barista/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(403),
  );

  it('returns 503 and performs no simulated writes without a refund provider', async () => {
    mode = 'REFUND_UNAVAILABLE';
    const response = await request(app.getHttpServer())
      .post(`/api/barista/orders/${orderId}/cancel`)
      .set('Authorization', 'Bearer barista')
      .send({})
      .expect(503);

    expect(response.body.code).toBe('ORDER_REFUND_UNAVAILABLE');
    expect(refundWrites).toBe(0);
    expect(inventoryRestoreWrites).toBe(0);
  });
});
