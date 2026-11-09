import { Inject, Injectable, HttpException } from "@nestjs/common";
import {
  OrderStatus,
  Payment,
  PaymentStatus as StoredPaymentStatus,
  Prisma,
} from "@prisma/client";
import { createHash } from "crypto";
import { isUUID } from "class-validator";
import { PrismaService } from "../prisma/prisma.service";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import {
  MOCK_PAYMENT_SCENARIOS,
  MockPaymentScenario,
  PaymentExecutionResult,
  PaymentOrderStatus,
} from "./domain/payment.types";
import { paymentError } from "./payment.errors";
import {
  PAYMENT_GATEWAY,
  PaymentGatewayPort,
} from "./ports/payment-gateway.port";

type PaymentWithOwner = Payment & { order: { userId: string } };

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_GATEWAY)
    private readonly gateway: PaymentGatewayPort,
  ) {}

  async processPayment(
    userId: string,
    idempotencyKey: string | undefined,
    input: CreatePaymentDto,
    mockScenarioHeader?: string,
  ): Promise<PaymentExecutionResult> {
    const normalizedKey = this.validateIdempotencyKey(idempotencyKey);
    const scenario = this.resolveMockScenario(mockScenarioHeader);
    const fingerprint = this.fingerprint(input);

    const replay = await this.findPaymentWithOwner(normalizedKey);
    if (replay) {
      return this.resolveReplay(replay, userId, fingerprint);
    }

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const order = await tx.order.findUnique({
            where: { id: input.orderId },
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

          const amount = Number(order.finalAmount);
          const payment = await tx.payment.create({
            data: {
              orderId: order.id,
              idempotencyKey: normalizedKey,
              requestFingerprint: fingerprint,
              method: input.method,
              amount: order.finalAmount,
            },
          });

          const gatewayResult = await this.gateway.process({
            orderId: order.id,
            idempotencyKey: normalizedKey,
            method: input.method,
            amount,
            scenario,
          });
          const httpStatus = this.httpStatusFor(gatewayResult.paymentStatus);

          if (gatewayResult.paymentStatus === "PAID") {
            await tx.order.update({
              where: { id: order.id },
              data: { status: OrderStatus.PAID },
            });
          } else if (gatewayResult.paymentStatus === "FAILED") {
            await tx.order.update({
              where: { id: order.id },
              data: { status: OrderStatus.PAYMENT_FAILED },
            });
          }

          const stored = await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: gatewayResult.paymentStatus,
              resultCode: gatewayResult.resultCode,
              retryable: gatewayResult.retryable,
              httpStatus,
              processedAt: gatewayResult.processedAt,
            },
          });

          return this.toExecutionResult(stored);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      if (this.isConcurrencyConflict(error)) {
        const concurrentReplay = await this.findPaymentWithOwner(normalizedKey);
        if (concurrentReplay) {
          return this.resolveReplay(concurrentReplay, userId, fingerprint);
        }

        const order = await this.prisma.order.findUnique({
          where: { id: input.orderId },
          select: { status: true },
        });
        if (order?.status === OrderStatus.PAID) {
          throw paymentError(
            409,
            "ORDER_ALREADY_PAID",
            "The order has already been paid.",
          );
        }
      }

      throw paymentError(
        500,
        "PAYMENT_INTERNAL_ERROR",
        "The payment could not be completed. Retry the same request with the same Idempotency-Key.",
        true,
      );
    }
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
    if (!header || process.env.NODE_ENV === "production") {
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

  private resolveReplay(
    payment: PaymentWithOwner,
    userId: string,
    fingerprint: string,
  ): PaymentExecutionResult {
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

    return this.toExecutionResult(payment);
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
}
