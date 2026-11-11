import { IsIn, IsUUID } from "class-validator";
import { PAYMENT_METHODS, PaymentMethod } from "../domain/payment.types";

export class CreatePaymentDto {
  @IsUUID("4")
  orderId: string;

  @IsIn(PAYMENT_METHODS)
  method: PaymentMethod;
}
