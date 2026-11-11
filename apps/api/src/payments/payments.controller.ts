import {
  Body,
  Controller,
  Headers,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { PaymentAuthGuard } from "./payment-auth.guard";
import { PaymentsService } from "./payments.service";

interface AuthenticatedPaymentRequest extends Request {
  user: { userId: string; id: string };
}

@Controller("payments")
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @UseGuards(PaymentAuthGuard)
  async createPayment(
    @Req() request: AuthenticatedPaymentRequest,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Headers("x-mock-payment-scenario") mockScenario: string | undefined,
    @Body() input: CreatePaymentDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.paymentsService.processPayment(
      request.user.userId || request.user.id,
      idempotencyKey,
      input,
      mockScenario,
    );

    response.status(result.httpStatus);
    response.setHeader("Cache-Control", "no-store");
    return result.body;
  }
}
