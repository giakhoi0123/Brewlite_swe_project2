import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrdersModule } from "../orders/orders.module";
import { MockPaymentGatewayAdapter } from "./adapters/mock-payment-gateway.adapter";
import { PaymentAuthGuard } from "./payment-auth.guard";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { PAYMENT_GATEWAY } from "./ports/payment-gateway.port";

@Module({
  imports: [AuthModule, OrdersModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    PaymentAuthGuard,
    {
      provide: PAYMENT_GATEWAY,
      useFactory: () => new MockPaymentGatewayAdapter(),
    },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
