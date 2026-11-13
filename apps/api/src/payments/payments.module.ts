import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AuthModule } from "../auth/auth.module";
import { OrdersModule } from "../orders/orders.module";
import { MockPaymentGatewayAdapter } from "./adapters/mock-payment-gateway.adapter";
import { VnpayPaymentGatewayAdapter } from "./adapters/vnpay-payment-gateway.adapter";
import { PaymentAuthGuard } from "./payment-auth.guard";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { PAYMENT_GATEWAY } from "./ports/payment-gateway.port";

@Module({
  imports: [AuthModule, ConfigModule, OrdersModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    PaymentAuthGuard,
    {
      provide: PAYMENT_GATEWAY,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        if (config.get<string>("NODE_ENV") === "test") {
          return new MockPaymentGatewayAdapter();
        }

        return new VnpayPaymentGatewayAdapter({
          tmnCode: config.get<string>("VNPAY_TMN_CODE"),
          hashSecret: config.get<string>("VNPAY_HASH_SECRET"),
          paymentUrl: config.get<string>("VNPAY_PAYMENT_URL"),
          returnUrl: config.get<string>("VNPAY_RETURN_URL"),
        });
      },
    },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
