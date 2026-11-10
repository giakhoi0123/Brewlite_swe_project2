import { randomUUID } from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { OptionType, OrderStatus, Prisma, ReservationStatus } from '@prisma/client';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PromotionsModule } from '../src/promotions/promotions.module';
import { OrdersService } from '../src/orders/orders.service';
import {
  ConcurrentStockConflictException,
  InsufficientIngredientStockException,
} from '../src/orders/orders.exceptions';

describe('Orders Creation PostgreSQL Integration (Task 5.1 - Lê Quang Điệp)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let ordersService: OrdersService;

  // Dedicated test fixtures tracking for safe teardown
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
    // Tìm tất cả products test có name bắt đầu bằng 'Integration Espresso'
    const testProducts = await prisma.product.findMany({
      where: { name: { startsWith: 'Integration Espresso' } },
      select: { id: true },
    });
    const prodIds = Array.from(
      new Set([...createdProductIds, ...testProducts.map((p) => p.id)]),
    );

    // Tìm tất cả test users
    const testUsers = await prisma.user.findMany({
      where: { email: { contains: 'test-' } },
      select: { id: true },
    });
    const userIds = Array.from(
      new Set([...createdUserIds, ...testUsers.map((u) => u.id)]),
    );

    // Tìm tất cả orders liên quan
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
        await prisma.orderItem.deleteMany({ where: { id: { in: itemIds } } });
      }
      await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    }

    if (prodIds.length > 0) {
      const options = await prisma.productOption.findMany({
        where: { productId: { in: prodIds } },
        select: { id: true },
      });
      const optIds = options.map((o) => o.id);
      if (optIds.length > 0) {
        await prisma.orderItemOption.deleteMany({
          where: { productOptionId: { in: optIds } },
        });
        await prisma.optionRecipe.deleteMany({
          where: { productOptionId: { in: optIds } },
        });
        await prisma.productOption.deleteMany({
          where: { id: { in: optIds } },
        });
      }
      await prisma.product.deleteMany({ where: { id: { in: prodIds } } });
    }

    const testIngredients = await prisma.ingredient.findMany({
      where: { name: { startsWith: 'Integration ' } },
      select: { id: true },
    });
    const ingIds = Array.from(
      new Set([
        ...createdIngredientIds,
        ...testIngredients.map((i) => i.id),
      ]),
    );
    if (ingIds.length > 0) {
      await prisma.orderReservationLine.deleteMany({
        where: { ingredientId: { in: ingIds } },
      });
      await prisma.ingredient.deleteMany({ where: { id: { in: ingIds } } });
    }

    if (userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }

    createdOrderIds.length = 0;
    createdProductIds.length = 0;
    createdIngredientIds.length = 0;
    createdUserIds.length = 0;
  }

  /**
   * Helper tạo fixture độc lập hoàn toàn cho từng test case
   */
  async function createTestFixture(params: {
    coffeeStock: number;
    milkStock?: number;
  }) {
    const userId = randomUUID();
    await prisma.user.create({
      data: {
        id: userId,
        email: `test-${userId}@brewlite.test`,
        passwordHash: 'dummy-hash',
        fullName: 'Integration Tester',
        role: 'CUSTOMER',
      },
    });
    createdUserIds.push(userId);

    const coffeeId = randomUUID();
    await prisma.ingredient.create({
      data: {
        id: coffeeId,
        name: `Integration Coffee ${coffeeId.slice(0, 8)}`,
        stock: new Prisma.Decimal(params.coffeeStock),
        unit: 'G',
        version: 1,
      },
    });
    createdIngredientIds.push(coffeeId);

    let milkId: string | undefined;
    if (params.milkStock !== undefined) {
      milkId = randomUUID();
      await prisma.ingredient.create({
        data: {
          id: milkId,
          name: `Integration Milk ${milkId.slice(0, 8)}`,
          stock: new Prisma.Decimal(params.milkStock),
          unit: 'ML',
          version: 1,
        },
      });
      createdIngredientIds.push(milkId);
    }

    const productId = randomUUID();
    const sizeMId = randomUUID();
    const toppingShotId = randomUUID();

    await prisma.product.create({
      data: {
        id: productId,
        name: `Integration Espresso ${productId.slice(0, 8)}`,
        basePrice: new Prisma.Decimal(30000),
        imageUrl: 'https://example.com/test.jpg',
        isAvailable: true,
        options: {
          create: [
            {
              id: sizeMId,
              name: 'Size Regular',
              type: OptionType.SIZE,
              extraPrice: new Prisma.Decimal(0),
              recipes: {
                create: [
                  {
                    ingredientId: coffeeId,
                    amount: new Prisma.Decimal(20),
                  },
                  ...(milkId
                    ? [
                        {
                          ingredientId: milkId,
                          amount: new Prisma.Decimal(50),
                        },
                      ]
                    : []),
                ],
              },
            },
            {
              id: toppingShotId,
              name: 'Extra Shot',
              type: OptionType.TOPPING,
              extraPrice: new Prisma.Decimal(10000),
              recipes: {
                create: [
                  {
                    ingredientId: coffeeId,
                    amount: new Prisma.Decimal(10),
                  },
                ],
              },
            },
          ],
        },
      },
    });
    createdProductIds.push(productId);

    return {
      userId,
      coffeeId,
      milkId,
      productId,
      sizeMId,
      toppingShotId,
    };
  }

  // ============================================================================
  // KỊCH BẢN A: TẠO ORDER THÀNH CÔNG
  // ============================================================================
  it('Kịch bản A: Tạo order thành công, trừ tồn kho nguyên liệu và tạo reservation', async () => {
    const fixture = await createTestFixture({
      coffeeStock: 100, // Cần: (20 + 10) * 2 = 60
    });

    const result = await ordersService.createOrder(fixture.userId, {
      items: [
        {
          productId: fixture.productId,
          quantity: 2,
          selectedOptions: [fixture.sizeMId, fixture.toppingShotId],
          notes: 'Ít đường',
        },
      ],
      notes: 'Giao ngay',
    });

    createdOrderIds.push(result.id);

    // 1. Kiểm tra Order response
    expect(result.id).toBeDefined();
    expect(result.orderNumber).toMatch(/^BL-\d{8}-[A-F0-9]{8}$/);
    expect(result.status).toBe(OrderStatus.PENDING);
    expect(result.subtotal).toBe(80000); // (30000 + 0 + 10000) * 2 = 80000
    expect(result.discount).toBe(0);
    expect(result.total).toBe(80000);

    // 2. Kiểm tra Order trong DB
    const savedOrder = await prisma.order.findUnique({
      where: { id: result.id },
      include: {
        items: {
          include: {
            orderItemOptions: true,
          },
        },
        reservation: {
          include: {
            lines: true,
          },
        },
        statusHistory: true,
      },
    });

    expect(savedOrder).not.toBeNull();
    expect(savedOrder!.status).toBe(OrderStatus.PENDING);
    expect(savedOrder!.version).toBe(1);

    // 3. Kiểm tra OrderItem & Snapshot
    expect(savedOrder!.items).toHaveLength(1);
    const item = savedOrder!.items[0];
    expect(item.quantity).toBe(2);
    expect(item.unitPriceSnapshot.toString()).toBe('40000');
    expect(item.subtotal.toString()).toBe('80000');
    expect(Array.isArray(item.optionsSnapshot)).toBe(true);
    expect((item.optionsSnapshot as any[])).toHaveLength(2);

    // 4. Kiểm tra OrderItemOption (normalized rows)
    expect(item.orderItemOptions).toHaveLength(2);

    // 5. Kiểm tra Reservation ACTIVE & ReservationLine
    expect(savedOrder!.reservation).not.toBeNull();
    expect(savedOrder!.reservation!.status).toBe(ReservationStatus.ACTIVE);
    expect(savedOrder!.reservation!.lines).toHaveLength(1);
    expect(savedOrder!.reservation!.lines[0].ingredientId).toBe(fixture.coffeeId);
    expect(savedOrder!.reservation!.lines[0].amount.toNumber()).toBe(60);

    // 6. Kiểm tra StatusHistory
    expect(savedOrder!.statusHistory).toHaveLength(1);
    expect(savedOrder!.statusHistory[0].fromStatus).toBeNull();
    expect(savedOrder!.statusHistory[0].toStatus).toBe(OrderStatus.PENDING);
    expect(savedOrder!.statusHistory[0].actorId).toBe(fixture.userId);

    // 7. Kiểm tra Ingredient.stock giảm đúng và version tăng
    const updatedIngredient = await prisma.ingredient.findUnique({
      where: { id: fixture.coffeeId },
    });
    expect(updatedIngredient!.stock.toNumber()).toBe(40); // 100 - 60 = 40
    expect(updatedIngredient!.version).toBe(2); // 1 + 1 = 2

    // 8. Kiểm tra Product catalog không bị ảnh hưởng
    const persistedProduct = await prisma.product.findUnique({
      where: { id: fixture.productId },
    });
    expect(persistedProduct!.isAvailable).toBe(true);
  });

  // ============================================================================
  // KỊCH BẢN B: THIẾU NGUYÊN LIỆU (ROLLBACK TOÀN DIỆN)
  // ============================================================================
  it('Kịch bản B: Thiếu nguyên liệu trả về 409 Conflict, không tạo đơn mồ côi và giữ nguyên tồn kho', async () => {
    const fixture = await createTestFixture({
      coffeeStock: 30, // Cần 60 nhưng chỉ có 30
    });

    const initialOrderCount = await prisma.order.count();
    const initialReservationCount = await prisma.orderInventoryReservation.count();

    await expect(
      ordersService.createOrder(fixture.userId, {
        items: [
          {
            productId: fixture.productId,
            quantity: 2,
            selectedOptions: [fixture.sizeMId, fixture.toppingShotId],
          },
        ],
      }),
    ).rejects.toThrow(InsufficientIngredientStockException);

    // Xác minh không có Order hoặc Reservation mới
    expect(await prisma.order.count()).toBe(initialOrderCount);
    expect(await prisma.orderInventoryReservation.count()).toBe(initialReservationCount);

    // Xác minh stock và version không đổi
    const ingredient = await prisma.ingredient.findUnique({
      where: { id: fixture.coffeeId },
    });
    expect(ingredient!.stock.toNumber()).toBe(30);
    expect(ingredient!.version).toBe(1);
  });

  // ============================================================================
  // KỊCH BẢN C: ROLLBACK GIỮA TRANSACTION
  // ============================================================================
  it('Kịch bản C: Rollback giữa transaction khi gặp lỗi database sau khi đã trừ kho', async () => {
    const fixture = await createTestFixture({
      coffeeStock: 100,
    });

    // Cố tình spy $transaction để inject lỗi sau khi đã trừ kho
    const originalTx = prisma.$transaction.bind(prisma);
    const txSpy = jest.spyOn(prisma, '$transaction').mockImplementation(async (cb: any, options: any) => {
      return originalTx(async (tx: any) => {
        // Mock lỗi tại tx.order.create sau khi tx.ingredient.updateMany đã thực hiện
        tx.order.create = jest.fn().mockImplementation(async () => {
          throw new Error('Simulated crash during order insertion');
        });
        return cb(tx);
      }, options);
    });

    await expect(
      ordersService.createOrder(fixture.userId, {
        items: [
          {
            productId: fixture.productId,
            quantity: 1,
            selectedOptions: [fixture.sizeMId],
          },
        ],
      }),
    ).rejects.toThrow('Simulated crash during order insertion');

    txSpy.mockRestore();

    // Xác minh stock của ingredient vẫn là 100 và version vẫn là 1
    const ingredient = await prisma.ingredient.findUnique({
      where: { id: fixture.coffeeId },
    });
    expect(ingredient!.stock.toNumber()).toBe(100);
    expect(ingredient!.version).toBe(1);

    // Xác minh không có Order mồ côi nào được lưu
    const orphanOrders = await prisma.order.findMany({
      where: { userId: fixture.userId },
    });
    expect(orphanOrders).toHaveLength(0);
  });

  // ============================================================================
  // KỊCH BẢN D: CONCURRENCY - HAI REQUEST TRANH KHO CUỐI CÙNG
  // ============================================================================
  it('Kịch bản D: Concurrency - Hai request cùng tranh lượng kho cuối cùng bằng Promise.allSettled', async () => {
    // Chỉ có 20g cà phê, mỗi món cần đúng 20g. Chỉ đúng 1 đơn hàng được phép thành công!
    const fixture = await createTestFixture({
      coffeeStock: 20,
    });

    const secondUserId = randomUUID();
    await prisma.user.create({
      data: {
        id: secondUserId,
        email: `concurrent-${secondUserId}@brewlite.test`,
        passwordHash: 'dummy-hash',
        fullName: 'Concurrent User',
        role: 'CUSTOMER',
      },
    });
    createdUserIds.push(secondUserId);

    const orderPayload = {
      items: [
        {
          productId: fixture.productId,
          quantity: 1,
          selectedOptions: [fixture.sizeMId], // cần 20g
        },
      ],
    };

    // Bắn 2 request song song đồng thời
    const [res1, res2] = await Promise.allSettled([
      ordersService.createOrder(fixture.userId, orderPayload),
      ordersService.createOrder(secondUserId, orderPayload),
    ]);

    // Thu thập kết quả
    const fulfilled = [res1, res2].filter((r) => r.status === 'fulfilled');
    const rejected = [res1, res2].filter((r) => r.status === 'rejected');

    // Đúng 1 request thành công và đúng 1 request thất bại
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const successResult = (fulfilled[0] as PromiseFulfilledResult<any>).value;
    createdOrderIds.push(successResult.id);

    // Lỗi thất bại phải là InsufficientIngredientStockException hoặc ConcurrentStockConflictException
    const failedReason = (rejected[0] as PromiseRejectedResult).reason;
    const isExpectedError =
      failedReason instanceof InsufficientIngredientStockException ||
      failedReason instanceof ConcurrentStockConflictException;
    expect(isExpectedError).toBe(true);

    // Tồn kho cuối cùng phải chính xác là 0 (không âm)
    const finalIngredient = await prisma.ingredient.findUnique({
      where: { id: fixture.coffeeId },
    });
    expect(finalIngredient!.stock.toNumber()).toBe(0);
    expect(finalIngredient!.version).toBe(2); // tăng đúng 1 lần từ giao dịch thành công

    // Chỉ đúng 1 Order và 1 Reservation được tạo
    const totalOrdersCreated = await prisma.order.count({
      where: { userId: { in: [fixture.userId, secondUserId] } },
    });
    expect(totalOrdersCreated).toBe(1);
  });

  // ============================================================================
  // KỊCH BẢN E: NHIỀU NGUYÊN LIỆU, MỘT NGUYÊN LIỆU THIẾU
  // ============================================================================
  it('Kịch bản E: Nhiều nguyên liệu (Cà phê đủ 100g, Sữa thiếu 10g), cả hai nguyên liệu được rollback nguyên vẹn', async () => {
    // Món cần 20g coffee và 50g milk
    // Cà phê đủ (100g), sữa thiếu (chỉ có 10g)
    const fixture = await createTestFixture({
      coffeeStock: 100,
      milkStock: 10,
    });

    await expect(
      ordersService.createOrder(fixture.userId, {
        items: [
          {
            productId: fixture.productId,
            quantity: 1,
            selectedOptions: [fixture.sizeMId],
          },
        ],
      }),
    ).rejects.toThrow(InsufficientIngredientStockException);

    // Cả coffee và milk đều phải được rollback nguyên vẹn
    const coffee = await prisma.ingredient.findUnique({ where: { id: fixture.coffeeId } });
    const milk = await prisma.ingredient.findUnique({ where: { id: fixture.milkId! } });

    expect(coffee!.stock.toNumber()).toBe(100);
    expect(coffee!.version).toBe(1);
    expect(milk!.stock.toNumber()).toBe(10);
    expect(milk!.version).toBe(1);
  });
});
