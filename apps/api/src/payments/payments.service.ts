import { HttpException, Inject, Injectable, Logger } from "@nestjs/common";
import {
  OrderStatus,
  Payment,
  PaymentStatus as StoredPaymentStatus,
  Prisma,
  ReservationStatus,
} from "@prisma/client";
import { createHash } from "crypto";
import { isUUID } from "class-validator";
import { OrdersService } from "../orders/orders.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import {
  MOCK_PAYMENT_SCENARIOS,
  MockPaymentScenario,
  PaymentExecutionResult,
  PaymentGatewayResult,
  PaymentOrderStatus,
  VnpayIpnResponse,
} from "./domain/payment.types";
import { paymentError } from "./payment.errors";
import {
  PAYMENT_GATEWAY,
  PaymentGatewayPort,
} from "./ports/payment-gateway.port";

type PaymentWithOwner = Payment & { order: { userId: string } };

const REPLAY_POLL_ATTEMPTS = 20;
const REPLAY_POLL_INTERVAL_MS = 25;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_GATEWAY)
    private readonly gateway: PaymentGatewayPort,
    private readonly ordersService: OrdersService,
  ) {}

  async processPayment(
    userId: string,
    idempotencyKey: string | undefined,
    input: CreatePaymentDto,
    mockScenarioHeader?: string,
    clientIp?: string,
  ): Promise<PaymentExecutionResult> {
    const normalizedKey = this.validateIdempotencyKey(idempotencyKey);
    const scenario = this.resolveMockScenario(mockScenarioHeader);
    const fingerprint = this.fingerprint(input);

    const replay = await this.findPaymentWithOwner(normalizedKey);
    if (replay) {
      return await this.resolveReplay(replay, userId, fingerprint);
    }

    try {
      this.gateway.assertReady();
    } catch {
      throw paymentError(
        503,
        "PAYMENT_GATEWAY_UNAVAILABLE",
        "VNPay Sandbox is not configured or temporarily unavailable.",
        true,
      );
    }

    let reservedPayment: Payment;
    try {
      reservedPayment = await this.reservePaymentAttempt(
        userId,
        normalizedKey,
        fingerprint,
        input,
      );
    } catch (error) {
      return await this.recoverReservationFailure(
        error,
        normalizedKey,
        userId,
        fingerprint,
        input.orderId,
      );
    }

    const gatewayResult = await this.invokeGatewaySafely(
      reservedPayment,
      scenario,
      clientIp,
    );

    try {
      const stored = await this.finalizePaymentAttempt(
        reservedPayment,
        userId,
        gatewayResult,
      );
      return this.toExecutionResult(stored);
    } catch (error) {
      this.logger.error(
        `Could not apply gateway result for payment ${reservedPayment.id}; the durable PROCESSING attempt is retained for reconciliation.`,
        error instanceof Error ? error.stack : undefined,
      );
      throw paymentError(
        500,
        "PAYMENT_INTERNAL_ERROR",
        "The gateway result could not be applied. The payment remains PROCESSING and must be reconciled with the same Idempotency-Key.",
        true,
      );
    }
  }

  /**
   * Transaction A: reserve the idempotency key and persist PROCESSING before
   * any external gateway call. A retry after PAYMENT_FAILED revalidates and
   * reserves inventory in the same transaction.
   */
  private reservePaymentAttempt(
    userId: string,
    idempotencyKey: string,
    fingerprint: string,
    input: CreatePaymentDto,
  ): Promise<Payment> {
    return this.prisma.$transaction(
      async (tx) => {
        const order = await tx.order.findUnique({
          where: { id: input.orderId },
          include: { reservation: true },
        });

        if (!order) {
          throw paymentError(
            404,
            "ORDER_NOT_FOUND",
            "The requested order does not exist.",
          );
        }
        if (order.userId !== userId) {
          throw paymentError(
            403,
            "ORDER_ACCESS_DENIED",
            "The authenticated customer does not own this order.",
          );
        }
        if (order.status === OrderStatus.PAID) {
          throw paymentError(
            409,
            "ORDER_ALREADY_PAID",
            "The order has already been paid.",
          );
        }
        if (
          order.status !== OrderStatus.PENDING &&
          order.status !== OrderStatus.PAYMENT_FAILED
        ) {
          throw paymentError(
            409,
            "ORDER_NOT_PAYABLE",
            "The order is not in a payable state.",
          );
        }

        const unresolvedAttempt = await tx.payment.findFirst({
          where: {
            orderId: order.id,
            status: {
              in: [StoredPaymentStatus.PROCESSING, StoredPaymentStatus.UNKNOWN],
            },
          },
        });
        if (unresolvedAttempt) {
          throw paymentError(
            409,
            "ORDER_NOT_PAYABLE",
            "The order already has an unresolved payment attempt.",
            true,
          );
        }

        if (order.status === OrderStatus.PAYMENT_FAILED) {
          await this.ordersService.transitionOrderStatusInTransaction(
            tx,
            order.id,
            OrderStatus.PENDING,
            { userId, role: "PAYMENT" },
            "Customer explicitly retried payment; inventory revalidated and reserved",
          );
        } else if (
          !order.reservation ||
          order.reservation.status !== ReservationStatus.ACTIVE
        ) {
          throw paymentError(
            409,
            "ORDER_NOT_PAYABLE",
            "The order does not have an active inventory reservation.",
          );
        }

        return await tx.payment.create({
          data: {
            orderId: order.id,
            idempotencyKey,
            requestFingerprint: fingerprint,
            method: input.method,
            amount: order.total,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  /**
   * Transaction B: apply the gateway outcome and the complete Order lifecycle
   * atomically. Stock, reservation, order version and status history therefore
   * cannot diverge from the persisted Payment result.
   */
  private finalizePaymentAttempt(
    reservedPayment: Payment,
    userId: string,
    gatewayResult: PaymentGatewayResult,
  ): Promise<Payment> {
    return this.prisma.$transaction(
      async (tx) => {
        const current = await tx.payment.findUnique({
          where: { id: reservedPayment.id },
        });
        if (!current) {
          throw new Error(
            `Reserved payment ${reservedPayment.id} was not found`,
          );
        }
        if (
          current.status !== StoredPaymentStatus.PROCESSING &&
          current.status !== StoredPaymentStatus.UNKNOWN
        ) {
          return current;
        }

        if (gatewayResult.paymentStatus === "PAID") {
          await this.ordersService.transitionOrderStatusInTransaction(
            tx,
            current.orderId,
            OrderStatus.PAID,
            { userId, role: "PAYMENT" },
            "Payment processed successfully",
          );
        } else if (gatewayResult.paymentStatus === "FAILED") {
          await this.ordersService.transitionOrderStatusInTransaction(
            tx,
            current.orderId,
            OrderStatus.PAYMENT_FAILED,
            { userId, role: "PAYMENT" },
            "Payment declined or failed",
          );
        }

        const isTerminal =
          gatewayResult.paymentStatus === "PAID" ||
          gatewayResult.paymentStatus === "FAILED";

        return await tx.payment.update({
          where: { id: current.id },
          data: {
            status: gatewayResult.paymentStatus,
            resultCode: gatewayResult.resultCode,
            retryable: gatewayResult.retryable,
            httpStatus: this.httpStatusFor(gatewayResult.paymentStatus),
            ...(gatewayResult.providerTransactionRef
              ? { providerTxnRef: gatewayResult.providerTransactionRef }
              : {}),
            ...(gatewayResult.providerTransactionDate
              ? { providerTxnDate: gatewayResult.providerTransactionDate }
              : {}),
            ...(gatewayResult.gatewayTransactionNo
              ? { gatewayTxnNo: gatewayResult.gatewayTransactionNo }
              : {}),
            ...(isTerminal
              ? { checkoutUrl: null }
              : gatewayResult.checkoutUrl
                ? { checkoutUrl: gatewayResult.checkoutUrl }
                : {}),
            ...(gatewayResult.expiresAt
              ? { expiresAt: gatewayResult.expiresAt }
              : {}),
            processedAt: gatewayResult.processedAt,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async invokeGatewaySafely(
    payment: Payment,
    scenario?: MockPaymentScenario,
    clientIp?: string,
  ): Promise<PaymentGatewayResult> {
    try {
      return await this.gateway.process({
        paymentId: payment.id,
        orderId: payment.orderId,
        idempotencyKey: payment.idempotencyKey,
        method: payment.method,
        amount: Number(payment.amount),
        ipAddress: clientIp,
        scenario,
      });
    } catch {
      this.logger.warn(
        `Gateway outcome is unknown for payment ${payment.id}; preserving it for reconciliation.`,
      );
      return {
        paymentStatus: "UNKNOWN",
        resultCode: "PAYMENT_STATUS_UNKNOWN",
        retryable: false,
        processedAt: null,
      };
    }
  }

  private async recoverReservationFailure(
    error: unknown,
    idempotencyKey: string,
    userId: string,
    fingerprint: string,
    orderId: string,
  ): Promise<PaymentExecutionResult> {
    if (
      (error instanceof HttpException && error.getStatus() === 409) ||
      this.isConcurrencyConflict(error)
    ) {
      const concurrentReplay = await this.findPaymentWithOwner(idempotencyKey);
      if (concurrentReplay) {
        return await this.resolveReplay(concurrentReplay, userId, fingerprint);
      }

      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        select: { status: true },
      });
      if (order?.status === OrderStatus.PAID) {
        throw paymentError(
          409,
          "ORDER_ALREADY_PAID",
          "The order has already been paid.",
        );
      }

      const unresolvedAttempt = await this.prisma.payment.findFirst({
        where: {
          orderId,
          status: {
            in: [StoredPaymentStatus.PROCESSING, StoredPaymentStatus.UNKNOWN],
          },
        },
      });
      if (unresolvedAttempt) {
        throw paymentError(
          409,
          "ORDER_NOT_PAYABLE",
          "The order already has an unresolved payment attempt.",
          true,
        );
      }
    }

    if (error instanceof HttpException) {
      throw error;
    }

    throw paymentError(
      500,
      "PAYMENT_INTERNAL_ERROR",
      "The payment attempt could not be reserved. Retry the same request with the same Idempotency-Key.",
      true,
    );
  }

  private validateIdempotencyKey(key?: string): string {
    if (!key || !isUUID(key, "4")) {
      throw paymentError(
        400,
        "INVALID_PAYMENT_REQUEST",
        "Idempotency-Key must be a valid UUID v4.",
      );
    }

    return key.toLowerCase();
  }

  private resolveMockScenario(
    header?: string,
  ): MockPaymentScenario | undefined {
    if (!header || process.env.NODE_ENV !== "test") {
      return undefined;
    }

    if (!MOCK_PAYMENT_SCENARIOS.includes(header as MockPaymentScenario)) {
      throw paymentError(
        400,
        "INVALID_PAYMENT_REQUEST",
        "X-Mock-Payment-Scenario is not supported.",
      );
    }

    return header as MockPaymentScenario;
  }

  private fingerprint(input: CreatePaymentDto): string {
    return createHash("sha256")
      .update(JSON.stringify({ orderId: input.orderId, method: input.method }))
      .digest("hex");
  }

  private findPaymentWithOwner(
    idempotencyKey: string,
  ): Promise<PaymentWithOwner | null> {
    return this.prisma.payment.findUnique({
      where: { idempotencyKey },
      include: { order: { select: { userId: true } } },
    });
  }

  private async resolveReplay(
    payment: PaymentWithOwner,
    userId: string,
    fingerprint: string,
  ): Promise<PaymentExecutionResult> {
    this.assertReplayAccess(payment, userId, fingerprint);

    let stored = payment;
    if (
      stored.status === StoredPaymentStatus.PROCESSING &&
      !stored.checkoutUrl
    ) {
      stored = await this.waitForStoredOutcome(stored, userId, fingerprint);
    }

    return this.toExecutionResult(stored);
  }

  private assertReplayAccess(
    payment: PaymentWithOwner,
    userId: string,
    fingerprint: string,
  ): void {
    if (payment.order.userId !== userId) {
      throw paymentError(
        403,
        "ORDER_ACCESS_DENIED",
        "The authenticated customer does not own this order.",
      );
    }
    if (payment.requestFingerprint !== fingerprint) {
      throw paymentError(
        409,
        "IDEMPOTENCY_KEY_CONFLICT",
        "Idempotency-Key is already associated with a different payment payload.",
      );
    }
  }

  private async waitForStoredOutcome(
    initial: PaymentWithOwner,
    userId: string,
    fingerprint: string,
  ): Promise<PaymentWithOwner> {
    let latest = initial;
    for (let attempt = 0; attempt < REPLAY_POLL_ATTEMPTS; attempt += 1) {
      await new Promise((resolve) =>
        setTimeout(resolve, REPLAY_POLL_INTERVAL_MS),
      );
      const refreshed = await this.findPaymentWithOwner(initial.idempotencyKey);
      if (!refreshed) {
        break;
      }
      this.assertReplayAccess(refreshed, userId, fingerprint);
      latest = refreshed;
      if (latest.status !== StoredPaymentStatus.PROCESSING) {
        break;
      }
    }
    return latest;
  }

  private toExecutionResult(payment: Payment): PaymentExecutionResult {
    return {
      httpStatus: payment.httpStatus,
      body: {
        paymentId: payment.id,
        orderId: payment.orderId,
        method: payment.method,
        amount: Number(payment.amount),
        paymentStatus: payment.status,
        orderStatus: this.orderStatusFor(payment.status),
        resultCode: payment.resultCode,
        retryable: payment.retryable,
        processedAt: payment.processedAt?.toISOString() ?? null,
        checkoutUrl: payment.checkoutUrl,
        expiresAt: payment.expiresAt?.toISOString() ?? null,
      },
    };
  }

  private orderStatusFor(status: StoredPaymentStatus): PaymentOrderStatus {
    if (status === StoredPaymentStatus.PAID) return "PAID";
    if (status === StoredPaymentStatus.FAILED) return "PAYMENT_FAILED";
    return "PENDING";
  }

  private httpStatusFor(status: string): number {
    if (status === "PAID") return 200;
    if (status === "FAILED") return 402;
    return 202;
  }

  private isConcurrencyConflict(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ["P2002", "P2034"].includes(error.code)
    );
  }

  async getPaymentStatus(
    userId: string,
    paymentId: string,
  ): Promise<PaymentExecutionResult> {
    if (!isUUID(paymentId, "4")) {
      throw paymentError(
        400,
        "INVALID_PAYMENT_REQUEST",
        "Payment id must be a valid UUID v4.",
      );
    }

    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: { select: { userId: true } } },
    });
    if (!payment) {
      throw paymentError(404, "PAYMENT_NOT_FOUND", "Payment was not found.");
    }
    if (payment.order.userId !== userId) {
      throw paymentError(
        403,
        "ORDER_ACCESS_DENIED",
        "The authenticated customer does not own this payment.",
      );
    }

    return this.toExecutionResult(payment);
  }

  async handleVnpayIpn(
    params: Record<string, string>,
  ): Promise<VnpayIpnResponse> {
    const callback = this.gateway.verifyCallback(params);
    if (!callback.valid || !callback.transactionRef) {
      return { RspCode: "97", Message: "Invalid checksum" };
    }

    const payment = await this.prisma.payment.findUnique({
      where: { providerTxnRef: callback.transactionRef },
      include: { order: { select: { userId: true } } },
    });
    if (!payment) {
      return { RspCode: "01", Message: "Order not found" };
    }

    if (callback.amount !== Math.round(Number(payment.amount) * 100)) {
      return { RspCode: "04", Message: "Invalid amount" };
    }

    if (
      payment.status === StoredPaymentStatus.PAID ||
      payment.status === StoredPaymentStatus.FAILED
    ) {
      return { RspCode: "02", Message: "Order already confirmed" };
    }

    const gatewayResult: PaymentGatewayResult = callback.successful
      ? {
          paymentStatus: "PAID",
          resultCode: "PAYMENT_PAID",
          retryable: false,
          processedAt: callback.processedAt,
          gatewayTransactionNo: callback.gatewayTransactionNo,
        }
      : callback.finalFailure
        ? {
            paymentStatus: "FAILED",
            resultCode: "PAYMENT_DECLINED",
            retryable: true,
            processedAt: callback.processedAt,
            gatewayTransactionNo: callback.gatewayTransactionNo,
          }
        : {
            paymentStatus: "UNKNOWN",
            resultCode: "PAYMENT_STATUS_UNKNOWN",
            retryable: false,
            processedAt: null,
            gatewayTransactionNo: callback.gatewayTransactionNo,
          };

    try {
      await this.finalizePaymentAttempt(
        payment,
        payment.order.userId,
        gatewayResult,
      );
      return { RspCode: "00", Message: "Confirm success" };
    } catch (error) {
      this.logger.error(
        `Could not apply VNPay IPN for payment ${payment.id}.`,
        error instanceof Error ? error.stack : undefined,
      );
      return { RspCode: "99", Message: "Unknown error" };
    }
  }

  async resolveVnpayReturn(params: Record<string, string>): Promise<string> {
    const callback = this.gateway.verifyCallback(params);
    const frontendUrl = new URL(
      process.env.VNPAY_FRONTEND_RETURN_URL ||
        "http://localhost:3006/checkout/vnpay-return",
    );
    frontendUrl.searchParams.set("valid", callback.valid ? "true" : "false");
    if (callback.responseCode) {
      frontendUrl.searchParams.set("responseCode", callback.responseCode);
    }

    if (callback.valid && callback.transactionRef) {
      const payment = await this.prisma.payment.findUnique({
        where: { providerTxnRef: callback.transactionRef },
        select: { id: true },
      });
      if (payment) frontendUrl.searchParams.set("paymentId", payment.id);
    }

    return frontendUrl.toString();
  }
}
