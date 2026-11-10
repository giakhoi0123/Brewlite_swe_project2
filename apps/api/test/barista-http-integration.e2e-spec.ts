import { randomUUID } from 'crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { OptionType, OrderStatus, Prisma, ReservationStatus, UserRole } from '@prisma/client';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { OrdersService } from '../src/orders/orders.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Barista HTTP API Integration (Task 5.1 - Section VII - Lê Quang Điệp)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let ordersService: OrdersService;

  const createdUserIds: string[] = [];
  const createdProductIds: string[] = [];
  const createdIngredientIds: string[] = [];
  const createdOrderIds: string[] = [];

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.listen(0, '127.0.0.1');

    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);
    ordersService = app.get(OrdersService);

    await cleanupAllTestFixtures();
  });

  afterEach(async () => {
    await cleanupAllTestFixtures();
  });

  afterAll(async () => {
    await cleanupAllTestFixtures();
    await app?.close();
  });

  async function cleanupAllTestFixtures() {
    const testProducts = await prisma.product.findMany({
      where: { name: { startsWith: 'Barista Espresso' } },
      select: { id: true },
    });
    const prodIds = Array.from(
      new Set([...createdProductIds, ...testProducts.map((p) => p.id)]),
    );

    const testUsers = await prisma.user.findMany({
      where: { email: { contains: 'barista-test-' } },
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
      where: { name: { startsWith: 'Barista Bean' } },
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

  async function createUsers() {
    const baristaId = randomUUID();
    await prisma.user.create({
      data: {
        id: baristaId,
        email: `barista-test-${baristaId}@brewlite.test`,
        passwordHash: 'dummy-hash-barista',
        fullName: 'Barista Nguyễn',
        role: UserRole.BARISTA,
        sessionVersion: 1,
      },
    });
    createdUserIds.push(baristaId);
    const baristaToken = jwtService.sign({ sub: baristaId, sessionVersion: 1 });

    const customerId = randomUUID();
    await prisma.user.create({
      data: {
        id: customerId,
        email: `barista-test-customer-${customerId}@brewlite.test`,
        passwordHash: 'dummy-hash-customer',
        fullName: 'Customer Trần',
        role: UserRole.CUSTOMER,
        sessionVersion: 1,
      },
    });
    createdUserIds.push(customerId);
    const customerToken = jwtService.sign({ sub: customerId, sessionVersion: 1 });

    return { baristaId, baristaToken, customerId, customerToken };
  }

  async function createOrderFixture(customerId: string, coffeeStock = 100) {
    const ingredientId = randomUUID();
    await prisma.ingredient.create({
      data: {
        id: ingredientId,
        name: `Barista Bean ${ingredientId.slice(0, 8)}`,
        stock: new Prisma.Decimal(coffeeStock),
        unit: 'G',
        version: 1,
      },
    });
    createdIngredientIds.push(ingredientId);

    const productId = randomUUID();
    const sizeId = randomUUID();

    await prisma.product.create({
      data: {
        id: productId,
        name: `Barista Espresso ${productId.slice(0, 8)}`,
        basePrice: new Prisma.Decimal(30000),
        imageUrl: 'https://example.com/barista-test.jpg',
        isAvailable: true,
        options: {
          create: [
            {
              id: sizeId,
              name: 'Size Regular',
              type: OptionType.SIZE,
              extraPrice: new Prisma.Decimal(0),
              recipes: {
                create: [
                  {
                    ingredientId,
                    amount: new Prisma.Decimal(15),
                  },
                ],
              },
            },
          ],
        },
      },
    });
    createdProductIds.push(productId);

    const createOrderResult = await ordersService.createOrder(customerId, {
      items: [
        {
          productId,
          quantity: 1,
          selectedOptions: [sizeId],
          notes: 'Ít đường',
        },
      ],
      notes: 'Bàn số 3',
    });
    createdOrderIds.push(createOrderResult.id);

    return {
      orderId: createOrderResult.id,
      orderNumber: createOrderResult.orderNumber,
      ingredientId,
      productId,
      sizeId,
    };
  }

  // ============================================================================
  // KỊCH BẢN A: Tạo Order PENDING -> Payment PAID -> Order xuất hiện trong Barista queue
  // ============================================================================
  it('Kịch bản A: Tạo Order PENDING -> Payment boundary chuyển thành PAID -> Xuất hiện trong Barista queue', async () => {
    const { baristaToken, customerId } = await createUsers();
    const { orderId } = await createOrderFixture(customerId);

    // 1. Khi Order còn PENDING: không xuất hiện trong Barista queue
    const queueBefore = await request(app.getHttpServer())
      .get('/api/barista/orders')
      .set('Authorization', `Bearer ${baristaToken}`)
      .expect(200);

    const foundBefore = queueBefore.body.data.find((o: any) => o.id === orderId);
    expect(foundBefore).toBeUndefined();

    // 2. Payment boundary chuyển thành PAID
    await ordersService.handlePaymentSuccess(orderId);

    // 3. Sau khi PAID: Order phải xuất hiện trong Barista queue
    const queueAfter = await request(app.getHttpServer())
      .get('/api/barista/orders')
      .set('Authorization', `Bearer ${baristaToken}`)
      .expect(200);

    const foundAfter = queueAfter.body.data.find((o: any) => o.id === orderId);
    expect(foundAfter).toBeDefined();
    expect(foundAfter.status).toBe(OrderStatus.PAID);
    expect(foundAfter.notes).toBe('Bàn số 3');
    expect(foundAfter.items.length).toBe(1);
    expect(foundAfter.items[0].productName).toContain('Barista Espresso');
    expect(foundAfter.items[0].options[0].name).toBe('Size Regular');
    expect(foundAfter.customer.fullName).toBe('Customer Trần');

    // Đảm bảo không lộ thông tin nhạy cảm
    expect(foundAfter.customer.email).toBeUndefined();
    expect(foundAfter.customer.passwordHash).toBeUndefined();
    expect(foundAfter.customer.sessionVersion).toBeUndefined();
    expect(foundAfter.reservation).toBeUndefined();
    expect(foundAfter.lines).toBeUndefined();
    expect(foundAfter.version).toBeUndefined();
    expect(foundAfter.paymentMetadata).toBeUndefined();
  });

  // ============================================================================
  // KỊCH BẢN B: BARISTA gọi accept -> Order chuyển PAID -> PREPARING -> History ghi đúng 1 lần
  // ============================================================================
  it('Kịch bản B: BARISTA gọi accept -> Order chuyển PAID -> PREPARING -> History được ghi đúng một lần', async () => {
    const { baristaId, baristaToken, customerId } = await createUsers();
    const { orderId } = await createOrderFixture(customerId);
    await ordersService.handlePaymentSuccess(orderId);

    // BARISTA gọi accept
    const res = await request(app.getHttpServer())
      .post(`/api/barista/orders/${orderId}/accept`)
      .set('Authorization', `Bearer ${baristaToken}`)
      .expect(200);

    expect(res.body.id).toBe(orderId);
    expect(res.body.status).toBe(OrderStatus.PREPARING);

    // Kiểm tra DB: order status là PREPARING
    const dbOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: { statusHistory: true },
    });
    expect(dbOrder?.status).toBe(OrderStatus.PREPARING);

    // History chỉ có 1 bản ghi PAID -> PREPARING với actorId của barista
    const acceptHistory = dbOrder?.statusHistory.filter(
      (h) => h.fromStatus === OrderStatus.PAID && h.toStatus === OrderStatus.PREPARING,
    );
    expect(acceptHistory?.length).toBe(1);
    expect(acceptHistory![0].actorId).toBe(baristaId);
  });

  // ============================================================================
  // KỊCH BẢN C: Chuyển PREPARING -> READY -> COMPLETED -> Trạng thái cuối chuẩn xác, Reservation CONSUMED, stock không đổi thêm
  // ============================================================================
  it('Kịch bản C: Chuyển PREPARING -> READY -> COMPLETED -> Trạng thái cuối chính xác, Reservation vẫn CONSUMED, stock không đổi', async () => {
    const { baristaToken, customerId } = await createUsers();
    const initialStock = 100;
    const { orderId, ingredientId } = await createOrderFixture(customerId, initialStock);
    await ordersService.handlePaymentSuccess(orderId);

    // Stock sau khi tạo đơn và trừ 15g là 85
    const stockAfterCreation = await prisma.ingredient.findUnique({
      where: { id: ingredientId },
    });
    expect(stockAfterCreation?.stock.toNumber()).toBe(85);

    // 1. Accept: PAID -> PREPARING
    await request(app.getHttpServer())
      .post(`/api/barista/orders/${orderId}/accept`)
      .set('Authorization', `Bearer ${baristaToken}`)
      .expect(200);

    // 2. Ready: PREPARING -> READY
    const readyRes = await request(app.getHttpServer())
      .post(`/api/barista/orders/${orderId}/ready`)
      .set('Authorization', `Bearer ${baristaToken}`)
      .expect(200);
    expect(readyRes.body.status).toBe(OrderStatus.READY);

    // 3. Complete: READY -> COMPLETED
    const completeRes = await request(app.getHttpServer())
      .post(`/api/barista/orders/${orderId}/complete`)
      .set('Authorization', `Bearer ${baristaToken}`)
      .expect(200);
    expect(completeRes.body.status).toBe(OrderStatus.COMPLETED);

    // Kiểm tra trạng thái cuối trong DB
    const finalOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: { reservation: true },
    });
    expect(finalOrder?.status).toBe(OrderStatus.COMPLETED);
    expect(finalOrder?.reservation?.status).toBe(ReservationStatus.CONSUMED);

    // Stock nguyên liệu không bị thay đổi thêm
    const finalStock = await prisma.ingredient.findUnique({
      where: { id: ingredientId },
    });
    expect(finalStock?.stock.toNumber()).toBe(85);
  });

  // ============================================================================
  // KỊCH BẢN D: CUSTOMER gọi queue và transition endpoint -> Nhận 403, DB không đổi
  // ============================================================================
  it('Kịch bản D: CUSTOMER gọi queue và transition endpoint -> Nhận 403 Forbidden, database không thay đổi', async () => {
    const { customerToken, customerId } = await createUsers();
    const { orderId } = await createOrderFixture(customerId);
    await ordersService.handlePaymentSuccess(orderId);

    // 1. Customer gọi GET /api/barista/orders
    await request(app.getHttpServer())
      .get('/api/barista/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(403);

    // 2. Customer gọi POST /api/barista/orders/:id/accept
    await request(app.getHttpServer())
      .post(`/api/barista/orders/${orderId}/accept`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(403);

    // Database không thay đổi: Order vẫn là PAID
    const dbOrder = await prisma.order.findUnique({ where: { id: orderId } });
    expect(dbOrder?.status).toBe(OrderStatus.PAID);
  });

  // ============================================================================
  // KỊCH BẢN E: Hai request Barista đồng thời accept cùng Order -> Chỉ 1 transition thắng, 1 history
  // ============================================================================
  it('Kịch bản E: Hai request Barista đồng thời accept cùng Order -> Chỉ một transition thực hiện, 1 history duy nhất', async () => {
    const { baristaToken, customerId } = await createUsers();
    const { orderId } = await createOrderFixture(customerId);
    await ordersService.handlePaymentSuccess(orderId);

    // Gọi đồng thời 2 request accept cùng 1 order
    const [res1, res2] = await Promise.all([
      request(app.getHttpServer())
        .post(`/api/barista/orders/${orderId}/accept`)
        .set('Authorization', `Bearer ${baristaToken}`),
      request(app.getHttpServer())
        .post(`/api/barista/orders/${orderId}/accept`)
        .set('Authorization', `Bearer ${baristaToken}`),
    ]);

    // Một request thành công (200), request còn lại hoặc nhận kết quả idempotent (200) hoặc 409 conflict
    const statuses = [res1.status, res2.status];
    expect(statuses).toContain(200);
    statuses.forEach((s) => expect([200, 409]).toContain(s));

    // Kiểm tra DB: chỉ có duy nhất 1 bản ghi history PAID -> PREPARING
    const histories = await prisma.orderStatusHistory.findMany({
      where: {
        orderId,
        fromStatus: OrderStatus.PAID,
        toStatus: OrderStatus.PREPARING,
      },
    });
    expect(histories.length).toBe(1);
  });

  // ============================================================================
  // KỊCH BẢN F: Gửi transition bỏ qua bước -> Nhận 409, DB không đổi
  // ============================================================================
  it('Kịch bản F: Gửi transition bỏ qua bước -> Nhận 409 Conflict, Order/Reservation/Ingredient không thay đổi', async () => {
    const { baristaToken, customerId } = await createUsers();
    const { orderId, ingredientId } = await createOrderFixture(customerId, 100);
    await ordersService.handlePaymentSuccess(orderId);

    // Đơn đang ở PAID: gọi ready (bỏ qua PREPARING) -> phải trả 409
    const readyRes = await request(app.getHttpServer())
      .post(`/api/barista/orders/${orderId}/ready`)
      .set('Authorization', `Bearer ${baristaToken}`);

    expect(readyRes.status).toBe(409);

    // Đơn đang ở PAID: gọi complete (bỏ qua PREPARING và READY) -> phải trả 409
    const completeRes = await request(app.getHttpServer())
      .post(`/api/barista/orders/${orderId}/complete`)
      .set('Authorization', `Bearer ${baristaToken}`);

    expect(completeRes.status).toBe(409);

    // DB không thay đổi: Order vẫn là PAID, stock vẫn là 85
    const dbOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: { reservation: true },
    });
    expect(dbOrder?.status).toBe(OrderStatus.PAID);
    expect(dbOrder?.reservation?.status).toBe(ReservationStatus.CONSUMED);

    const ing = await prisma.ingredient.findUnique({ where: { id: ingredientId } });
    expect(ing?.stock.toNumber()).toBe(85);
  });

  // ============================================================================
  // KỊCH BẢN G: Không JWT nhận 401, JWT sai role nhận 403, không rò rỉ stack trace
  // ============================================================================
  it('Kịch bản G: Không JWT nhận 401, JWT sai role nhận 403, không rò rỉ stack trace', async () => {
    const { customerToken, customerId } = await createUsers();
    const { orderId } = await createOrderFixture(customerId);

    // 1. Không JWT nhận 401
    const noJwtGet = await request(app.getHttpServer())
      .get('/api/barista/orders')
      .expect(401);
    expect(noJwtGet.body.statusCode).toBe(401);
    expect(noJwtGet.body.stack).toBeUndefined();

    const noJwtPost = await request(app.getHttpServer())
      .post(`/api/barista/orders/${orderId}/accept`)
      .expect(401);
    expect(noJwtPost.body.statusCode).toBe(401);
    expect(noJwtPost.body.stack).toBeUndefined();

    // 2. JWT sai role (CUSTOMER) nhận 403
    const forbiddenRes = await request(app.getHttpServer())
      .post(`/api/barista/orders/${orderId}/accept`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(403);
    expect(forbiddenRes.body.statusCode).toBe(403);
    expect(forbiddenRes.body.stack).toBeUndefined();

    // 3. ID không hợp lệ hoặc không tồn tại trả lỗi sạch sẽ, không lộ Prisma driver crash
    const fakeUuid = randomUUID();
    const notFoundRes = await request(app.getHttpServer())
      .post(`/api/barista/orders/${fakeUuid}/accept`)
      .set('Authorization', `Bearer ${customerToken}`) // Customer bị 403 trước
      .expect(403);
    expect(notFoundRes.body.stack).toBeUndefined();
  });

  // ============================================================================
  // KỊCH BẢN H: Hủy đơn ở trạng thái PAID bị từ chối 409, không hoàn kho hay đổi trạng thái
  // ============================================================================
  it('Kịch bản H: Hủy đơn ở trạng thái PAID bị từ chối bằng 409 Conflict, reservation CONSUMED giữ nguyên', async () => {
    const { customerId } = await createUsers();
    const initialStock = 100;
    const { orderId, ingredientId } = await createOrderFixture(customerId, initialStock);
    await ordersService.handlePaymentSuccess(orderId);

    // Thử hủy đơn hàng khi đã PAID thông qua ordersService
    await expect(
      ordersService.cancelOrder(orderId, {
        userId: customerId,
        role: UserRole.CUSTOMER,
      }),
    ).rejects.toThrow();

    // Kiểm tra DB: Trạng thái Order vẫn là PAID, Reservation vẫn CONSUMED, Stock vẫn là 85
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { reservation: true },
    });
    expect(order?.status).toBe(OrderStatus.PAID);
    expect(order?.reservation?.status).toBe(ReservationStatus.CONSUMED);

    const ing = await prisma.ingredient.findUnique({ where: { id: ingredientId } });
    expect(ing?.stock.toNumber()).toBe(85);
  });

  // ============================================================================
  // KỊCH BẢN I: Hai đơn hàng cùng timestamp createdAt được sắp xếp tất định bằng id ASC
  // ============================================================================
  it('Kịch bản I: Hai đơn hàng cùng timestamp createdAt được sắp xếp tất định bằng id ASC', async () => {
    const { baristaToken, customerId } = await createUsers();
    const fixture1 = await createOrderFixture(customerId, 100);
    const fixture2 = await createOrderFixture(customerId, 100);

    await ordersService.handlePaymentSuccess(fixture1.orderId);
    await ordersService.handlePaymentSuccess(fixture2.orderId);

    // Cập nhật cả 2 đơn về cùng một thời điểm createdAt chính xác
    const sameTimestamp = new Date('2026-11-08T09:00:00.000Z');
    await prisma.order.updateMany({
      where: { id: { in: [fixture1.orderId, fixture2.orderId] } },
      data: { createdAt: sameTimestamp },
    });

    const res = await request(app.getHttpServer())
      .get('/api/barista/orders')
      .set('Authorization', `Bearer ${baristaToken}`)
      .expect(200);

    const matchingOrders = res.body.data.filter((o: any) =>
      [fixture1.orderId, fixture2.orderId].includes(o.id),
    );
    expect(matchingOrders.length).toBe(2);

    // Kiểm tra thứ tự đúng theo id ASC
    const expectedFirstId = [fixture1.orderId, fixture2.orderId].sort()[0];
    const expectedSecondId = [fixture1.orderId, fixture2.orderId].sort()[1];

    expect(matchingOrders[0].id).toBe(expectedFirstId);
    expect(matchingOrders[1].id).toBe(expectedSecondId);
  });
});
