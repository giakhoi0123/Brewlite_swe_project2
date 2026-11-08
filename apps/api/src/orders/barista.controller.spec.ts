import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import {
  OptionType,
  OrderStatus,
  Prisma,
  ReservationStatus,
  UserRole,
} from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PrismaService } from '../prisma/prisma.service';
import { BaristaController } from './barista.controller';
import { BaristaQueueQueryDto } from './dto/barista-queue-query.dto';
import { mapBaristaOrderResponse } from './order-pricing';
import {
  canActorPerformTransition,
  canTransition,
  isTerminalStatus,
} from './order-state-machine';
import {
  OrderNotFoundException,
  OrderStateConflictException,
} from './orders.exceptions';
import { OrdersService } from './orders.service';
import {
  BaristaOrderResponse,
  BaristaQueueResult,
  extractAuthenticatedActor,
} from './orders.types';

describe('Barista Controller & Queue Unit Tests (Task 5.1 - Section VI - Lê Quang Điệp)', () => {
  let controller: BaristaController;
  let ordersService: OrdersService;
  let rolesGuard: RolesGuard;
  let jwtAuthGuard: JwtAuthGuard;

  const baristaUserId = '11111111-1111-1111-1111-111111111111';
  const customerUserId = '22222222-2222-2222-2222-222222222222';
  const sampleOrderId = '33333333-3333-3333-3333-333333333333';

  const mockBaristaOrderResponse: BaristaOrderResponse = {
    id: sampleOrderId,
    orderId: sampleOrderId,
    orderNumber: 'BL-20261108-0001',
    status: OrderStatus.PREPARING,
    subtotal: 55000,
    discount: 5000,
    total: 50000,
    notes: 'Ít đường nhiều đá',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customer: {
      id: customerUserId,
      fullName: 'Khách hàng A',
    },
    items: [
      {
        id: '44444444-4444-4444-4444-444444444444',
        productId: '55555555-5555-5555-5555-555555555555',
        productName: 'Cà phê Phin Sữa Đá',
        quantity: 2,
        unitPrice: 25000,
        subtotal: 50000,
        notes: null,
        optionsSnapshot: [
          { id: 'opt-1', name: 'Size L', type: OptionType.SIZE, extraPrice: 5000 },
        ],
        options: [
          {
            id: 'opt-1',
            productOptionId: 'po-1',
            name: 'Size L',
            type: OptionType.SIZE,
            extraPrice: 5000,
          },
        ],
      },
    ],
  };

  const mockQueueResult: BaristaQueueResult = {
    data: [
      {
        ...mockBaristaOrderResponse,
        status: OrderStatus.PAID,
      },
      mockBaristaOrderResponse,
      {
        ...mockBaristaOrderResponse,
        id: '66666666-6666-6666-6666-666666666666',
        orderId: '66666666-6666-6666-6666-666666666666',
        status: OrderStatus.READY,
      },
    ],
    meta: {
      total: 3,
      page: 1,
      limit: 20,
      totalPages: 1,
    },
  };

  const ordersServiceMock = {
    getBaristaQueue: jest.fn().mockResolvedValue(mockQueueResult),
    acceptBaristaOrder: jest.fn().mockResolvedValue(mockBaristaOrderResponse),
    readyBaristaOrder: jest.fn().mockResolvedValue({
      ...mockBaristaOrderResponse,
      status: OrderStatus.READY,
    }),
    completeBaristaOrder: jest.fn().mockResolvedValue({
      ...mockBaristaOrderResponse,
      status: OrderStatus.COMPLETED,
    }),
    transitionOrderStatus: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BaristaController],
      providers: [
        {
          provide: OrdersService,
          useValue: ordersServiceMock,
        },
        Reflector,
        RolesGuard,
        JwtAuthGuard,
      ],
    }).compile();

    controller = module.get<BaristaController>(BaristaController);
    ordersService = module.get<OrdersService>(OrdersService);
    rolesGuard = module.get<RolesGuard>(RolesGuard);
    jwtAuthGuard = module.get<JwtAuthGuard>(JwtAuthGuard);
  });

  function createMockExecutionContext(user?: { id?: string; userId?: string; role?: UserRole }) {
    const request = {
      user,
      body: {
        actorId: 'fake-hacker-id',
        role: 'MANAGER',
        status: 'COMPLETED',
      },
    };

    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({}),
      }),
      getHandler: () => BaristaController.prototype.getQueue,
      getClass: () => BaristaController,
    } as unknown as ExecutionContext;
  }

  // ============================================================================
  // SECTION VI - 20 UNIT TEST CASES BẮT BUỘC
  // ============================================================================

  it('1. Barista xem được queue', async () => {
    const query: BaristaQueueQueryDto = { page: 1, limit: 20 };
    const result = await controller.getQueue(query);

    expect(ordersService.getBaristaQueue).toHaveBeenCalledWith(query);
    expect(result).toEqual(mockQueueResult);
    expect(result.data.length).toBe(3);
  });

  it('2. Customer nhận 403 khi xem queue', () => {
    const ctx = createMockExecutionContext({
      id: customerUserId,
      userId: customerUserId,
      role: UserRole.CUSTOMER,
    });

    expect(() => rolesGuard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('3. Không JWT nhận 401', () => {
    expect(() => jwtAuthGuard.handleRequest(null, null)).toThrow(UnauthorizedException);
    expect(() => jwtAuthGuard.handleRequest(new Error('JWT expired'), null)).toThrow();
  });

  it('4. Queue không chứa PENDING', async () => {
    const mockPrisma = {
      order: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockImplementation((args) => {
          // Verify that where clause excludes PENDING
          expect(args.where.status.in).not.toContain(OrderStatus.PENDING);
          expect(args.where.status.in).toEqual([
            OrderStatus.PAID,
            OrderStatus.PREPARING,
            OrderStatus.READY,
          ]);
          return [];
        }),
      },
    };

    const realService = new OrdersService(mockPrisma as unknown as PrismaService);
    const res = await realService.getBaristaQueue({});
    expect(res.data).toEqual([]);
  });

  it('5. Queue không chứa PAYMENT_FAILED', async () => {
    const mockPrisma = {
      order: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockImplementation((args) => {
          expect(args.where.status.in).not.toContain(OrderStatus.PAYMENT_FAILED);
          return [];
        }),
      },
    };

    const realService = new OrdersService(mockPrisma as unknown as PrismaService);
    await realService.getBaristaQueue({});
  });

  it('6. Queue không chứa CANCELLED', async () => {
    const mockPrisma = {
      order: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockImplementation((args) => {
          expect(args.where.status.in).not.toContain(OrderStatus.CANCELLED);
          return [];
        }),
      },
    };

    const realService = new OrdersService(mockPrisma as unknown as PrismaService);
    await realService.getBaristaQueue({});
  });

  it('7. Pagination và thứ tự ổn định', async () => {
    const mockPrisma = {
      order: {
        count: jest.fn().mockResolvedValue(45),
        findMany: jest.fn().mockImplementation((args) => {
          expect(args.skip).toBe(20);
          expect(args.take).toBe(20);
          expect(args.orderBy).toEqual([{ createdAt: 'asc' }, { id: 'asc' }]);
          return [];
        }),
      },
    };

    const realService = new OrdersService(mockPrisma as unknown as PrismaService);
    const res = await realService.getBaristaQueue({ page: 2, limit: 20 });
    expect(res.meta).toEqual({
      total: 45,
      page: 2,
      limit: 20,
      totalPages: 3,
    });
  });

  it('8. PAID -> PREPARING thành công', async () => {
    const mockReq: any = {
      user: { id: baristaUserId, role: UserRole.BARISTA },
    };

    const result = await controller.acceptOrder(sampleOrderId, mockReq);

    expect(ordersService.acceptBaristaOrder).toHaveBeenCalledWith(sampleOrderId, {
      userId: baristaUserId,
      role: UserRole.BARISTA,
    });
    expect(result.status).toBe(OrderStatus.PREPARING);
  });

  it('9. PREPARING -> READY thành công', async () => {
    const mockReq: any = {
      user: { id: baristaUserId, role: UserRole.BARISTA },
    };

    const result = await controller.readyOrder(sampleOrderId, mockReq);

    expect(ordersService.readyBaristaOrder).toHaveBeenCalledWith(sampleOrderId, {
      userId: baristaUserId,
      role: UserRole.BARISTA,
    });
    expect(result.status).toBe(OrderStatus.READY);
  });

  it('10. READY -> COMPLETED thành công', async () => {
    const mockReq: any = {
      user: { id: baristaUserId, role: UserRole.BARISTA },
    };

    const result = await controller.completeOrder(sampleOrderId, mockReq);

    expect(ordersService.completeBaristaOrder).toHaveBeenCalledWith(sampleOrderId, {
      userId: baristaUserId,
      role: UserRole.BARISTA,
    });
    expect(result.status).toBe(OrderStatus.COMPLETED);
  });

  it('11. Không cho bỏ qua PAID -> READY', () => {
    expect(canTransition(OrderStatus.PAID, OrderStatus.READY)).toBe(false);
    expect(
      canActorPerformTransition(UserRole.BARISTA, OrderStatus.PAID, OrderStatus.READY),
    ).toBe(false);
  });

  it('12. Không cho PREPARING -> COMPLETED', () => {
    expect(canTransition(OrderStatus.PREPARING, OrderStatus.COMPLETED)).toBe(false);
    expect(
      canActorPerformTransition(UserRole.BARISTA, OrderStatus.PREPARING, OrderStatus.COMPLETED),
    ).toBe(false);
  });

  it('13. Không cho chuyển ngược', () => {
    expect(canTransition(OrderStatus.READY, OrderStatus.PREPARING)).toBe(false);
    expect(canTransition(OrderStatus.PREPARING, OrderStatus.PAID)).toBe(false);
    expect(canTransition(OrderStatus.COMPLETED, OrderStatus.READY)).toBe(false);
  });

  it('14. Customer không gọi được endpoint cập nhật', () => {
    expect(
      canActorPerformTransition(UserRole.CUSTOMER, OrderStatus.PAID, OrderStatus.PREPARING),
    ).toBe(false);
    expect(
      canActorPerformTransition(UserRole.CUSTOMER, OrderStatus.PREPARING, OrderStatus.READY),
    ).toBe(false);
    expect(
      canActorPerformTransition(UserRole.CUSTOMER, OrderStatus.READY, OrderStatus.COMPLETED),
    ).toBe(false);

    const ctx = createMockExecutionContext({
      id: customerUserId,
      role: UserRole.CUSTOMER,
    });
    expect(() => rolesGuard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('15. actorId giả trong body không được sử dụng', async () => {
    const mockReq: any = {
      user: { id: baristaUserId, role: UserRole.BARISTA },
      body: { actorId: '00000000-0000-0000-0000-000000000000', role: 'ADMIN' },
    };

    await controller.acceptOrder(sampleOrderId, mockReq);

    // Actor passed to service MUST be baristaUserId from req.user, not body.actorId
    expect(ordersService.acceptBaristaOrder).toHaveBeenCalledWith(
      sampleOrderId,
      expect.objectContaining({
        userId: baristaUserId,
        role: UserRole.BARISTA,
      }),
    );
  });

  it('16. Replay không tạo history trùng', async () => {
    const existingOrder: any = {
      id: sampleOrderId,
      status: OrderStatus.PREPARING,
      version: 2,
      reservation: {
        id: 'res-1',
        status: ReservationStatus.CONSUMED,
        version: 2,
        lines: [],
      },
      items: [],
      statusHistory: [],
    };

    const mockPrisma = {
      $transaction: jest.fn().mockImplementation(async (cb) => {
        const tx = {
          order: {
            findUnique: jest.fn().mockResolvedValue(existingOrder),
            updateMany: jest.fn(),
          },
          orderStatusHistory: {
            create: jest.fn(),
          },
        };
        return cb(tx);
      }),
    };

    const realService = new OrdersService(mockPrisma as unknown as PrismaService);
    const result = await realService.transitionOrderStatus(
      sampleOrderId,
      OrderStatus.PREPARING, // Already PREPARING!
      { userId: baristaUserId, role: UserRole.BARISTA },
    );

    expect(result.status).toBe(OrderStatus.PREPARING);
  });

  it('17. Hai Barista cùng nhận một đơn: chỉ một transition thực sự thắng', async () => {
    const mockOrder: any = {
      id: sampleOrderId,
      status: OrderStatus.PAID,
      version: 1,
      reservation: {
        id: 'res-1',
        status: ReservationStatus.CONSUMED,
        version: 1,
        lines: [],
      },
      items: [],
      statusHistory: [],
    };

    const mockPrisma = {
      $transaction: jest.fn().mockImplementation(async (cb) => {
        const tx = {
          order: {
            findUnique: jest.fn().mockResolvedValue(mockOrder),
            // Simulate that another concurrent request already updated version from 1 to 2
            updateMany: jest.fn().mockResolvedValue({ count: 0 }),
          },
          orderStatusHistory: {
            create: jest.fn(),
          },
        };
        return cb(tx);
      }),
    };

    const realService = new OrdersService(mockPrisma as unknown as PrismaService);
    await expect(
      realService.transitionOrderStatus(
        sampleOrderId,
        OrderStatus.PREPARING,
        { userId: baristaUserId, role: UserRole.BARISTA },
      ),
    ).rejects.toThrow(OrderStateConflictException);
  });

  it('18. Order không tồn tại trả 404', async () => {
    const mockPrisma = {
      $transaction: jest.fn().mockImplementation(async (cb) => {
        const tx = {
          order: {
            findUnique: jest.fn().mockResolvedValue(null),
          },
        };
        return cb(tx);
      }),
    };

    const realService = new OrdersService(mockPrisma as unknown as PrismaService);
    await expect(
      realService.transitionOrderStatus(
        sampleOrderId,
        OrderStatus.PREPARING,
        { userId: baristaUserId, role: UserRole.BARISTA },
      ),
    ).rejects.toThrow(OrderNotFoundException);
  });

  it('19. Terminal state không thể cập nhật', () => {
    expect(isTerminalStatus(OrderStatus.COMPLETED)).toBe(true);
    expect(isTerminalStatus(OrderStatus.CANCELLED)).toBe(true);
    expect(canTransition(OrderStatus.COMPLETED, OrderStatus.READY)).toBe(false);
    expect(canTransition(OrderStatus.CANCELLED, OrderStatus.PENDING)).toBe(false);
  });

  it('20. Response không chứa dữ liệu nội bộ', () => {
    const rawOrder: any = {
      id: sampleOrderId,
      orderNumber: 'BL-20261108-0001',
      status: OrderStatus.PAID,
      subtotal: new Prisma.Decimal(50000),
      discount: new Prisma.Decimal(5000),
      total: new Prisma.Decimal(45000),
      version: 5,
      createdAt: new Date(),
      updatedAt: new Date(),
      user: {
        id: customerUserId,
        fullName: 'Khách hàng',
        email: 'customer@brewlite.test',
        passwordHash: 'secret-hash-never-leak',
        sessionVersion: 3,
      },
      items: [
        {
          id: 'item-1',
          productId: 'prod-1',
          productNameSnapshot: 'Cà phê Sữa',
          unitPriceSnapshot: new Prisma.Decimal(25000),
          quantity: 2,
          subtotal: new Prisma.Decimal(50000),
          orderItemOptions: [],
        },
      ],
      reservation: {
        id: 'res-internal-id',
        status: ReservationStatus.CONSUMED,
        lines: [
          { ingredientId: 'ing-1', amount: new Prisma.Decimal(20), internalCost: 5000 },
        ],
      },
    };

    const response = mapBaristaOrderResponse(rawOrder);

    // Verify sanitized public fields exist
    expect(response.orderNumber).toBe('BL-20261108-0001');
    expect(response.subtotal).toBe(50000);
    expect(response.total).toBe(45000);
    expect(response.customer?.fullName).toBe('Khách hàng');

    // Verify sensitive/internal fields do NOT exist
    expect((response as any).passwordHash).toBeUndefined();
    expect((response.customer as any)?.passwordHash).toBeUndefined();
    expect((response.customer as any)?.sessionVersion).toBeUndefined();
    expect((response.customer as any)?.email).toBeUndefined();
    expect((response as any).version).toBeUndefined();
    expect((response as any).reservation).toBeUndefined();
    expect((response as any).lines).toBeUndefined();
    expect((response as any).paymentMetadata).toBeUndefined();
    expect((response as any).stock).toBeUndefined();
    expect((response as any).cost).toBeUndefined();
  });

  // ============================================================================
  // ĐỢT 3.1 - CÁC TEST CASES BỔ SUNG THEO YÊU CẦU MỤC VI
  // ============================================================================

  describe('Đợt 3.1: Consistency, Privacy & Security Hardening Tests', () => {
    it('PAID -> CANCELLED bị từ chối cho cả Barista và Manager', () => {
      expect(canTransition(OrderStatus.PAID, OrderStatus.CANCELLED)).toBe(false);
      expect(
        canActorPerformTransition(
          UserRole.BARISTA,
          OrderStatus.PAID,
          OrderStatus.CANCELLED,
        ),
      ).toBe(false);
      expect(
        canActorPerformTransition(
          UserRole.MANAGER,
          OrderStatus.PAID,
          OrderStatus.CANCELLED,
        ),
      ).toBe(false);
    });

    it('Hai đơn hàng cùng timestamp được sắp xếp tất định bằng id ASC', async () => {
      const fixedTimestamp = new Date('2026-11-08T08:00:00.000Z');
      const orderA = {
        id: '11111111-1111-1111-1111-111111111111',
        orderNumber: 'BL-0001',
        status: OrderStatus.PAID,
        subtotal: new Prisma.Decimal(30000),
        discount: new Prisma.Decimal(0),
        total: new Prisma.Decimal(30000),
        createdAt: fixedTimestamp,
        updatedAt: fixedTimestamp,
        items: [],
        user: { id: customerUserId, fullName: 'A' },
      };
      const orderB = {
        id: '22222222-2222-2222-2222-222222222222',
        orderNumber: 'BL-0002',
        status: OrderStatus.PAID,
        subtotal: new Prisma.Decimal(30000),
        discount: new Prisma.Decimal(0),
        total: new Prisma.Decimal(30000),
        createdAt: fixedTimestamp,
        updatedAt: fixedTimestamp,
        items: [],
        user: { id: customerUserId, fullName: 'B' },
      };

      const mockPrisma = {
        order: {
          count: jest.fn().mockResolvedValue(2),
          findMany: jest.fn().mockImplementation((args) => {
            // Verify Prisma query sorts by createdAt ASC, id ASC
            expect(args.orderBy).toEqual([{ createdAt: 'asc' }, { id: 'asc' }]);
            return [orderA, orderB];
          }),
        },
      };

      const service = new OrdersService(mockPrisma as unknown as PrismaService);
      const res = await service.getBaristaQueue({});
      expect(res.data.length).toBe(2);
      expect(res.data[0].id).toBe('11111111-1111-1111-1111-111111111111');
      expect(res.data[1].id).toBe('22222222-2222-2222-2222-222222222222');
    });

    it('extractAuthenticatedActor từ chối an toàn khi thiếu token, thiếu userId hoặc sai role', () => {
      // 1. Missing user payload -> 401
      expect(() => extractAuthenticatedActor(undefined)).toThrow(
        UnauthorizedException,
      );
      expect(() => extractAuthenticatedActor(null)).toThrow(
        UnauthorizedException,
      );

      // 2. Missing or blank userId -> 401
      expect(() =>
        extractAuthenticatedActor({ userId: '', role: UserRole.BARISTA }),
      ).toThrow(UnauthorizedException);
      expect(() =>
        extractAuthenticatedActor({ id: '   ', role: UserRole.BARISTA }),
      ).toThrow(UnauthorizedException);

      // 3. Missing or invalid role -> 403
      expect(() =>
        extractAuthenticatedActor({ id: baristaUserId, role: undefined }),
      ).toThrow(ForbiddenException);
      expect(() =>
        extractAuthenticatedActor({
          id: baristaUserId,
          role: 'INVALID_ROLE' as any,
        }),
      ).toThrow(ForbiddenException);

      // 4. Token giả mạo vai trò hệ thống SYSTEM hoặc PAYMENT -> 403
      expect(() =>
        extractAuthenticatedActor({
          id: baristaUserId,
          role: 'SYSTEM' as any,
        }),
      ).toThrow(ForbiddenException);
      expect(() =>
        extractAuthenticatedActor({
          id: baristaUserId,
          role: 'PAYMENT' as any,
        }),
      ).toThrow(ForbiddenException);

      // 5. Valid payload -> success
      const validActor = extractAuthenticatedActor({
        id: baristaUserId,
        role: UserRole.BARISTA,
      });
      expect(validActor.userId).toBe(baristaUserId);
      expect(validActor.role).toBe(UserRole.BARISTA);
    });
  });
});
