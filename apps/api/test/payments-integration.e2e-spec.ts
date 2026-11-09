import { randomUUID } from "crypto";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { OrderStatus } from "@prisma/client";
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

  const adapter = new MockPaymentGatewayAdapter(
    () => new Date("2026-11-09T12:00:00.000Z"),
  );
  const gatewayProcess = jest.fn((input: PaymentGatewayRequest) =>
    adapter.process(input),
  );

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PAYMENT_GATEWAY)
      .useValue({ process: gatewayProcess })
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
  });

  beforeEach(async () => {
    await prisma.payment.deleteMany({ where: { order: { userId } } });
    await prisma.order.deleteMany({ where: { userId } });
    gatewayProcess.mockClear();
  });

  afterAll(async () => {
    if (prisma && userId) {
      await prisma.payment.deleteMany({ where: { order: { userId } } });
      await prisma.order.deleteMany({ where: { userId } });
      await prisma.user.deleteMany({ where: { id: userId } });
    }
    await app?.close();
  });

  async function createOrder() {
    return prisma.order.create({
      data: {
        userId,
        totalAmount: 58000,
        finalAmount: 58000,
        status: OrderStatus.PENDING,
      },
    });
  }

  function paymentRequest(
    orderId: string,
    idempotencyKey: string,
    method: "WALLET" | "CARD",
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
      .send({ orderId: randomUUID(), method: "WALLET" })
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
      paymentRequest(order.id, key, "WALLET", "SUCCESS").expect(200),
      paymentRequest(order.id, key, "WALLET", "SUCCESS").expect(200),
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
  });

  it("persists a decline and permits a successful retry with a new key", async () => {
    const order = await createOrder();

    const declined = await paymentRequest(
      order.id,
      randomUUID(),
      "CARD",
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

    const paid = await paymentRequest(
      order.id,
      randomUUID(),
      "CARD",
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
  });
});
