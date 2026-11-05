import {
  PaymentGatewayRequest,
  PaymentGatewayResult,
} from "../domain/payment.types";

export const PAYMENT_GATEWAY = Symbol("PAYMENT_GATEWAY");

export interface PaymentGatewayPort {
  process(request: PaymentGatewayRequest): Promise<PaymentGatewayResult>;
}
