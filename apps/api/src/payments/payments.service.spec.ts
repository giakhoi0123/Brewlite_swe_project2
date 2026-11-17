import { HttpException } from "@nestjs/common";
import {
  OrderStatus,
  PaymentResultCode,
  PaymentStatus,
  Prisma,
  ReservationStatus,
} from "@prisma/client";
import { PaymentsService } from "./payments.service";
import { PaymentGatewayPort } from "./ports/payment-gateway.port";

const USER_ID = "10000000-0000-4000-8000-000000000001";
const ORDER_ID = "10000000-0000-4000-8000-000000000002";
const OTHER_ORDER_ID = "10000000-0000-4000-8000-000000000003";
const FIRST_KEY = "20000000-0000-4000-8000-000000000001";
const RETRY_KEY = "20000000-0000-4000-8000-000000000002";
const FIXED_TIME = new Date("2026-11-09T12:00:00.000Z");

function createHarness(initialStatus: OrderStatus = OrderStatus.PENDING) {
  const reservation = {
    id: "40000000-0000-4000-8000-000000000001",
    status:
      initialStatus === OrderStatus.PAYMENT_FAILED
        ? ReservationStatus.RELEASED
        : initialStatus === OrderStatus.PAID
          ? ReservationStatus.CONSUMED
          : ReservationStatus.ACTIVE,
  };
  const order = {
    id: ORDER_ID,
    userId: USER_ID,
    total: new Prisma.Decimal(58000),
    status: initialStatus,
    reservation,
  };
  const payments: any[] = [];

  const paymentFindUnique = jest.fn(async ({ where }: any) => {
    const payment = payments.find((candidate) =>
      where.idempotencyKey
        ? candidate.idempotencyKey === where.idempotencyKey
        : where.providerTxnRef
          ? candidate.providerTxnRef === where.providerTxnRef
          : candidate.id === where.id,
    );
    return payment ? { ...payment, order: { userId: order.userId } } : null;
  });
  const orderFindUnique = jest.fn(async () => ({
    ...order,
    reservation: { ...reservation },
  }));
  const tx = {
    order: {
      findUnique: orderFindUnique,
    },
    payment: {
      findFirst: jest.fn(async () =>
        payments.find(
          (candidate) =>
            candidate.orderId === order.id &&
            [PaymentStatus.PROCESSING, PaymentStatus.UNKNOWN].includes(
              candidate.status,
            ),
        ),
      ),
      findUnique: jest.fn(async ({ where }: any) =>
        payments.find((candidate) => candidate.id === where.id),
      ),
      create: jest.fn(async ({ data }: any) => {
        const payment = {
          id: `30000000-0000-4000-8000-${String(payments.length + 1).padStart(12, "0")}`,
          ...data,
          amount: new Prisma.Decimal(data.amount),
          status: PaymentStatus.PROCESSING,
          resultCode: PaymentResultCode.PAYMENT_PROCESSING,
          retryable: false,
          httpStatus: 202,
          providerTxnRef: null,
          gatewayTxnNo: null,
          checkoutUrl: null,
          expiresAt: null,
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
  const transitionOrderStatusInTransaction = jest.fn(
    async (_tx: unknown, _orderId: string, targetStatus: OrderStatus) => {
      order.status = targetStatus;
      if (targetStatus === OrderStatus.PENDING) {
        reservation.status = ReservationStatus.ACTIVE;
      } else if (targetStatus === OrderStatus.PAID) {
        reservation.status = ReservationStatus.CONSUMED;
      } else if (targetStatus === OrderStatus.PAYMENT_FAILED) {
        reservation.status = ReservationStatus.RELEASED;
      }
      return { ...order, reservation: { ...reservation } };
    },
  );
  const ordersService = { transitionOrderStatusInTransaction } as any;
  const prisma = {
    payment: {
      findUnique: paymentFindUnique,
      findFirst: tx.payment.findFirst,
    },
    order: { findUnique: orderFindUnique },
    $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  } as any;
  const process = jest.fn();
  const verifyCallback = jest.fn();
  const assertReady = jest.fn();
  const gateway: PaymentGatewayPort = {
    assertReady,
    process,
    verifyCallback,
  };
  const service = new PaymentsService(prisma, gateway, ordersService);

  return {
    service,
    process,
    verifyCallback,
    assertReady,
    order,
    reservation,
    payments,
    paymentFindUnique,
    transitionOrderStatusInTransaction,
  };
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
      { orderId: ORDER_ID, method: "VNPAY" },
      "SUCCESS",
    );
    const replay = await service.processPayment(
      USER_ID,
      FIRST_KEY,
      { orderId: ORDER_ID, method: "VNPAY" },
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
      { orderId: ORDER_ID, method: "VNPAY" },
      "SUCCESS",
    );

    paymentFindUnique.mockResolvedValueOnce(null);
    const replay = await service.processPayment(
      USER_ID,
      FIRST_KEY,
      { orderId: ORDER_ID, method: "VNPAY" },
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
      { orderId: ORDER_ID, method: "VNPAY" },
      "FAILURE",
    );

    await expectPaymentError(
      service.processPayment(USER_ID, FIRST_KEY, {
        orderId: OTHER_ORDER_ID,
        method: "VNPAY",
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
        method: "VNPAY",
      }),
      409,
      "ORDER_ALREADY_PAID",
    );
    expect(process).not.toHaveBeenCalled();
  });

  it("rejects missing VNPay configuration before reserving a payment", async () => {
    const { service, assertReady, process, payments } = createHarness();
    assertReady.mockImplementation(() => {
      throw new Error("missing VNPay credentials");
    });

    await expectPaymentError(
      service.processPayment(USER_ID, FIRST_KEY, {
        orderId: ORDER_ID,
        method: "VNPAY",
      }),
      503,
      "PAYMENT_GATEWAY_UNAVAILABLE",
    );
    expect(process).not.toHaveBeenCalled();
    expect(payments).toHaveLength(0);
  });

  it("allows an explicit retry with a new key after a declined payment", async () => {
    const {
      service,
      process,
      order,
      reservation,
      payments,
      transitionOrderStatusInTransaction,
    } = createHarness();
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
      { orderId: ORDER_ID, method: "VNPAY" },
      "FAILURE",
    );
    expect(declined.httpStatus).toBe(402);
    expect(order.status).toBe(OrderStatus.PAYMENT_FAILED);
    expect(reservation.status).toBe(ReservationStatus.RELEASED);

    const paid = await service.processPayment(
      USER_ID,
      RETRY_KEY,
      { orderId: ORDER_ID, method: "VNPAY" },
      "SUCCESS",
    );
    expect(paid.httpStatus).toBe(200);
    expect(order.status).toBe(OrderStatus.PAID);
    expect(reservation.status).toBe(ReservationStatus.CONSUMED);
    expect(payments).toHaveLength(2);
    expect(process).toHaveBeenCalledTimes(2);
    expect(transitionOrderStatusInTransaction).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      ORDER_ID,
      OrderStatus.PENDING,
      expect.objectContaining({ role: "PAYMENT" }),
      expect.any(String),
    );
  });

  it("persists UNKNOWN and keeps the reservation active when the gateway throws", async () => {
    const { service, process, order, reservation, payments } = createHarness();
    process.mockRejectedValue(new Error("gateway timeout"));

    const result = await service.processPayment(
      USER_ID,
      FIRST_KEY,
      { orderId: ORDER_ID, method: "VNPAY" },
      "TIMEOUT",
    );

    expect(result.httpStatus).toBe(202);
    expect(result.body.paymentStatus).toBe("UNKNOWN");
    expect(order.status).toBe(OrderStatus.PENDING);
    expect(reservation.status).toBe(ReservationStatus.ACTIVE);
    expect(payments).toHaveLength(1);
  });

  it("rejects a new key while an unresolved attempt exists", async () => {
    const { service, process, payments } = createHarness();
    process.mockResolvedValue({
      paymentStatus: "PROCESSING",
      resultCode: "PAYMENT_PROCESSING",
      retryable: false,
      processedAt: null,
    });

    await service.processPayment(
      USER_ID,
      FIRST_KEY,
      { orderId: ORDER_ID, method: "VNPAY" },
      "PROCESSING",
    );

    await expectPaymentError(
      service.processPayment(USER_ID, RETRY_KEY, {
        orderId: ORDER_ID,
        method: "VNPAY",
      }),
      409,
      "ORDER_NOT_PAYABLE",
    );
    expect(payments).toHaveLength(1);
    expect(process).toHaveBeenCalledTimes(1);
  });

  it("applies a verified VNPay IPN exactly once", async () => {
    const { service, process, verifyCallback, order, reservation, payments } =
      createHarness();
    process.mockResolvedValue({
      paymentStatus: "PROCESSING",
      resultCode: "PAYMENT_PROCESSING",
      retryable: false,
      processedAt: null,
      providerTransactionRef: "30000000000040008000000000000001",
      checkoutUrl: "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?signed",
      expiresAt: new Date("2026-11-09T12:15:00.000Z"),
    });
    verifyCallback.mockReturnValue({
      valid: true,
      transactionRef: "30000000000040008000000000000001",
      gatewayTransactionNo: "14226112",
      amount: 5800000,
      successful: true,
      finalFailure: false,
      responseCode: "00",
      transactionStatus: "00",
      processedAt: FIXED_TIME,
    });

    await service.processPayment(USER_ID, FIRST_KEY, {
      orderId: ORDER_ID,
      method: "VNPAY",
    });
    const firstIpn = await service.handleVnpayIpn({ signed: "callback" });
    const duplicateIpn = await service.handleVnpayIpn({ signed: "callback" });

    expect(firstIpn).toEqual({ RspCode: "00", Message: "Confirm success" });
    expect(duplicateIpn).toEqual({
      RspCode: "02",
      Message: "Order already confirmed",
    });
    expect(payments[0]).toMatchObject({
      status: PaymentStatus.PAID,
      gatewayTxnNo: "14226112",
      checkoutUrl: null,
    });
    expect(order.status).toBe(OrderStatus.PAID);
    expect(reservation.status).toBe(ReservationStatus.CONSUMED);
  });
});
