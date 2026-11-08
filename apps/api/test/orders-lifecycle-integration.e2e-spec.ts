import { randomUUID } from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { OptionType, OrderStatus, Prisma, ReservationStatus, UserRole } from '@prisma/client';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PromotionsModule } from '../src/promotions/promotions.module';
import { OrdersService } from '../src/orders/orders.service';
import {
  ConflictException,
} from '@nestjs/common';
import {
  InvalidOrderTransitionException,
  OrderActionForbiddenException,
  OrderCancellationNotAllowedException,
  OrderStateConflictException,
  ReservationAlreadyConsumedException,
  ReservationStateConflictException,
} from '../src/orders/orders.exceptions';

describe('Orders Lifecycle & State Machine PostgreSQL Integration (Task 5.1 - Section VII & IX)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let ordersService: OrdersService;

  // Track created fixtures for reliable teardown
  const createdUserIds: string[] = [];
  const createdProductIds: string[] = [];
  const createdIngredientIds: string[] = [];
  const createdOrderIds: string[] = [];

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [PrismaModule, PromotionsModule],
      providers: [OrdersService],
    }).compile();

    prisma = moduleRef.get<PrismaService>(PrismaService);
    ordersService = moduleRef.get<OrdersService>(OrdersService);

    await cleanupAllTestFixtures();
  });

  afterEach(async () => {
    await cleanupAllTestFixtures();
  });

  afterAll(async () => {
    await cleanupAllTestFixtures();
    await moduleRef?.close();
  });

  async function cleanupAllTestFixtures() {
    const testProducts = await prisma.product.findMany({
      where: { name: { startsWith: 'Lifecycle Espresso' } },
      select: { id: true },
    });
    const prodIds = Array.from(
      new Set([...createdProductIds, ...testProducts.map((p) => p.id)]),
    );

    const testUsers = await prisma.user.findMany({
      where: { email: { contains: 'lifecycle-test-' } },
      select: { id: true },
    });
    const userIds = Array.from(
      new Set([...createdUserIds, ...testUsers.map((u) => u.id)]),
    );

    const testOrders = await prisma.order.findMany({
      where: {
        OR: [
          ...(userIds.length > 0 ? [{ userId: { in: userIds } }] : []),
          ...(createdOrderIds.length > 0
            ? [{ id: { in: createdOrderIds } }]
            : []),
        ],
      },
      select: { id: true },
    });
    const orderIds = testOrders.map((o) => o.id);

    if (orderIds.length > 0) {
      await prisma.orderStatusHistory.deleteMany({
        where: { orderId: { in: orderIds } },
      });
      const reservations = await prisma.orderInventoryReservation.findMany({
        where: { orderId: { in: orderIds } },
        select: { id: true },
      });
      const resIds = reservations.map((r) => r.id);
      if (resIds.length > 0) {
        await prisma.orderReservationLine.deleteMany({
          where: { reservationId: { in: resIds } },
        });
        await prisma.orderInventoryReservation.deleteMany({
          where: { id: { in: resIds } },
        });
      }
      const items = await prisma.orderItem.findMany({
        where: { orderId: { in: orderIds } },
        select: { id: true },
      });
      const itemIds = items.map((i) => i.id);
      if (itemIds.length > 0) {
        await prisma.orderItemOption.deleteMany({
          where: { orderItemId: { in: itemIds } },
        });
        await prisma.orderItem.deleteMany({
          where: { id: { in: itemIds } },
        });
      }
      await prisma.order.deleteMany({
        where: { id: { in: orderIds } },
      });
    }

    if (prodIds.length > 0) {
      const options = await prisma.productOption.findMany({
        where: { productId: { in: prodIds } },
        select: { id: true },
      });
      const optIds = options.map((o) => o.id);
      if (optIds.length > 0) {
        await prisma.optionRecipe.deleteMany({
          where: { productOptionId: { in: optIds } },
        });
        await prisma.productOption.deleteMany({
          where: { id: { in: optIds } },
        });
      }
      await prisma.inventory.deleteMany({
        where: { productId: { in: prodIds } },
      });
      await prisma.product.deleteMany({
        where: { id: { in: prodIds } },
      });
    }

    const testIngredients = await prisma.ingredient.findMany({
      where: { name: { startsWith: 'Lifecycle ' } },
      select: { id: true },
    });
    const ingIds = Array.from(
      new Set([...createdIngredientIds, ...testIngredients.map((i) => i.id)]),
    );
    if (ingIds.length > 0) {
      await prisma.optionRecipe.deleteMany({
        where: { ingredientId: { in: ingIds } },
      });
      await prisma.orderReservationLine.deleteMany({
        where: { ingredientId: { in: ingIds } },
      });
      await prisma.ingredient.deleteMany({
        where: { id: { in: ingIds } },
      });
    }

    if (userIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: userIds } },
      });
    }

    createdUserIds.length = 0;
    createdProductIds.length = 0;
    createdIngredientIds.length = 0;
    createdOrderIds.length = 0;
  }

  async function createTestFixtures(coffeeStock = 100, milkStock = 500) {
    const userId = randomUUID();
    const user = await prisma.user.create({
      data: {
        id: userId,
        email: `lifecycle-test-${userId}@brewlite.test`,
        passwordHash: 'argon2-dummy-hash',
        fullName: 'Lifecycle Test User',
      },
    });
    createdUserIds.push(user.id);

    const coffeeId = randomUUID();
    const coffeeIng = await prisma.ingredient.create({
      data: {
        id: coffeeId,
        name: `Lifecycle Coffee Beans ${coffeeId.slice(0, 8)}`,
        unit: 'G',
        stock: new Prisma.Decimal(coffeeStock),
      },
    });
    createdIngredientIds.push(coffeeIng.id);

    const milkId = randomUUID();
    const milkIng = await prisma.ingredient.create({
      data: {
        id: milkId,
        name: `Lifecycle Milk ${milkId.slice(0, 8)}`,
        unit: 'ML',
        stock: new Prisma.Decimal(milkStock),
      },
    });
    createdIngredientIds.push(milkIng.id);

    const productId = randomUUID();
    const product = await prisma.product.create({
      data: {
        id: productId,
        name: `Lifecycle Espresso ${productId.slice(0, 8)}`,
        basePrice: new Prisma.Decimal(45000),
        imageUrl: 'https://example.com/test.jpg',
        isAvailable: true,
      },
    });
    createdProductIds.push(product.id);

    const sizeMOption = await prisma.productOption.create({
      data: {
        productId: product.id,
        type: OptionType.SIZE,
        name: 'Size M',
        extraPrice: new Prisma.Decimal(0),
        recipes: {
          create: [
            {
              ingredientId: coffeeIng.id,
              amount: new Prisma.Decimal(20),
            },
            {
              ingredientId: milkIng.id,
              amount: new Prisma.Decimal(100),
            },
          ],
        },
      },
    });

    return {
      user,
      coffeeIng,
      milkIng,
      product,
      sizeMOption,
    };
  }

  // Kịch bản A: Payment boundary hợp lệ (Section VII.A)
  it('Kịch bản A: Valid internal payment boundary transitions PENDING -> PAID, CONSUMED, no double deduction, 1 history', async () => {
    const { user, coffeeIng, milkIng, product, sizeMOption } =
      await createTestFixtures(100, 500);

    // 1. Tạo đơn PENDING
    const created = await ordersService.createOrder(user.id, {
      items: [
        {
          productId: product.id,
          quantity: 2, // 2 x 20 = 40g coffee, 2 x 100 = 200ml milk
          selectedOptions: [sizeMOption.id],
        },
      ],
    });
    createdOrderIds.push(created.orderId);

    expect(created.status).toBe(OrderStatus.PENDING);

    // 2. Gọi internal payment-success boundary
    const paidOrder = await ordersService.handlePaymentSuccess(
      created.orderId,
      user.id,
    );
    expect(paidOrder.status).toBe(OrderStatus.PAID);
    expect(paidOrder.version).toBe(2);

    // Reservation chuyển thành CONSUMED
    const res = await prisma.orderInventoryReservation.findUniqueOrThrow({
      where: { orderId: created.orderId },
    });
    expect(res.status).toBe(ReservationStatus.CONSUMED);
    expect(res.consumedAt).not.toBeNull();
    expect(res.releasedAt).toBeNull();

    // Stock không bị trừ lần hai (vẫn 60 và 300)
    const coffee = await prisma.ingredient.findUniqueOrThrow({ where: { id: coffeeIng.id } });
    const milk = await prisma.ingredient.findUniqueOrThrow({ where: { id: milkIng.id } });
    expect(coffee.stock.toNumber()).toBe(60);
    expect(milk.stock.toNumber()).toBe(300);

    // History: Đúng 2 bản ghi (null -> PENDING lúc tạo, PENDING -> PAID lúc thanh toán)
    const history = await prisma.orderStatusHistory.findMany({
      where: { orderId: created.orderId },
      orderBy: { createdAt: 'asc' },
    });
    expect(history).toHaveLength(2);
    expect(history[0].toStatus).toBe(OrderStatus.PENDING);
    expect(history[1].toStatus).toBe(OrderStatus.PAID);
  });

  // Kịch bản B: Payment callback lặp (Section VII.B)
  it('Kịch bản B: Repeated payment-success callback is idempotent, no version bump, no new history', async () => {
    const { user, coffeeIng, product, sizeMOption } =
      await createTestFixtures(100, 500);

    const created = await ordersService.createOrder(user.id, {
      items: [
        {
          productId: product.id,
          quantity: 1,
          selectedOptions: [sizeMOption.id],
        },
      ],
    });
    createdOrderIds.push(created.orderId);

    // Lần 1
    const firstCall = await ordersService.handlePaymentSuccess(created.orderId, user.id);
    expect(firstCall.status).toBe(OrderStatus.PAID);
    expect(firstCall.version).toBe(2);

    // Lần 2 (replay)
    const secondCall = await ordersService.handlePaymentSuccess(created.orderId, user.id);
    expect(secondCall.status).toBe(OrderStatus.PAID);
    expect(secondCall.version).toBe(2);

    // Lần 3 (replay)
    const thirdCall = await ordersService.handlePaymentSuccess(created.orderId, user.id);
    expect(thirdCall.status).toBe(OrderStatus.PAID);
    expect(thirdCall.version).toBe(2);

    // Reservation version không tăng
    const res = await prisma.orderInventoryReservation.findUniqueOrThrow({
      where: { orderId: created.orderId },
    });
    expect(res.version).toBe(2);

    // History chỉ có 2 bản ghi
    const history = await prisma.orderStatusHistory.findMany({
      where: { orderId: created.orderId },
    });
    expect(history).toHaveLength(2);

    // Stock không bị thay đổi
    const coffee = await prisma.ingredient.findUniqueOrThrow({ where: { id: coffeeIng.id } });
    expect(coffee.stock.toNumber()).toBe(80);
  });

  // Kịch bản C: Customer giả mạo thanh toán (Section VII.C)
  it('Kịch bản C: CUSTOMER attempting PENDING -> PAID is rejected (403), order stays PENDING, DB unchanged', async () => {
    const { user, coffeeIng, product, sizeMOption } =
      await createTestFixtures(100, 500);

    const created = await ordersService.createOrder(user.id, {
      items: [
        {
          productId: product.id,
          quantity: 1,
          selectedOptions: [sizeMOption.id],
        },
      ],
    });
    createdOrderIds.push(created.orderId);

    // CUSTOMER cố tình gọi transition sang PAID
    await expect(
      ordersService.transitionOrderStatus(created.orderId, OrderStatus.PAID, {
        userId: user.id,
        role: UserRole.CUSTOMER,
      }),
    ).rejects.toThrow(OrderActionForbiddenException);

    // Kiểm tra Order vẫn là PENDING, version 1
    const order = await prisma.order.findUniqueOrThrow({ where: { id: created.orderId } });
    expect(order.status).toBe(OrderStatus.PENDING);
    expect(order.version).toBe(1);

    // Reservation vẫn ACTIVE
    const res = await prisma.orderInventoryReservation.findUniqueOrThrow({
      where: { orderId: created.orderId },
    });
    expect(res.status).toBe(ReservationStatus.ACTIVE);
    expect(res.consumedAt).toBeNull();

    // Không tạo thêm history ngoài bản ghi lúc tạo đơn
    const history = await prisma.orderStatusHistory.findMany({
      where: { orderId: created.orderId },
    });
    expect(history).toHaveLength(1);
    expect(history[0].toStatus).toBe(OrderStatus.PENDING);

    // Stock nguyên vẹn
    const coffee = await prisma.ingredient.findUniqueOrThrow({ where: { id: coffeeIng.id } });
    expect(coffee.stock.toNumber()).toBe(80);
  });

  // Kịch bản D: Customer giả mạo Barista (Section VII.D)
  it('Kịch bản D: CUSTOMER attempting READY -> COMPLETED is rejected (403), order stays READY, no new history', async () => {
    const { user, product, sizeMOption } = await createTestFixtures(100, 500);

    const created = await ordersService.createOrder(user.id, {
      items: [
        {
          productId: product.id,
          quantity: 1,
          selectedOptions: [sizeMOption.id],
        },
      ],
    });
    createdOrderIds.push(created.orderId);

    // Đưa đơn tới trạng thái READY bằng các bước hợp lệ
    await ordersService.handlePaymentSuccess(created.orderId);
    await ordersService.transitionOrderStatus(created.orderId, OrderStatus.PREPARING, {
      role: UserRole.BARISTA,
    });
    await ordersService.transitionOrderStatus(created.orderId, OrderStatus.READY, {
      role: UserRole.BARISTA,
    });

    const readyOrder = await prisma.order.findUniqueOrThrow({ where: { id: created.orderId } });
    expect(readyOrder.status).toBe(OrderStatus.READY);
    const versionBeforeAttempt = readyOrder.version;

    // CUSTOMER cố tình chuyển READY -> COMPLETED
    await expect(
      ordersService.transitionOrderStatus(created.orderId, OrderStatus.COMPLETED, {
        userId: user.id,
        role: UserRole.CUSTOMER,
      }),
    ).rejects.toThrow(OrderActionForbiddenException);

    // Order vẫn READY, version không đổi
    const orderAfterAttempt = await prisma.order.findUniqueOrThrow({ where: { id: created.orderId } });
    expect(orderAfterAttempt.status).toBe(OrderStatus.READY);
    expect(orderAfterAttempt.version).toBe(versionBeforeAttempt);

    // Không có history COMPLETED nào được tạo
    const history = await prisma.orderStatusHistory.findMany({
      where: { orderId: created.orderId },
    });
    expect(history.some((h) => h.toStatus === OrderStatus.COMPLETED)).toBe(false);
  });

  // Kịch bản E: Barista transition hợp lệ (Section VII.E)
  it('Kịch bản E: Valid Barista flow PAID -> PREPARING -> READY -> COMPLETED, 1 history each step, stock unchanged', async () => {
    const { user, coffeeIng, milkIng, product, sizeMOption } =
      await createTestFixtures(100, 500);

    const created = await ordersService.createOrder(user.id, {
      items: [
        {
          productId: product.id,
          quantity: 1,
          selectedOptions: [sizeMOption.id],
        },
      ],
    });
    createdOrderIds.push(created.orderId);

    await ordersService.handlePaymentSuccess(created.orderId);

    // 1. PAID -> PREPARING
    const preparing = await ordersService.transitionOrderStatus(
      created.orderId,
      OrderStatus.PREPARING,
      { role: UserRole.BARISTA },
      'Barista started preparing',
    );
    expect(preparing.status).toBe(OrderStatus.PREPARING);
    expect(preparing.version).toBe(3);

    // 2. PREPARING -> READY
    const ready = await ordersService.transitionOrderStatus(
      created.orderId,
      OrderStatus.READY,
      { role: UserRole.BARISTA },
      'Beverage is ready',
    );
    expect(ready.status).toBe(OrderStatus.READY);
    expect(ready.version).toBe(4);

    // 3. READY -> COMPLETED
    const completed = await ordersService.transitionOrderStatus(
      created.orderId,
      OrderStatus.COMPLETED,
      { role: UserRole.BARISTA },
      'Beverage delivered to customer',
    );
    expect(completed.status).toBe(OrderStatus.COMPLETED);
    expect(completed.version).toBe(5);

    // Reservation giữ nguyên CONSUMED
    const res = await prisma.orderInventoryReservation.findUniqueOrThrow({
      where: { orderId: created.orderId },
    });
    expect(res.status).toBe(ReservationStatus.CONSUMED);

    // Stock không thay đổi trong suốt quá trình pha chế
    const coffee = await prisma.ingredient.findUniqueOrThrow({ where: { id: coffeeIng.id } });
    const milk = await prisma.ingredient.findUniqueOrThrow({ where: { id: milkIng.id } });
    expect(coffee.stock.toNumber()).toBe(80);
    expect(milk.stock.toNumber()).toBe(400);

    // History ghi nhận từng bước một cách tuần tự
    const history = await prisma.orderStatusHistory.findMany({
      where: { orderId: created.orderId },
      orderBy: { createdAt: 'asc' },
    });
    expect(history.map((h) => h.toStatus)).toEqual([
      OrderStatus.PENDING,
      OrderStatus.PAID,
      OrderStatus.PREPARING,
      OrderStatus.READY,
      OrderStatus.COMPLETED,
    ]);
  });

  // Kịch bản F: Hủy đơn, hoàn kho snapshot, chống double restock, concurrency conflict
  it('Kịch bản F: Cancel order restocks snapshot, double cancel prevents restock, concurrent race condition handles conflict', async () => {
    const { user, coffeeIng, product, sizeMOption } =
      await createTestFixtures(100, 500);

    const created = await ordersService.createOrder(user.id, {
      items: [
        {
          productId: product.id,
          quantity: 1, // 20g coffee, 100ml milk
          selectedOptions: [sizeMOption.id],
        },
      ],
    });
    createdOrderIds.push(created.orderId);

    // Hủy đơn lần 1: hoàn kho chính xác
    const cancelled = await ordersService.cancelOrder(created.orderId, {
      userId: user.id,
      role: UserRole.CUSTOMER,
    });
    expect(cancelled.status).toBe(OrderStatus.CANCELLED);

    const coffeeAfterCancel = await prisma.ingredient.findUniqueOrThrow({ where: { id: coffeeIng.id } });
    expect(coffeeAfterCancel.stock.toNumber()).toBe(100);
    expect(coffeeAfterCancel.version).toBe(3);

    // Hủy đơn lần 2: không double restock
    const secondCancel = await ordersService.cancelOrder(created.orderId, {
      userId: user.id,
      role: UserRole.CUSTOMER,
    });
    expect(secondCancel.status).toBe(OrderStatus.CANCELLED);

    const coffeeAfterSecondCancel = await prisma.ingredient.findUniqueOrThrow({ where: { id: coffeeIng.id } });
    expect(coffeeAfterSecondCancel.stock.toNumber()).toBe(100);
    expect(coffeeAfterSecondCancel.version).toBe(3);

    // Tạo đơn mới để test concurrency race condition
    const order2 = await ordersService.createOrder(user.id, {
      items: [{ productId: product.id, quantity: 1, selectedOptions: [sizeMOption.id] }],
    });
    createdOrderIds.push(order2.orderId);

    const [race1, race2] = await Promise.allSettled([
      ordersService.handlePaymentSuccess(order2.orderId),
      ordersService.cancelOrder(order2.orderId, { userId: user.id, role: UserRole.CUSTOMER }),
    ]);

    const successes = [race1, race2].filter((r) => r.status === 'fulfilled');
    const failures = [race1, race2].filter((r) => r.status === 'rejected');
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);

    const reason = (failures[0] as PromiseRejectedResult).reason;
    const isConflict =
      reason instanceof OrderStateConflictException ||
      reason instanceof ReservationStateConflictException ||
      reason instanceof InvalidOrderTransitionException ||
      reason instanceof OrderCancellationNotAllowedException ||
      reason instanceof ReservationAlreadyConsumedException ||
      reason instanceof ConflictException;
    expect(isConflict).toBe(true);
    expect(reason.getStatus()).toBe(409);
  });
});
