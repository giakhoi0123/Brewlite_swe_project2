import { HttpException } from "@nestjs/common";
import {
  OrderStatus,
  PaymentResultCode,
  PaymentStatus,
  Prisma,
} from "@prisma/client";
import { PaymentsService } from "./payments.service";
import { PaymentGatewayPort } from "./ports/payment-gateway.port";

const USER_ID = "10000000-0000-4000-8000-000000000001";
const ORDER_ID = "10000000-0000-4000-8000-000000000002";
const FIRST_KEY = "20000000-0000-4000-8000-000000000001";
const RETRY_KEY = "20000000-0000-4000-8000-000000000002";
const FIXED_TIME = new Date("2026-11-09T12:00:00.000Z");

function createHarness(initialStatus: OrderStatus = OrderStatus.PENDING) {
  const order = {
    id: ORDER_ID,
    userId: USER_ID,
    total: new Prisma.Decimal(58000),
    status: initialStatus,
  };
  const payments: any[] = [];

  const paymentFindUnique = jest.fn(async ({ where }: any) => {
    const payment = payments.find(
      (candidate) => candidate.idempotencyKey === where.idempotencyKey,
    );
    return payment ? { ...payment, order: { userId: order.userId } } : null;
  });
  const orderFindUnique = jest.fn(async () => ({ ...order }));
  const tx = {
    order: {
      findUnique: orderFindUnique,
      update: jest.fn(async ({ data }: any) => {
        Object.assign(order, data);
        return { ...order };
      }),
    },
    payment: {
      create: jest.fn(async ({ data }: any) => {
        const payment = {
          id: `30000000-0000-4000-8000-${String(payments.length + 1).padStart(12, "0")}`,
          ...data,
          amount: new Prisma.Decimal(data.amount),
          status: PaymentStatus.PROCESSING,
          resultCode: PaymentResultCode.PAYMENT_PROCESSING,
          retryable: false,
          httpStatus: 202,
          processedAt: null,
          createdAt: FIXED_TIME,
          updatedAt: FIXED_TIME,
        };
        payments.push(payment);
        return payment;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const payment = payments.find((candidate) => candidate.id === where.id);
        Object.assign(payment, data, { updatedAt: FIXED_TIME });
        return { ...payment };
      }),
    },
  };
  const prisma = {
    payment: { findUnique: paymentFindUnique },
    order: { findUnique: orderFindUnique },
    $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  } as any;
  const process = jest.fn();
  const gateway: PaymentGatewayPort = { process };
  const service = new PaymentsService(prisma, gateway);

  return { service, process, order, payments, paymentFindUnique };
}

async function expectPaymentError(
  promise: Promise<unknown>,
  status: number,
  code: string,
) {
  try {
    await promise;
    throw new Error("Expected payment request to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(HttpException);
    const exception = error as HttpException;
    expect(exception.getStatus()).toBe(status);
    expect(exception.getResponse()).toMatchObject({ statusCode: status, code });
  }
}

describe("PaymentsService", () => {
  it("replays the stored response for the same key and payload", async () => {
    const { service, process, payments } = createHarness();
    process.mockResolvedValue({
      paymentStatus: "PAID",
      resultCode: "PAYMENT_PAID",
      retryable: false,
      processedAt: FIXED_TIME,
    });

    const first = await service.processPayment(
      USER_ID,
      FIRST_KEY,
      { orderId: ORDER_ID, method: "WALLET" },
      "SUCCESS",
    );
    const replay = await service.processPayment(
      USER_ID,
      FIRST_KEY,
      { orderId: ORDER_ID, method: "WALLET" },
      "FAILURE",
    );

    expect(replay).toEqual(first);
    expect(payments).toHaveLength(1);
    expect(process).toHaveBeenCalledTimes(1);
  });

  it("recovers a same-key race after another request marks the order paid", async () => {
    const { service, process, payments, paymentFindUnique } = createHarness();
    process.mockResolvedValue({
      paymentStatus: "PAID",
      resultCode: "PAYMENT_PAID",
      retryable: false,
      processedAt: FIXED_TIME,
    });

    const first = await service.processPayment(
      USER_ID,
      FIRST_KEY,
      { orderId: ORDER_ID, method: "WALLET" },
      "SUCCESS",
    );

    paymentFindUnique.mockResolvedValueOnce(null);
    const replay = await service.processPayment(
      USER_ID,
      FIRST_KEY,
      { orderId: ORDER_ID, method: "WALLET" },
      "SUCCESS",
    );

    expect(replay).toEqual(first);
    expect(payments).toHaveLength(1);
    expect(process).toHaveBeenCalledTimes(1);
  });

  it("rejects an idempotency key reused with a different payload", async () => {
    const { service, process } = createHarness();
    process.mockResolvedValue({
      paymentStatus: "FAILED",
      resultCode: "PAYMENT_DECLINED",
      retryable: true,
      processedAt: FIXED_TIME,
    });
    await service.processPayment(
      USER_ID,
      FIRST_KEY,
      { orderId: ORDER_ID, method: "WALLET" },
      "FAILURE",
    );

    await expectPaymentError(
      service.processPayment(USER_ID, FIRST_KEY, {
        orderId: ORDER_ID,
        method: "CARD",
      }),
      409,
      "IDEMPOTENCY_KEY_CONFLICT",
    );
    expect(process).toHaveBeenCalledTimes(1);
  });

  it("rejects a new attempt for an already-paid order", async () => {
    const { service, process } = createHarness(OrderStatus.PAID);

    await expectPaymentError(
      service.processPayment(USER_ID, FIRST_KEY, {
        orderId: ORDER_ID,
        method: "CARD",
      }),
      409,
      "ORDER_ALREADY_PAID",
    );
    expect(process).not.toHaveBeenCalled();
  });

  it("allows an explicit retry with a new key after a declined payment", async () => {
    const { service, process, order, payments } = createHarness();
    process
      .mockResolvedValueOnce({
        paymentStatus: "FAILED",
        resultCode: "PAYMENT_DECLINED",
        retryable: true,
        processedAt: FIXED_TIME,
      })
      .mockResolvedValueOnce({
        paymentStatus: "PAID",
        resultCode: "PAYMENT_PAID",
        retryable: false,
        processedAt: FIXED_TIME,
      });

    const declined = await service.processPayment(
      USER_ID,
      FIRST_KEY,
      { orderId: ORDER_ID, method: "CARD" },
      "FAILURE",
    );
    expect(declined.httpStatus).toBe(402);
    expect(order.status).toBe(OrderStatus.PAYMENT_FAILED);

    const paid = await service.processPayment(
      USER_ID,
      RETRY_KEY,
      { orderId: ORDER_ID, method: "CARD" },
      "SUCCESS",
    );
    expect(paid.httpStatus).toBe(200);
    expect(order.status).toBe(OrderStatus.PAID);
    expect(payments).toHaveLength(2);
    expect(process).toHaveBeenCalledTimes(2);
  });
});
