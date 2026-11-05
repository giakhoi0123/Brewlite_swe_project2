import {
  MockPaymentScenario,
  PaymentGatewayRequest,
  PaymentGatewayResult,
} from "../domain/payment.types";
import { PaymentGatewayPort } from "../ports/payment-gateway.port";

type MockOutcome = Omit<PaymentGatewayResult, "processedAt"> & {
  completed: boolean;
};

const MOCK_OUTCOMES = {
  SUCCESS: {
    paymentStatus: "PAID",
    resultCode: "PAYMENT_PAID",
    retryable: false,
    completed: true,
  },
  FAILURE: {
    paymentStatus: "FAILED",
    resultCode: "PAYMENT_DECLINED",
    retryable: true,
    completed: true,
  },
  PROCESSING: {
    paymentStatus: "PROCESSING",
    resultCode: "PAYMENT_PROCESSING",
    retryable: false,
    completed: false,
  },
  TIMEOUT: {
    paymentStatus: "UNKNOWN",
    resultCode: "PAYMENT_STATUS_UNKNOWN",
    retryable: false,
    completed: false,
  },
  UNKNOWN: {
    paymentStatus: "UNKNOWN",
    resultCode: "PAYMENT_STATUS_UNKNOWN",
    retryable: false,
    completed: false,
  },
} satisfies Record<MockPaymentScenario, MockOutcome>;

export class MockPaymentGatewayAdapter implements PaymentGatewayPort {
  constructor(private readonly now: () => Date = () => new Date()) {}

  async process(request: PaymentGatewayRequest): Promise<PaymentGatewayResult> {
    const scenario = request.scenario ?? "SUCCESS";
    const { completed, ...outcome } = MOCK_OUTCOMES[scenario];

    return {
      ...outcome,
      processedAt: completed ? this.now() : null,
    };
  }
}
