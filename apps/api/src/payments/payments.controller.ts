import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
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
      this.clientIp(request),
    );

    response.status(result.httpStatus);
    response.setHeader("Cache-Control", "no-store");
    return result.body;
  }

  @Get(["vnpay-ipn", "vnpay/ipn"])
  async handleVnpayIpn(@Query() query: Record<string, unknown>) {
    return await this.paymentsService.handleVnpayIpn(
      this.stringQueryParams(query),
    );
  }

  @Get("vnpay-return")
  async handleVnpayReturn(
    @Query() query: Record<string, unknown>,
    @Res() response: Response,
  ) {
    const redirectUrl = await this.paymentsService.resolveVnpayReturn(
      this.stringQueryParams(query),
    );
    return response.redirect(302, redirectUrl);
  }

  @Get(":paymentId")
  @UseGuards(PaymentAuthGuard)
  async getPaymentStatus(
    @Req() request: AuthenticatedPaymentRequest,
    @Param("paymentId") paymentId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.paymentsService.getPaymentStatus(
      request.user.userId || request.user.id,
      paymentId,
    );
    response.status(result.httpStatus);
    response.setHeader("Cache-Control", "no-store");
    return result.body;
  }

  private clientIp(request: Request): string | undefined {
    const forwarded = request.headers["x-forwarded-for"];
    if (typeof forwarded === "string") return forwarded;
    if (Array.isArray(forwarded)) return forwarded[0];
    return request.ip || request.socket.remoteAddress;
  }

  private stringQueryParams(
    query: Record<string, unknown>,
  ): Record<string, string> {
    return Object.fromEntries(
      Object.entries(query).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    );
  }
}
