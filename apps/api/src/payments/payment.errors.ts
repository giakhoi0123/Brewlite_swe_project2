import { HttpException } from "@nestjs/common";

export type PaymentErrorCode =
  | "INVALID_PAYMENT_REQUEST"
  | "UNSUPPORTED_PAYMENT_METHOD"
  | "AUTHENTICATION_REQUIRED"
  | "ORDER_ACCESS_DENIED"
  | "ORDER_NOT_FOUND"
  | "PAYMENT_NOT_FOUND"
  | "PAYMENT_GATEWAY_UNAVAILABLE"
  | "IDEMPOTENCY_KEY_CONFLICT"
  | "ORDER_ALREADY_PAID"
  | "ORDER_NOT_PAYABLE"
  | "PAYMENT_INTERNAL_ERROR";

export function paymentError(
  statusCode: number,
  code: PaymentErrorCode,
  message: string,
  retryable = false,
): HttpException {
  return new HttpException(
    { statusCode, code, message, retryable },
    statusCode,
  );
}
