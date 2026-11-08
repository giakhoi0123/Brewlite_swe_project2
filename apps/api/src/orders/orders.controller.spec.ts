import { Test, TestingModule } from '@nestjs/testing';
import { OrderStatus, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { CreateOrderResult } from './orders.types';

describe('OrdersController Unit Tests (Task 5.1 - Lê Quang Điệp)', () => {
  let controller: OrdersController;
  let ordersServiceMock: {
    createOrder: jest.Mock;
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
    total: 40000,
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

  it('phải trích xuất authenticatedUserId từ req.user.userId và chuyển vào OrdersService.createOrder', async () => {
    const mockRequest: any = {
      user: {
        userId: mockAuthenticatedUserId,
        email: 'customer@brewlite.test',
        role: 'CUSTOMER',
      },
    };

    const result = await controller.createOrder(mockRequest, mockDto);

    expect(ordersServiceMock.createOrder).toHaveBeenCalledWith(
      mockAuthenticatedUserId,
      mockDto,
    );
    expect(result).toEqual(mockExpectedResult);
  });

  it('phải hỗ trợ req.user.id nếu req.user.userId không có', async () => {
    const mockRequest: any = {
      user: {
        id: mockAuthenticatedUserId,
        email: 'customer@brewlite.test',
        role: 'CUSTOMER',
      },
    };

    const result = await controller.createOrder(mockRequest, mockDto);

    expect(ordersServiceMock.createOrder).toHaveBeenCalledWith(
      mockAuthenticatedUserId,
      mockDto,
    );
    expect(result.orderId).toBe('order-uuid-1');
  });

  it('tuyệt đối không nhận userId từ request body', async () => {
    const mockRequest: any = {
      user: {
        userId: mockAuthenticatedUserId,
        role: UserRole.CUSTOMER,
      },
    };

    // Giả sử hacker cố tình inject userId lạ vào DTO
    const hackedDto: any = {
      ...mockDto,
      userId: 'hacked-user-id-from-attacker',
      actorId: 'hacked-actor-id',
    };

    await controller.createOrder(mockRequest, hackedDto);

    // OrdersService vẫn bắt buộc nhận mockAuthenticatedUserId từ JWT
    expect(ordersServiceMock.createOrder).toHaveBeenCalledWith(
      mockAuthenticatedUserId,
      hackedDto,
    );
  });
});
