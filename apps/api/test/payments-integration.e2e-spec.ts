import { randomUUID } from "crypto";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { IngredientUnit, OrderStatus, ReservationStatus } from "@prisma/client";
import * as request from "supertest";
import { AppModule } from "../src/app.module";
import { MockPaymentGatewayAdapter } from "../src/payments/adapters/mock-payment-gateway.adapter";
import { PaymentGatewayRequest } from "../src/payments/domain/payment.types";
import { PAYMENT_GATEWAY } from "../src/payments/ports/payment-gateway.port";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Payments PostgreSQL integration", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let userId: string;
  let ingredientId: string;

  const RESERVED_AMOUNT = 10;
  const STOCK_WHILE_RESERVED = 90;
  const STOCK_AFTER_RELEASE = 100;

  const adapter = new MockPaymentGatewayAdapter(
    () => new Date("2026-11-09T12:00:00.000Z"),
  );
  const gatewayProcess = jest.fn((input: PaymentGatewayRequest) =>
    adapter.process(input),
  );
  const gatewayVerifyCallback = jest.fn((params: Record<string, string>) =>
    adapter.verifyCallback(params),
  );

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PAYMENT_GATEWAY)
      .useValue({
        assertReady: () => undefined,
        process: gatewayProcess,
        verifyCallback: gatewayVerifyCallback,
      })
      .compile();

    app = module.createNestApplication();
    app.setGlobalPrefix("api");
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);

    const user = await prisma.user.create({
      data: {
        email: `payment-integration-${randomUUID()}@brewlite.test`,
        passwordHash: "integration-test-only",
        fullName: "Payment Integration Test",
      },
    });
    userId = user.id;
    accessToken = app.get(JwtService).sign({
      sub: user.id,
      sessionVersion: user.sessionVersion,
    });

    const ingredient = await prisma.ingredient.create({
      data: {
        name: `Payment integration ingredient ${randomUUID()}`,
        unit: IngredientUnit.G,
        stock: STOCK_WHILE_RESERVED,
      },
    });
    ingredientId = ingredient.id;
  });

  beforeEach(async () => {
    await prisma.payment.deleteMany({ where: { order: { userId } } });
    await prisma.order.deleteMany({ where: { userId } });
    await prisma.ingredient.update({
      where: { id: ingredientId },
      data: { stock: STOCK_WHILE_RESERVED, version: 1 },
    });
    gatewayProcess.mockClear();
  });

  afterAll(async () => {
    if (prisma && userId) {
      await prisma.payment.deleteMany({ where: { order: { userId } } });
      await prisma.order.deleteMany({ where: { userId } });
      await prisma.ingredient.deleteMany({ where: { id: ingredientId } });
      await prisma.user.deleteMany({ where: { id: userId } });
    }
    await app?.close();
  });

  async function createOrder() {
    const order = await prisma.order.create({
      data: {
        orderNumber: `PAY-${randomUUID()}`,
        userId,
        subtotal: 58000,
        total: 58000,
        status: OrderStatus.PENDING,
      },
    });

    await prisma.orderInventoryReservation.create({
      data: {
        orderId: order.id,
        status: ReservationStatus.ACTIVE,
        lines: {
          create: {
            ingredientId,
            amount: RESERVED_AMOUNT,
          },
        },
      },
    });
    await prisma.orderStatusHistory.create({
      data: {
        orderId: order.id,
        fromStatus: null,
        toStatus: OrderStatus.PENDING,
        reason: "Payment integration order created",
      },
    });

    return order;
  }

  function paymentRequest(
    orderId: string,
    idempotencyKey: string,
    method: "VNPAY",
    scenario: string,
  ) {
    return request(app.getHttpServer())
      .post("/api/payments")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Idempotency-Key", idempotencyKey)
      .set("X-Mock-Payment-Scenario", scenario)
      .send({ orderId, method });
  }

  it("returns the payment authentication error contract without a JWT", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/payments")
      .set("Idempotency-Key", randomUUID())
      .send({ orderId: randomUUID(), method: "VNPAY" })
      .expect(401);

    expect(response.body).toMatchObject({
      statusCode: 401,
      code: "AUTHENTICATION_REQUIRED",
      retryable: false,
    });
    expect(gatewayProcess).not.toHaveBeenCalled();
  });

  it("deduplicates concurrent requests with the same key and payload", async () => {
    const order = await createOrder();
    const key = randomUUID();

    const [first, second] = await Promise.all([
      paymentRequest(order.id, key, "VNPAY", "SUCCESS").expect(200),
      paymentRequest(order.id, key, "VNPAY", "SUCCESS").expect(200),
    ]);

    expect(second.body).toEqual(first.body);
    expect(gatewayProcess).toHaveBeenCalledTimes(1);
    expect(await prisma.payment.count({ where: { idempotencyKey: key } })).toBe(
      1,
    );
    expect(
      await prisma.payment.count({
        where: { orderId: order.id, status: "PAID" },
      }),
    ).toBe(1);

    const paidOrder = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { reservation: true, statusHistory: true },
    });
    expect(paidOrder.status).toBe(OrderStatus.PAID);
    expect(paidOrder.version).toBe(2);
    expect(paidOrder.reservation?.status).toBe(ReservationStatus.CONSUMED);
    expect(paidOrder.reservation?.consumedAt).not.toBeNull();
    expect(paidOrder.statusHistory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fromStatus: OrderStatus.PENDING,
          toStatus: OrderStatus.PAID,
        }),
      ]),
    );
    expect(
      Number(
        (
          await prisma.ingredient.findUniqueOrThrow({
            where: { id: ingredientId },
          })
        ).stock,
      ),
    ).toBe(STOCK_WHILE_RESERVED);
  });

  it("persists a decline and permits a successful retry with a new key", async () => {
    const order = await createOrder();

    const declined = await paymentRequest(
      order.id,
      randomUUID(),
      "VNPAY",
      "FAILURE",
    ).expect(402);
    expect(declined.body).toMatchObject({
      paymentStatus: "FAILED",
      orderStatus: "PAYMENT_FAILED",
      resultCode: "PAYMENT_DECLINED",
      retryable: true,
    });
    expect(
      (await prisma.order.findUnique({ where: { id: order.id } }))?.status,
    ).toBe(OrderStatus.PAYMENT_FAILED);

    const failedReservation =
      await prisma.orderInventoryReservation.findUniqueOrThrow({
        where: { orderId: order.id },
      });
    expect(failedReservation.status).toBe(ReservationStatus.RELEASED);
    expect(failedReservation.releasedAt).not.toBeNull();
    expect(
      Number(
        (
          await prisma.ingredient.findUniqueOrThrow({
            where: { id: ingredientId },
          })
        ).stock,
      ),
    ).toBe(STOCK_AFTER_RELEASE);

    const paid = await paymentRequest(
      order.id,
      randomUUID(),
      "VNPAY",
      "SUCCESS",
    ).expect(200);
    expect(paid.body).toMatchObject({
      paymentStatus: "PAID",
      orderStatus: "PAID",
      resultCode: "PAYMENT_PAID",
      retryable: false,
    });
    expect(
      (await prisma.order.findUnique({ where: { id: order.id } }))?.status,
    ).toBe(OrderStatus.PAID);
    expect(await prisma.payment.count({ where: { orderId: order.id } })).toBe(
      2,
    );
    expect(gatewayProcess).toHaveBeenCalledTimes(2);

    const retriedOrder = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: {
        reservation: true,
        statusHistory: { orderBy: { createdAt: "asc" } },
      },
    });
    expect(retriedOrder.version).toBe(4);
    expect(retriedOrder.reservation?.status).toBe(ReservationStatus.CONSUMED);
    expect(retriedOrder.statusHistory.map((entry) => entry.toStatus)).toEqual([
      OrderStatus.PENDING,
      OrderStatus.PAYMENT_FAILED,
      OrderStatus.PENDING,
      OrderStatus.PAID,
    ]);
    expect(
      Number(
        (
          await prisma.ingredient.findUniqueOrThrow({
            where: { id: ingredientId },
          })
        ).stock,
      ),
    ).toBe(STOCK_WHILE_RESERVED);
  });

  it("keeps stock reserved for timeout and rejects a different key", async () => {
    const order = await createOrder();
    const firstKey = randomUUID();

    const unknown = await paymentRequest(
      order.id,
      firstKey,
      "VNPAY",
      "TIMEOUT",
    ).expect(202);
    expect(unknown.body).toMatchObject({
      paymentStatus: "UNKNOWN",
      orderStatus: "PENDING",
      resultCode: "PAYMENT_STATUS_UNKNOWN",
      retryable: false,
    });

    const blocked = await paymentRequest(
      order.id,
      randomUUID(),
      "VNPAY",
      "SUCCESS",
    ).expect(409);
    expect(blocked.body).toMatchObject({ code: "ORDER_NOT_PAYABLE" });
    expect(gatewayProcess).toHaveBeenCalledTimes(1);

    const pendingOrder = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { reservation: true },
    });
    expect(pendingOrder.status).toBe(OrderStatus.PENDING);
    expect(pendingOrder.reservation?.status).toBe(ReservationStatus.ACTIVE);
    expect(await prisma.payment.count({ where: { orderId: order.id } })).toBe(
      1,
    );
  });
});
