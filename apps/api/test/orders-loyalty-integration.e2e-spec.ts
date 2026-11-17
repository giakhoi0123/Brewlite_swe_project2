import { randomUUID } from 'crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { DiscountType, IngredientUnit, OptionType, OrderStatus, Prisma, ReservationStatus, UserRole } from '@prisma/client';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { OrdersService } from '../src/orders/orders.service';

describe('Orders Loyalty & Transaction PostgreSQL Integration (Task 5.1 - Section III & V)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let ordersService: OrdersService;

  // Trackers for safe fixture teardown
  const createdUserIds: string[] = [];
  const createdProductIds: string[] = [];
  const createdIngredientIds: string[] = [];
  const createdOrderIds: string[] = [];
  const createdPromotionIds: string[] = [];

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
      where: { name: { startsWith: 'Loyalty Test ' } },
      select: { id: true },
    });
    const prodIds = Array.from(new Set([...createdProductIds, ...testProducts.map((p) => p.id)]));

    const testUsers = await prisma.user.findMany({
      where: { email: { contains: 'loyalty-test-' } },
      select: { id: true },
    });
    const userIds = Array.from(new Set([...createdUserIds, ...testUsers.map((u) => u.id)]));

    const testPromotions = await prisma.promotion.findMany({
      where: { code: { startsWith: 'LOYALTY' } },
      select: { id: true },
    });
    const promoIds = Array.from(new Set([...createdPromotionIds, ...testPromotions.map((p) => p.id)]));

    const testOrders = await prisma.order.findMany({
      where: {
        OR: [
          ...(userIds.length > 0 ? [{ userId: { in: userIds } }] : []),
          ...(createdOrderIds.length > 0 ? [{ id: { in: createdOrderIds } }] : []),
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

    if (userIds.length > 0) {
      await prisma.loyaltyTransaction.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }

    if (promoIds.length > 0) {
      await prisma.promotion.deleteMany({ where: { id: { in: promoIds } } });
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
      where: { name: { startsWith: 'Loyalty ' } },
      select: { id: true },
    });
    const ingIds = Array.from(new Set([...createdIngredientIds, ...testIngredients.map((i) => i.id)]));
    if (ingIds.length > 0) {
      await prisma.orderReservationLine.deleteMany({
        where: { ingredientId: { in: ingIds } },
      });
      await prisma.ingredient.deleteMany({ where: { id: { in: ingIds } } });
    }

    createdOrderIds.length = 0;
    createdProductIds.length = 0;
    createdIngredientIds.length = 0;
    createdUserIds.length = 0;
    createdPromotionIds.length = 0;
  }

  // Helper tạo user với số điểm xác định
  async function createTestCustomer(initialPoints: number = 100) {
    const id = randomUUID();
    const user = await prisma.user.create({
      data: {
        id,
        email: `loyalty-test-${id.slice(0, 8)}@brewlite.test`,
        passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz012345678901234567890123456',
        fullName: `Khách hàng Loyalty ${id.slice(0, 4)}`,
        role: UserRole.CUSTOMER,
        loyaltyPoints: initialPoints,
      },
    });
    createdUserIds.push(user.id);
    const token = jwtService.sign({ sub: user.id, email: user.email, role: user.role });
    return { user, token };
  }

  // Helper tạo staff Barista
  async function createTestBarista() {
    const id = randomUUID();
    const user = await prisma.user.create({
      data: {
        id,
        email: `loyalty-test-barista-${id.slice(0, 8)}@brewlite.test`,
        passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz012345678901234567890123456',
        fullName: `Barista ${id.slice(0, 4)}`,
        role: UserRole.BARISTA,
      },
    });
    createdUserIds.push(user.id);
    const token = jwtService.sign({ sub: user.id, email: user.email, role: user.role });
    return { user, token };
  }

  // Helper tạo product, option và ingredient
  async function createTestProductFixture(initialStock: number = 1000) {
    const ingId = randomUUID();
    const ingredient = await prisma.ingredient.create({
      data: {
        id: ingId,
        name: `Loyalty Bean ${ingId.slice(0, 4)}`,
        stock: new Prisma.Decimal(initialStock),
        unit: IngredientUnit.G,
        version: 1,
      },
    });
    createdIngredientIds.push(ingredient.id);

    const prodId = randomUUID();
    const product = await prisma.product.create({
      data: {
        id: prodId,
        name: `Loyalty Test Coffee ${prodId.slice(0, 4)}`,
        basePrice: new Prisma.Decimal(30000),
        imageUrl: 'https://example.com/loyalty.jpg',
        isAvailable: true,
      },
    });
    createdProductIds.push(product.id);

    const optId = randomUUID();
    const option = await prisma.productOption.create({
      data: {
        id: optId,
        productId: product.id,
        name: 'Size Standard',
        type: OptionType.SIZE,
        extraPrice: new Prisma.Decimal(10000), // Tổng đơn giá: 40.000 VNĐ
        recipes: {
          create: {
            ingredientId: ingredient.id,
            amount: new Prisma.Decimal(20), // Mỗi ly tốn 20g
          },
        },
      },
    });

    return { product, option, ingredient };
  }

  // Helper kiểm tra đệ quy keys nhạy cảm
  function containsSensitiveKeys(obj: unknown, forbiddenKeys: string[]): string[] {
    const found: string[] = [];
    if (!obj || typeof obj !== 'object') return found;

    if (Array.isArray(obj)) {
      for (const item of obj) {
        found.push(...containsSensitiveKeys(item, forbiddenKeys));
      }
      return found;
    }

    const record = obj as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      if (forbiddenKeys.includes(key)) {
        found.push(key);
      }
      found.push(...containsSensitiveKeys(record[key], forbiddenKeys));
    }
    return found;
  }

  // ============================================================================
  // IV. KỊCH BẢN A: REDEEM HỢP LỆ
  // ============================================================================
  it('Kịch bản A: Redeem điểm hợp lệ trừ đúng loyaltyPoints, tạo đúng LoyaltyTransaction REDEEM và bảo toàn tài chính', async () => {
    const { user, token } = await createTestCustomer(100); // Có 100 điểm
    const { product, option, ingredient } = await createTestProductFixture(1000);

    // Đơn 1 ly x 40.000 VNĐ, đổi 20 điểm (20.000 VNĐ), không phí giao hàng -> Phải thanh toán 20.000 VNĐ
    const res = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ productId: product.id, quantity: 1, selectedOptions: [option.id] }],
        pointsToRedeem: 20,
      })
      .expect(201);

    const orderId = res.body.id;
    createdOrderIds.push(orderId);

    // 1. Kiểm tra Order trong DB
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe(OrderStatus.PENDING);
    expect(order.pointsRedeemed).toBe(20);
    expect(order.pointsEarned).toBe(0);
    expect(order.subtotal.toNumber()).toBe(40000);
    expect(order.discount.toNumber()).toBe(20000);
    expect(order.shippingFee.toNumber()).toBe(0);
    expect(order.total.toNumber()).toBe(20000);
    expect(order.total.toNumber()).toBe(
      order.subtotal.toNumber() - order.discount.toNumber() + order.shippingFee.toNumber(),
    );

    // 2. Kiểm tra User loyaltyPoints giảm từ 100 -> 80
    const updatedUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updatedUser.loyaltyPoints).toBe(80);

    // 3. Kiểm tra đúng 1 LoyaltyTransaction REDEEM
    const logs = await prisma.loyaltyTransaction.findMany({ where: { userId: user.id } });
    expect(logs.length).toBe(1);
    expect(logs[0].points).toBe(-20);

    // 4. Kiểm tra nguyên liệu và reservation
    const updatedIng = await prisma.ingredient.findUniqueOrThrow({ where: { id: ingredient.id } });
    expect(updatedIng.stock.toNumber()).toBe(980); // 1000 - 20g
    const resv = await prisma.orderInventoryReservation.findUniqueOrThrow({ where: { orderId } });
    expect(resv.status).toBe(ReservationStatus.ACTIVE);
  });

  // ============================================================================
  // V. KỊCH BẢN B: REDEEM VƯỢT SỐ DƯ
  // ============================================================================
  it('Kịch bản B: Redeem vượt số dư bị từ chối 400 Bad Request, không thay đổi DB', async () => {
    const { user, token } = await createTestCustomer(15); // Chỉ có 15 điểm
    const { product, option, ingredient } = await createTestProductFixture(1000);

    const res = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ productId: product.id, quantity: 1, selectedOptions: [option.id] }],
        pointsToRedeem: 50, // Đòi đổi 50 điểm
      })
      .expect(400);

    expect(res.body.message).toContain('Số điểm tích lũy không đủ');

    // Xác minh DB không bị thay đổi
    const userDb = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(userDb.loyaltyPoints).toBe(15);
    const logs = await prisma.loyaltyTransaction.findMany({ where: { userId: user.id } });
    expect(logs.length).toBe(0);
    const ingDb = await prisma.ingredient.findUniqueOrThrow({ where: { id: ingredient.id } });
    expect(ingDb.stock.toNumber()).toBe(1000);
  });

  // ============================================================================
  // VI. KỊCH BẢN C: ROLLBACK SAU KHI ĐÃ TRỪ ĐIỂM
  // ============================================================================
  it('Kịch bản C: Thiếu tồn kho nguyên liệu gây rollback toàn bộ, điểm tích lũy và LoyaltyTransaction được phục hồi nguyên vẹn', async () => {
    const { user, token } = await createTestCustomer(100);
    const { product, option, ingredient } = await createTestProductFixture(10); // Chỉ có 10g, trong khi cần 20g

    const res = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ productId: product.id, quantity: 1, selectedOptions: [option.id] }],
        pointsToRedeem: 30,
      })
      .expect(409); // InsufficientIngredientStockException

    expect(res.body.statusCode).toBe(409);

    // Xác minh rollback điểm trên PostgreSQL thật: điểm phải là 100, không bị mất 30 điểm
    const userDb = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(userDb.loyaltyPoints).toBe(100);

    // Không có LoyaltyTransaction
    const logs = await prisma.loyaltyTransaction.findMany({ where: { userId: user.id } });
    expect(logs.length).toBe(0);

    // Không có Order hoặc Reservation mồ côi
    const orders = await prisma.order.findMany({ where: { userId: user.id } });
    expect(orders.length).toBe(0);

    // Tồn kho giữ nguyên
    const ingDb = await prisma.ingredient.findUniqueOrThrow({ where: { id: ingredient.id } });
    expect(ingDb.stock.toNumber()).toBe(10);
  });

  // ============================================================================
  // VII. KỊCH BẢN D: HAI REQUEST ĐỒNG THỜI REDEEM
  // ============================================================================
  it('Kịch bản D: Hai request HTTP đồng thời mỗi đơn dùng 80 điểm của tài khoản 100 điểm, chỉ tối đa 1 đơn thành công', async () => {
    const { user, token } = await createTestCustomer(100); // 100 điểm
    const { product, option } = await createTestProductFixture(1000);

    const reqPayload = {
      items: [{ productId: product.id, quantity: 2, selectedOptions: [option.id] }],
      pointsToRedeem: 80,
    };

    // Bắn 2 request đồng thời
    const [res1, res2] = await Promise.allSettled([
      request(app.getHttpServer())
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .send(reqPayload),
      request(app.getHttpServer())
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .send(reqPayload),
    ]);

    const results = [res1, res2];
    const successes = results.filter(
      (r) => r.status === 'fulfilled' && (r.value as any).statusCode === 201,
    );
    const failures = results.filter(
      (r) => r.status === 'fulfilled' && (r.value as any).statusCode !== 201,
    );

    // Chỉ có đúng 1 request được thành công
    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);

    const successBody = (successes[0] as PromiseFulfilledResult<any>).value.body;
    createdOrderIds.push(successBody.id);

    // Điểm còn lại phải là 20 (100 - 80), TUYỆT ĐỐI KHÔNG BỊ ÂM
    const userDb = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(userDb.loyaltyPoints).toBe(20);

    // Chỉ có đúng 1 dòng LoyaltyTransaction
    const logs = await prisma.loyaltyTransaction.findMany({ where: { userId: user.id } });
    expect(logs.length).toBe(1);
    expect(logs[0].points).toBe(-80);
  });

  // ============================================================================
  // VIII. KỊCH BẢN E: PROMOTION + LOYALTY TRONG CÙNG TRANSACTION
  // ============================================================================
  it('Kịch bản E: Voucher khuyến mãi và Loyalty cùng áp dụng chính xác và không âm', async () => {
    const { user, token } = await createTestCustomer(100);
    const { product, option } = await createTestProductFixture(1000);

    // Tạo voucher thật 10%
    const promoId = randomUUID();
    const promotion = await prisma.promotion.create({
      data: {
        id: promoId,
        code: 'LOYALTY10',
        description: 'Giảm 10% cho khách hàng thân thiết',
        discountType: DiscountType.PERCENTAGE,
        discountValue: new Prisma.Decimal(10),
        minOrderAmount: new Prisma.Decimal(20000),
        startDate: new Date(Date.now() - 3600 * 1000),
        endDate: new Date(Date.now() + 3600 * 1000),
        isActive: true,
      },
    });
    createdPromotionIds.push(promotion.id);

    // Đơn 1 ly x 40.000 VNĐ:
    // - Voucher 10% = 4.000 VNĐ
    // - Points 15 điểm = 15.000 VNĐ
    // - Không phí giao hàng
    // - Tổng discount = 19.000 VNĐ -> Total = 21.000 VNĐ
    const res = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ productId: product.id, quantity: 1, selectedOptions: [option.id] }],
        voucherCode: 'LOYALTY10',
        pointsToRedeem: 15,
      })
      .expect(201);

    const orderId = res.body.id;
    createdOrderIds.push(orderId);

    const orderDb = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(orderDb.subtotal.toNumber()).toBe(40000);
    expect(orderDb.discount.toNumber()).toBe(19000);
    expect(orderDb.shippingFee.toNumber()).toBe(0);
    expect(orderDb.total.toNumber()).toBe(21000);
    expect(orderDb.pointsRedeemed).toBe(15);
    expect(orderDb.voucherCode).toBe('LOYALTY10');

    // Điểm user giảm từ 100 -> 85
    const userDb = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(userDb.loyaltyPoints).toBe(85);
  });

  // ============================================================================
  // IX. KỊCH BẢN F: COMPLETED EARN ĐÚNG MỘT LẦN & IDEMPOTENCY
  // ============================================================================
  it('Kịch bản F: Chuyển COMPLETED tích điểm đúng 1 lần (10.000 VNĐ = 1 điểm), replay là idempotent', async () => {
    const { user, token } = await createTestCustomer(50);
    const { product, option } = await createTestProductFixture(1000);
    const { token: baristaToken } = await createTestBarista();

    // Tạo đơn 1 ly 40.000 VNĐ (không redeem điểm)
    const createRes = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ productId: product.id, quantity: 1, selectedOptions: [option.id] }],
      })
      .expect(201);

    const orderId = createRes.body.id;
    createdOrderIds.push(orderId);

    // Thanh toán PENDING -> PAID
    await ordersService.handlePaymentSuccess(orderId);

    // Barista accept: PAID -> PREPARING
    await request(app.getHttpServer())
      .post(`/api/barista/orders/${orderId}/accept`)
      .set('Authorization', `Bearer ${baristaToken}`)
      .expect(200);

    // Barista ready: PREPARING -> READY
    await request(app.getHttpServer())
      .post(`/api/barista/orders/${orderId}/ready`)
      .set('Authorization', `Bearer ${baristaToken}`)
      .expect(200);

    // Barista complete: READY -> COMPLETED (LẦN 1)
    await request(app.getHttpServer())
      .post(`/api/barista/orders/${orderId}/complete`)
      .set('Authorization', `Bearer ${baristaToken}`)
      .expect(200);

    // Xác minh điểm được cộng: 40.000 VNĐ = 4 điểm -> 50 + 4 = 54 điểm
    const userDb = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(userDb.loyaltyPoints).toBe(54);

    const orderDb = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(orderDb.pointsEarned).toBe(4);

    // Có đúng 1 log EARN
    const logs = await prisma.loyaltyTransaction.findMany({ where: { userId: user.id } });
    expect(logs.length).toBe(1);
    expect(logs[0].points).toBe(4);

    // REPLAY COMPLETE (LẦN 2) - Idempotent
    await request(app.getHttpServer())
      .post(`/api/barista/orders/${orderId}/complete`)
      .set('Authorization', `Bearer ${baristaToken}`)
      .expect(200);

    // Điểm KHÔNG bị cộng lần 2
    const userDb2 = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(userDb2.loyaltyPoints).toBe(54);

    // Vẫn chỉ có 1 log duy nhất
    const logs2 = await prisma.loyaltyTransaction.findMany({ where: { userId: user.id } });
    expect(logs2.length).toBe(1);
  });

  // ============================================================================
  // X. KỊCH BẢN G: CONCURRENT COMPLETE
  // ============================================================================
  it('Kịch bản G: Hai request complete đồng thời trên Order READY chỉ có 1 request cộng điểm', async () => {
    const { user, token } = await createTestCustomer(10);
    const { product, option } = await createTestProductFixture(1000);
    await createTestBarista();

    const createRes = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ productId: product.id, quantity: 1, selectedOptions: [option.id] }],
      })
      .expect(201);

    const orderId = createRes.body.id;
    createdOrderIds.push(orderId);

    await ordersService.handlePaymentSuccess(orderId);
    await ordersService.transitionOrderStatus(orderId, OrderStatus.PREPARING, { role: UserRole.BARISTA });
    await ordersService.transitionOrderStatus(orderId, OrderStatus.READY, { role: UserRole.BARISTA });

    // Hai thao tác complete đồng thời
    await Promise.allSettled([
      ordersService.transitionOrderStatus(orderId, OrderStatus.COMPLETED, { role: UserRole.BARISTA }),
      ordersService.transitionOrderStatus(orderId, OrderStatus.COMPLETED, { role: UserRole.BARISTA }),
    ]);

    // Điểm chỉ tăng 4 điểm (40.000 VNĐ): 10 + 4 = 14 điểm (KHÔNG THỂ THÀNH 18 ĐIỂM)
    const userDb = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(userDb.loyaltyPoints).toBe(14);

    const logs = await prisma.loyaltyTransaction.findMany({ where: { userId: user.id } });
    expect(logs.length).toBe(1);
    expect(logs[0].points).toBe(4);
  });

  // ============================================================================
  // XI. KỊCH BẢN H: CANCEL REFUND ĐÚNG MỘT LẦN & IDEMPOTENCY
  // ============================================================================
  it('Kịch bản H: Hủy đơn hoàn lại đúng số điểm pointsRedeemed và restock kho, replay không hoàn lần hai', async () => {
    const { user, token } = await createTestCustomer(100);
    const { product, option, ingredient } = await createTestProductFixture(1000);

    // Tạo đơn đổi 30 điểm (100 -> 70), kho 1000 -> 980
    const createRes = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ productId: product.id, quantity: 1, selectedOptions: [option.id] }],
        pointsToRedeem: 30,
      })
      .expect(201);

    const orderId = createRes.body.id;
    createdOrderIds.push(orderId);

    // Hủy đơn (LẦN 1)
    await ordersService.cancelOrder(orderId, { userId: user.id, role: UserRole.CUSTOMER });

    // 1. Điểm được hoàn trả về 100
    const userDb = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(userDb.loyaltyPoints).toBe(100);

    // 2. Có đúng 2 log: 1 REDEEM (-30) và 1 REFUND (+30)
    const logs = await prisma.loyaltyTransaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(logs.length).toBe(2);
    expect(logs[0].points).toBe(-30);
    expect(logs[1].points).toBe(30);

    // 3. Tồn kho được hoàn trả 980 -> 1000
    const ingDb = await prisma.ingredient.findUniqueOrThrow({ where: { id: ingredient.id } });
    expect(ingDb.stock.toNumber()).toBe(1000);

    // REPLAY CANCEL (LẦN 2) - Idempotent
    await ordersService.cancelOrder(orderId, { userId: user.id, role: UserRole.CUSTOMER });

    // Điểm vẫn là 100, không bị hoàn thừa
    const userDb2 = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(userDb2.loyaltyPoints).toBe(100);

    // Vẫn chỉ có 2 log
    const logs2 = await prisma.loyaltyTransaction.findMany({ where: { userId: user.id } });
    expect(logs2.length).toBe(2);

    // Tồn kho không bị cộng thêm lần 2
    const ingDb2 = await prisma.ingredient.findUniqueOrThrow({ where: { id: ingredient.id } });
    expect(ingDb2.stock.toNumber()).toBe(1000);
  });

  // ============================================================================
  // XII. KỊCH BẢN I: CONCURRENT CANCEL
  // ============================================================================
  it('Kịch bản I: Hai thao tác cancel đồng thời chỉ hoàn điểm và restock đúng một lần duy nhất', async () => {
    const { user, token } = await createTestCustomer(100);
    const { product, option, ingredient } = await createTestProductFixture(1000);

    const createRes = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ productId: product.id, quantity: 1, selectedOptions: [option.id] }],
        pointsToRedeem: 25,
      })
      .expect(201);

    const orderId = createRes.body.id;
    createdOrderIds.push(orderId);

    // Hai thao tác cancel đồng thời
    await Promise.allSettled([
      ordersService.cancelOrder(orderId, { userId: user.id, role: UserRole.CUSTOMER }),
      ordersService.cancelOrder(orderId, { userId: user.id, role: UserRole.CUSTOMER }),
    ]);

    // Điểm hoàn đúng về 100 (không thể là 125)
    const userDb = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(userDb.loyaltyPoints).toBe(100);

    // Đúng 1 log refund
    const refundLogs = await prisma.loyaltyTransaction.findMany({
      where: { userId: user.id, points: 25 },
    });
    expect(refundLogs.length).toBe(1);

    // Tồn kho hoàn về 1000 (không thể là 1020)
    const ingDb = await prisma.ingredient.findUniqueOrThrow({ where: { id: ingredient.id } });
    expect(ingDb.stock.toNumber()).toBe(1000);
  });

  // ============================================================================
  // XIII. KỊCH BẢN J: CUSTOMER RESPONSE PRIVACY QUA HTTP & CHỐNG IDOR
  // ============================================================================
  it('Kịch bản J: HTTP GET /api/orders/me và GET /api/orders/:id không lộ dữ liệu kho nội bộ, khách A đọc đơn khách B nhận 404', async () => {
    const { token: tokenA } = await createTestCustomer(50);
    const { token: tokenB } = await createTestCustomer(50);
    const { product, option } = await createTestProductFixture(1000);

    const createRes = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        items: [{ productId: product.id, quantity: 1, selectedOptions: [option.id] }],
        pointsToRedeem: 10,
      })
      .expect(201);

    const orderId = createRes.body.id;
    createdOrderIds.push(orderId);

    const forbiddenSensitiveKeys = [
      'reservation',
      'reservationLines',
      'lines',
      'ingredientId',
      'stock',
      'passwordHash',
      'sessionVersion',
      'loyaltyTransaction',
    ];

    // 1. GET /api/orders/:id của chính chủ
    const detailRes = await request(app.getHttpServer())
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(detailRes.body.id).toBe(orderId);
    expect(detailRes.body.shippingFee).toBe(0);
    expect(detailRes.body.total).toBe(30000);
    expect(detailRes.body.pointsRedeemed).toBe(10);
    const leakedDetailKeys = containsSensitiveKeys(detailRes.body, forbiddenSensitiveKeys);
    expect(leakedDetailKeys).toEqual([]);

    // 2. GET /api/orders/me của chính chủ
    const historyRes = await request(app.getHttpServer())
      .get('/api/orders/me')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(Array.isArray(historyRes.body)).toBe(true);
    expect(historyRes.body.length).toBe(1);
    expect(historyRes.body[0].id).toBe(orderId);
    const leakedHistoryKeys = containsSensitiveKeys(historyRes.body, forbiddenSensitiveKeys);
    expect(leakedHistoryKeys).toEqual([]);

    // 3. Khách B cố tình đọc đơn của Khách A -> Nhận 404 Not Found chống IDOR
    const idorRes = await request(app.getHttpServer())
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);

    expect(idorRes.body.message).toContain('không tồn tại');
    // Tuyệt đối không rò rỉ metadata hay stack trace
    expect(idorRes.body.stack).toBeUndefined();
  });

  // ============================================================================
  // XIV. PROCESSING LEGACY TEST
  // ============================================================================
  it('Kịch bản Legacy: Order mới luôn là PENDING, không xuất hiện PROCESSING trong Barista Queue, CUSTOMER bị cấm transition sang COMPLETED', async () => {
    const { user, token } = await createTestCustomer(50);
    const { product, option } = await createTestProductFixture(1000);
    const { token: baristaToken } = await createTestBarista();

    const createRes = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ productId: product.id, quantity: 1, selectedOptions: [option.id] }],
      })
      .expect(201);

    const orderId = createRes.body.id;
    createdOrderIds.push(orderId);

    // Order mới luôn luôn là PENDING
    expect(createRes.body.status).toBe(OrderStatus.PENDING);

    // Barista Queue chỉ lọc PAID, PREPARING, READY (truyền PROCESSING vào query status bị 400 Bad Request)
    await request(app.getHttpServer())
      .get('/api/barista/orders?status=PROCESSING')
      .set('Authorization', `Bearer ${baristaToken}`)
      .expect(400);

    // CUSTOMER tự chuyển sang COMPLETED bị 403 Forbidden
    await expect(
      ordersService.transitionOrderStatus(orderId, OrderStatus.COMPLETED, {
        userId: user.id,
        role: UserRole.CUSTOMER,
      }),
    ).rejects.toThrow();
  });
});
