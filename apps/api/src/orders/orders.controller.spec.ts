import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OrderStatus, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { CreateOrderResult } from './orders.types';

describe('OrdersController Security & Unit Tests (Task 5.1 - Lê Quang Điệp)', () => {
  let controller: OrdersController;
  let ordersServiceMock: {
    createOrder: jest.Mock;
    getUserOrderHistory: jest.Mock;
    getCustomerOrderById: jest.Mock;
  };

  const mockAuthenticatedUserId = '11111111-1111-1111-1111-111111111111';
  const mockDto: CreateOrderDto = {
    items: [
      {
        productId: 'a0000000-0000-0000-0000-000000000001',
        quantity: 2,
        selectedOptions: ['b0000000-0000-0000-0000-000000000001'],
        notes: 'Ít đường',
      },
    ],
    voucherCode: 'WELCOME10',
    notes: 'Giao nhanh',
  };

  const mockExpectedResult: CreateOrderResult = {
    id: 'order-uuid-1',
    orderId: 'order-uuid-1',
    orderNumber: 'BL-20261108-ABCD1234',
    status: OrderStatus.PENDING,
    subtotal: 50000,
    discount: 10000,
    shippingFee: 15000,
    total: 55000,
    createdAt: '2026-11-08T08:00:00.000Z',
    items: [
      {
        productId: 'a0000000-0000-0000-0000-000000000001',
        productName: 'Cà phê đen đá',
        unitPrice: 25000,
        quantity: 2,
        subtotal: 50000,
        notes: 'Ít đường',
        options: [
          {
            id: 'b0000000-0000-0000-0000-000000000001',
            name: 'Size M',
            type: 'SIZE',
            extraPrice: 0,
          },
        ],
      },
    ],
  };

  beforeEach(async () => {
    ordersServiceMock = {
      createOrder: jest.fn().mockResolvedValue(mockExpectedResult),
      getUserOrderHistory: jest.fn().mockResolvedValue([mockExpectedResult]),
      getCustomerOrderById: jest.fn().mockResolvedValue(mockExpectedResult),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        {
          provide: OrdersService,
          useValue: ordersServiceMock,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<OrdersController>(OrdersController);
  });

  it('nên được khởi tạo thành công', () => {
    expect(controller).toBeDefined();
  });

  describe('POST /orders - Tạo đơn hàng', () => {
    it('1. POST /orders: lấy đúng userId từ JWT (req.user.userId) và chuyển vào OrdersService.createOrder', async () => {
      const mockRequest: any = {
        user: {
          userId: mockAuthenticatedUserId,
          email: 'customer@brewlite.test',
          role: UserRole.CUSTOMER,
        },
      };

      const result = await controller.createOrder(mockRequest, mockDto);

      expect(ordersServiceMock.createOrder).toHaveBeenCalledWith(
        mockAuthenticatedUserId,
        mockDto,
      );
      expect(result).toEqual(mockExpectedResult);
    });

    it('2. POST /orders: hỗ trợ req.user.id nếu req.user.userId không có', async () => {
      const mockRequest: any = {
        user: {
          id: mockAuthenticatedUserId,
          email: 'customer@brewlite.test',
          role: UserRole.CUSTOMER,
        },
      };

      const result = await controller.createOrder(mockRequest, mockDto);

      expect(ordersServiceMock.createOrder).toHaveBeenCalledWith(
        mockAuthenticatedUserId,
        mockDto,
      );
      expect(result.orderId).toBe('order-uuid-1');
    });

    it('3. POST /orders: userId/actorId giả trong body bị phớt lờ, chỉ dùng JWT', async () => {
      const mockRequest: any = {
        user: {
          userId: mockAuthenticatedUserId,
          role: UserRole.CUSTOMER,
        },
      };

      const hackedDto: any = {
        ...mockDto,
        userId: 'hacked-user-id-from-attacker',
        actorId: 'hacked-actor-id',
      };

      await controller.createOrder(mockRequest, hackedDto);

      expect(ordersServiceMock.createOrder).toHaveBeenCalledWith(
        mockAuthenticatedUserId,
        hackedDto,
      );
    });

    it('4. POST /orders: truyền đúng pointsToRedeem trong CreateOrderDto sang OrdersService', async () => {
      const mockRequest: any = {
        user: {
          userId: mockAuthenticatedUserId,
          role: UserRole.CUSTOMER,
        },
      };

      const dtoWithPoints: CreateOrderDto = {
        ...mockDto,
        pointsToRedeem: 50,
      };

      await controller.createOrder(mockRequest, dtoWithPoints);

      expect(ordersServiceMock.createOrder).toHaveBeenCalledWith(
        mockAuthenticatedUserId,
        expect.objectContaining({ pointsToRedeem: 50 }),
      );
    });
  });

  describe('GET /orders/me - Lịch sử đơn hàng (Chống IDOR)', () => {
    it('5. GET /orders/me: lấy userId 100% từ JWT, không nhận query userId', async () => {
      const mockRequest: any = {
        user: {
          userId: mockAuthenticatedUserId,
          role: UserRole.CUSTOMER,
        },
        query: {
          userId: 'victim-user-id-attempt',
        },
      };

      const result = await controller.getUserOrderHistory(mockRequest);

      expect(ordersServiceMock.getUserOrderHistory).toHaveBeenCalledWith(
        mockAuthenticatedUserId,
      );
      expect(result).toEqual([mockExpectedResult]);
    });

    it('6. GET /orders/me: Khách A không thể dùng query userId của Khách B', async () => {
      const attackerRequest: any = {
        user: {
          userId: 'attacker-user-a',
          role: UserRole.CUSTOMER,
        },
        query: {
          userId: 'victim-user-b',
        },
      };

      await controller.getUserOrderHistory(attackerRequest);

      expect(ordersServiceMock.getUserOrderHistory).toHaveBeenCalledWith(
        'attacker-user-a',
      );
      expect(ordersServiceMock.getUserOrderHistory).not.toHaveBeenCalledWith(
        'victim-user-b',
      );
    });
  });

  describe('GET /orders/:id - Chi tiết đơn hàng (Chống IDOR & Ownership Check)', () => {
    it('7. GET /orders/:id: truyền cả orderId và actor.userId từ JWT vào service để kiểm tra quyền sở hữu', async () => {
      const mockRequest: any = {
        user: {
          userId: mockAuthenticatedUserId,
          role: UserRole.CUSTOMER,
        },
      };

      const result = await controller.getOrderById('order-uuid-1', mockRequest);

      expect(ordersServiceMock.getCustomerOrderById).toHaveBeenCalledWith(
        'order-uuid-1',
        mockAuthenticatedUserId,
      );
      expect(result).toEqual(mockExpectedResult);
    });

    it('8. GET /orders/:id: Khách A không thể giả mạo query userId của Khách B', async () => {
      const attackerRequest: any = {
        user: {
          userId: 'attacker-user-a',
          role: UserRole.CUSTOMER,
        },
        query: {
          userId: 'victim-user-b',
        },
      };

      await controller.getOrderById('order-uuid-1', attackerRequest);

      expect(ordersServiceMock.getCustomerOrderById).toHaveBeenCalledWith(
        'order-uuid-1',
        'attacker-user-a',
      );
      expect(ordersServiceMock.getCustomerOrderById).not.toHaveBeenCalledWith(
        'order-uuid-1',
        'victim-user-b',
      );
    });
  });

  describe('Authentication & Route Isolation', () => {
    it('9. Thiếu JWT hoặc user không hợp lệ ném UnauthorizedException trên mọi endpoint', async () => {
      const emptyRequest: any = { user: null };
      await expect(controller.createOrder(emptyRequest, mockDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(controller.getUserOrderHistory(emptyRequest)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(
        controller.getOrderById('order-uuid-1', emptyRequest),
      ).rejects.toThrow(UnauthorizedException);

      const noIdRequest: any = { user: { role: UserRole.CUSTOMER } };
      await expect(controller.createOrder(noIdRequest, mockDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(controller.getUserOrderHistory(noIdRequest)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(
        controller.getOrderById('order-uuid-1', noIdRequest),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('10. Không phục hồi PATCH /orders/:id/status (chặn client tự xác nhận PAID hoặc bypass state machine)', () => {
      expect((controller as any).updateOrderStatus).toBeUndefined();
    });

    it('11. Không làm ảnh hưởng hay tạo endpoint trùng với BaristaController', () => {
      expect((controller as any).getQueue).toBeUndefined();
      expect((controller as any).acceptOrder).toBeUndefined();
      expect((controller as any).readyOrder).toBeUndefined();
      expect((controller as any).completeOrder).toBeUndefined();
    });
  });
});
