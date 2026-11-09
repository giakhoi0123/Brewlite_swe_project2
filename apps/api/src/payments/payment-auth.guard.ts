import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { paymentError } from "./payment.errors";

@Injectable()
export class PaymentAuthGuard extends AuthGuard("jwt") {
  handleRequest<TUser = unknown>(error: unknown, user: TUser | null): TUser {
    if (error || !user) {
      throw paymentError(
        401,
        "AUTHENTICATION_REQUIRED",
        "A valid Bearer JWT is required.",
      );
    }

    return user;
  }
}
