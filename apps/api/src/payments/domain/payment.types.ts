export const PAYMENT_METHODS = ["WALLET", "CARD"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = [
  "PROCESSING",
  "PAID",
  "FAILED",
  "UNKNOWN",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_RESULT_CODES = [
  "PAYMENT_PAID",
  "PAYMENT_DECLINED",
  "PAYMENT_PROCESSING",
  "PAYMENT_STATUS_UNKNOWN",
] as const;
export type PaymentResultCode = (typeof PAYMENT_RESULT_CODES)[number];

export const MOCK_PAYMENT_SCENARIOS = [
  "SUCCESS",
  "FAILURE",
  "PROCESSING",
  "TIMEOUT",
  "UNKNOWN",
] as const;
export type MockPaymentScenario = (typeof MOCK_PAYMENT_SCENARIOS)[number];

export interface PaymentGatewayRequest {
  orderId: string;
  idempotencyKey: string;
  method: PaymentMethod;
  amount: number;
  scenario?: MockPaymentScenario;
}

export interface PaymentGatewayResult {
  paymentStatus: PaymentStatus;
  resultCode: PaymentResultCode;
  retryable: boolean;
  processedAt: Date | null;
}
