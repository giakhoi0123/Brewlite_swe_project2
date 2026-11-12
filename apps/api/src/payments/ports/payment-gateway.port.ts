import {
  PaymentGatewayCallback,
  PaymentGatewayRequest,
  PaymentGatewayResult,
} from "../domain/payment.types";

export const PAYMENT_GATEWAY = Symbol("PAYMENT_GATEWAY");

export interface PaymentGatewayPort {
  assertReady(): void;
  process(request: PaymentGatewayRequest): Promise<PaymentGatewayResult>;
  verifyCallback(params: Record<string, string>): PaymentGatewayCallback;
}
