import { randomUUID } from 'crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { OptionType, OrderStatus, Prisma } from '@prisma/client';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Orders HTTP API Integration (POST /api/orders) (Task 5.1 - Lê Quang Điệp)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  // Dedicated test fixtures tracking for safe teardown
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
      where: { name: { startsWith: 'HTTP Espresso' } },
      select: { id: true },
    });
    const prodIds = Array.from(
      new Set([...createdProductIds, ...testProducts.map((p) => p.id)]),
    );

    const testUsers = await prisma.user.findMany({
      where: { email: { contains: 'http-test-' } },
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
      await prisma.inventory.deleteMany({
        where: { productId: { in: prodIds } },
      });
      await prisma.product.deleteMany({ where: { id: { in: prodIds } } });
    }

    const testIngredients = await prisma.ingredient.findMany({
      where: { name: { startsWith: 'HTTP Coffee' } },
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

  async function createFixture(coffeeStock = 100) {
    const userId = randomUUID();
    await prisma.user.create({
      data: {
        id: userId,
        email: `http-test-${userId}@brewlite.test`,
        passwordHash: 'dummy-hash',
        fullName: 'HTTP E2E Tester',
        role: 'CUSTOMER',
        sessionVersion: 1,
      },
    });
    createdUserIds.push(userId);

    const token = jwtService.sign({ sub: userId, sessionVersion: 1 });

    const coffeeId = randomUUID();
    await prisma.ingredient.create({
      data: {
        id: coffeeId,
        name: `HTTP Coffee ${coffeeId.slice(0, 8)}`,
        stock: new Prisma.Decimal(coffeeStock),
        unit: 'G',
        version: 1,
      },
    });
    createdIngredientIds.push(coffeeId);

    const productId = randomUUID();
    const sizeMId = randomUUID();
    const toppingShotId = randomUUID();

    await prisma.product.create({
      data: {
        id: productId,
        name: `HTTP Espresso ${productId.slice(0, 8)}`,
        basePrice: new Prisma.Decimal(30000),
        imageUrl: 'https://example.com/http-test.jpg',
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
      token,
      coffeeId,
      productId,
      sizeMId,
      toppingShotId,
    };
  }

  // ============================================================================
  // 1. CHƯA ĐĂNG NHẬP / THIẾU JWT
  // ============================================================================
  it('1. POST /api/orders trả về 401 Unauthorized khi không có Authorization header', async () => {
    const fixture = await createFixture();

    const response = await request(app.getHttpServer())
      .post('/api/orders')
      .send({
        items: [
          {
            productId: fixture.productId,
            quantity: 1,
            selectedOptions: [fixture.sizeMId],
          },
        ],
      });

    expect(response.status).toBe(401);
  });

  // ============================================================================
  // 2. THÀNH CÔNG VỚI JWT HỢP LỆ VÀ ĐÚNG CONTRACT
  // ============================================================================
  it('2. POST /api/orders thành công (201 Created) với JWT hợp lệ và trả về response đúng contract', async () => {
    const fixture = await createFixture(100);

    const response = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${fixture.token}`)
      .send({
        items: [
          {
            productId: fixture.productId,
            quantity: 2,
            selectedOptions: [fixture.sizeMId, fixture.toppingShotId],
            notes: 'Ít đá',
          },
        ],
        notes: 'Giao nhanh giúp tôi',
      });

    expect(response.status).toBe(201);
    createdOrderIds.push(response.body.id || response.body.orderId);

    // Chuẩn hóa response theo contract
    expect(response.body).toHaveProperty('id');
    expect(response.body).toHaveProperty('orderId');
    expect(response.body).toHaveProperty('orderNumber');
    expect(response.body.orderNumber).toMatch(/^BL-\d{8}-[A-F0-9]{8}$/);
    expect(response.body.status).toBe(OrderStatus.PENDING);
    expect(response.body.subtotal).toBe(80000); // (30000 + 0 + 10000) * 2 = 80000
    expect(response.body.discount).toBe(0);
    expect(response.body.total).toBe(80000);
    expect(response.body.createdAt).toBeDefined();

    // Items và option snapshots cho confirmation screen
    expect(Array.isArray(response.body.items)).toBe(true);
    expect(response.body.items).toHaveLength(1);
    const item = response.body.items[0];
    expect(item.productId).toBe(fixture.productId);
    expect(item.unitPrice).toBe(40000);
    expect(item.quantity).toBe(2);
    expect(item.subtotal).toBe(80000);
    expect(item.notes).toBe('Ít đá');
    expect(Array.isArray(item.options)).toBe(true);
    expect(item.options).toHaveLength(2);
  });

  // ============================================================================
  // 3. KHÔNG CHO CLIENT GIẢ MẠO USERID / ACTORID
  // ============================================================================
  it('3. POST /api/orders không cho client giả mạo userId hoặc actorId trong request body', async () => {
    const fixture = await createFixture(100);
    const fakeHackerUserId = randomUUID();

    const response = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${fixture.token}`)
      .send({
        userId: fakeHackerUserId,
        actorId: fakeHackerUserId,
        items: [
          {
            productId: fixture.productId,
            quantity: 1,
            selectedOptions: [fixture.sizeMId],
          },
        ],
      });

    expect(response.status).toBe(201);
    const orderId = response.body.id || response.body.orderId;
    createdOrderIds.push(orderId);

    // Kiểm tra trong DB: order.userId BẮT BUỘC phải là fixture.userId từ JWT
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { statusHistory: true },
    });

    expect(order!.userId).toBe(fixture.userId);
    expect(order!.userId).not.toBe(fakeHackerUserId);
    expect(order!.statusHistory[0].actorId).toBe(fixture.userId);
  });

  // ============================================================================
  // 4. FIELD NGOÀI WHITELIST BỊ LOẠI BỎ
  // ============================================================================
  it('4. POST /api/orders loại bỏ tự động các trường ngoài whitelist (ValidationPipe)', async () => {
    const fixture = await createFixture(100);

    const response = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${fixture.token}`)
      .send({
        attackerField: 'malicious payload',
        role: 'ADMIN',
        items: [
          {
            productId: fixture.productId,
            quantity: 1,
            selectedOptions: [fixture.sizeMId],
            hackedItemProp: 'injected',
          },
        ],
      });

    expect(response.status).toBe(201);
    createdOrderIds.push(response.body.id || response.body.orderId);
  });

  // ============================================================================
  // 5. REQUEST THIẾU SIZE BỊ TỪ CHỐI (400 BAD REQUEST)
  // ============================================================================
  it('5. POST /api/orders từ chối với mã 400 Bad Request khi OrderItem thiếu tùy chọn SIZE', async () => {
    const fixture = await createFixture(100);

    const response = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${fixture.token}`)
      .send({
        items: [
          {
            productId: fixture.productId,
            quantity: 1,
            selectedOptions: [fixture.toppingShotId], // chỉ chọn TOPPING, thiếu SIZE!
          },
        ],
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('bắt buộc phải chọn chính xác một kích cỡ');
  });

  // ============================================================================
  // 6. THIẾU NGUYÊN LIỆU TRẢ VỀ 409 VÀ ROLLBACK
  // ============================================================================
  it('6. POST /api/orders trả về 409 Conflict khi kho không đủ nguyên liệu và rollback toàn bộ', async () => {
    const fixture = await createFixture(10); // Chỉ có 10g cà phê, mỗi món cần 20g

    const initialOrderCount = await prisma.order.count();

    const response = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${fixture.token}`)
      .send({
        items: [
          {
            productId: fixture.productId,
            quantity: 1,
            selectedOptions: [fixture.sizeMId], // Cần 20g
          },
        ],
      });

    expect(response.status).toBe(409);
    expect(response.body.message).toContain('không đủ tồn kho');

    // Rollback: không có đơn mới, tồn kho giữ nguyên 10g
    expect(await prisma.order.count()).toBe(initialOrderCount);
    const ingredient = await prisma.ingredient.findUnique({
      where: { id: fixture.coffeeId },
    });
    expect(ingredient!.stock.toNumber()).toBe(10);
    expect(ingredient!.version).toBe(1);
  });

  // ============================================================================
  // 7. GIÁ CLIENT GỬI GIẢ KHÔNG ẢNH HƯỞNG GIÁ SERVER
  // ============================================================================
  it('7. POST /api/orders tính giá hoàn toàn từ DB, giá client gửi giả bị bỏ qua', async () => {
    const fixture = await createFixture(100);

    const response = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${fixture.token}`)
      .send({
        // Client cố tình sửa giá thấp để hack
        subtotal: 1000,
        discount: 999999,
        total: 1,
        items: [
          {
            productId: fixture.productId,
            quantity: 1,
            selectedOptions: [fixture.sizeMId],
            unitPrice: 100,
            subtotal: 100,
          },
        ],
      });

    expect(response.status).toBe(201);
    createdOrderIds.push(response.body.id || response.body.orderId);

    // Server tính từ basePrice 30000 + size 0 = 30000
    expect(response.body.subtotal).toBe(30000);
    expect(response.body.discount).toBe(0);
    expect(response.body.total).toBe(30000);
  });

  // ============================================================================
  // 8. HAI REQUEST ĐỒNG THỜI KHÔNG LÀM ÂM KHO
  // ============================================================================
  it('8. POST /api/orders concurrency - Hai request HTTP đồng thời không làm âm tồn kho', async () => {
    const fixture = await createFixture(20); // Chỉ đủ cho 1 món 20g

    const user2Id = randomUUID();
    await prisma.user.create({
      data: {
        id: user2Id,
        email: `http-test-${user2Id}@brewlite.test`,
        passwordHash: 'dummy-hash',
        fullName: 'Concurrent Customer',
        role: 'CUSTOMER',
        sessionVersion: 1,
      },
    });
    createdUserIds.push(user2Id);

    const token2 = jwtService.sign({ sub: user2Id, sessionVersion: 1 });

    const orderPayload = {
      items: [
        {
          productId: fixture.productId,
          quantity: 1,
          selectedOptions: [fixture.sizeMId], // 20g
        },
      ],
    };

    // Bắn 2 request HTTP song song qua supertest
    const [res1, res2] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/orders')
        .set('Authorization', `Bearer ${fixture.token}`)
        .send(orderPayload),
      request(app.getHttpServer())
        .post('/api/orders')
        .set('Authorization', `Bearer ${token2}`)
        .send(orderPayload),
    ]);

    const statuses = [res1.status, res2.status].sort();
    // Một request thành công 201, một request thất bại 409
    expect(statuses).toEqual([201, 409]);

    const successRes = res1.status === 201 ? res1 : res2;
    createdOrderIds.push(successRes.body.id || successRes.body.orderId);

    // Tồn kho cuối cùng là 0g, không âm
    const finalIngredient = await prisma.ingredient.findUnique({
      where: { id: fixture.coffeeId },
    });
    expect(finalIngredient!.stock.toNumber()).toBe(0);
    expect(finalIngredient!.version).toBe(2);
  });
});
