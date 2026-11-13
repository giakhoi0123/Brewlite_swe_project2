import {
  MOCK_PAYMENT_SCENARIOS,
  MockPaymentScenario,
  PAYMENT_METHODS,
  PaymentGatewayRequest,
  PaymentGatewayResult,
} from "../domain/payment.types";
import { MockPaymentGatewayAdapter } from "./mock-payment-gateway.adapter";

describe("MockPaymentGatewayAdapter", () => {
  const fixedTime = new Date("2026-11-05T08:00:00.000Z");
  const outcomes: Record<MockPaymentScenario, PaymentGatewayResult> = {
    SUCCESS: {
      paymentStatus: "PAID",
      resultCode: "PAYMENT_PAID",
      retryable: false,
      processedAt: fixedTime,
    },
    FAILURE: {
      paymentStatus: "FAILED",
      resultCode: "PAYMENT_DECLINED",
      retryable: true,
      processedAt: fixedTime,
    },
    PROCESSING: {
      paymentStatus: "PROCESSING",
      resultCode: "PAYMENT_PROCESSING",
      retryable: false,
      processedAt: null,
    },
    TIMEOUT: {
      paymentStatus: "UNKNOWN",
      resultCode: "PAYMENT_STATUS_UNKNOWN",
      retryable: false,
      processedAt: null,
    },
    UNKNOWN: {
      paymentStatus: "UNKNOWN",
      resultCode: "PAYMENT_STATUS_UNKNOWN",
      retryable: false,
      processedAt: null,
    },
  };

  let adapter: MockPaymentGatewayAdapter;

  beforeEach(() => {
    adapter = new MockPaymentGatewayAdapter(() => fixedTime);
  });

  describe.each(PAYMENT_METHODS)("%s payments", (method) => {
    it.each(MOCK_PAYMENT_SCENARIOS)(
      "maps %s to the contract outcome",
      async (scenario) => {
        const request: PaymentGatewayRequest = {
          paymentId: "30000000-0000-4000-8000-000000000001",
          orderId: "10000000-0000-4000-8000-000000000001",
          idempotencyKey: "20000000-0000-4000-8000-000000000001",
          method,
          amount: 58000,
          scenario,
        };

        await expect(adapter.process(request)).resolves.toEqual(
          outcomes[scenario],
        );
      },
    );
  });

  it("defaults to SUCCESS when the caller omits the mock scenario", async () => {
    const request: PaymentGatewayRequest = {
      paymentId: "30000000-0000-4000-8000-000000000001",
      orderId: "10000000-0000-4000-8000-000000000001",
      idempotencyKey: "20000000-0000-4000-8000-000000000001",
      method: "VNPAY",
      amount: 58000,
    };

    await expect(adapter.process(request)).resolves.toEqual(outcomes.SUCCESS);
  });
});
