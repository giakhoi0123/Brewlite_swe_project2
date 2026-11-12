import { createHmac } from "crypto";
import { PaymentGatewayRequest } from "../domain/payment.types";
import { VnpayPaymentGatewayAdapter } from "./vnpay-payment-gateway.adapter";

const SECRET = "sandbox-secret";
const FIXED_TIME = new Date("2026-11-12T03:00:00.000Z");

function sortedQuery(params: Record<string, string>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params).sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    query.append(key, value);
  }
  return query.toString();
}

function sign(params: Record<string, string>): string {
  return createHmac("sha512", SECRET)
    .update(sortedQuery(params), "utf8")
    .digest("hex");
}

describe("VnpayPaymentGatewayAdapter", () => {
  const adapter = new VnpayPaymentGatewayAdapter(
    {
      tmnCode: "BREWLITE",
      hashSecret: SECRET,
      paymentUrl: "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
      returnUrl: "https://api.example.test/api/payments/vnpay-return",
    },
    () => FIXED_TIME,
  );

  it("creates a signed VNPay 2.1.0 Sandbox checkout URL", async () => {
    const request: PaymentGatewayRequest = {
      paymentId: "30000000-0000-4000-8000-000000000001",
      orderId: "10000000-0000-4000-8000-000000000001",
      idempotencyKey: "20000000-0000-4000-8000-000000000001",
      method: "VNPAY",
      amount: 58000,
      ipAddress: "::ffff:127.0.0.1",
    };

    const result = await adapter.process(request);
    const url = new URL(result.checkoutUrl!);
    const params = Object.fromEntries(url.searchParams.entries());
    const secureHash = params.vnp_SecureHash;
    delete params.vnp_SecureHash;

    expect(result).toMatchObject({
      paymentStatus: "PROCESSING",
      providerTransactionRef: "30000000000040008000000000000001",
      providerTransactionDate: "20261112100000",
      processedAt: null,
    });
    expect(params).toMatchObject({
      vnp_Version: "2.1.0",
      vnp_Command: "pay",
      vnp_TmnCode: "BREWLITE",
      vnp_Amount: "5800000",
      vnp_CreateDate: "20261112100000",
      vnp_ExpireDate: "20261112101500",
      vnp_IpAddr: "127.0.0.1",
    });
    expect(secureHash).toBe(sign(params));
  });

  it("verifies a successful signed VNPay callback", () => {
    const params = {
      vnp_Amount: "5800000",
      vnp_BankCode: "NCB",
      vnp_PayDate: "20261112100500",
      vnp_ResponseCode: "00",
      vnp_TmnCode: "BREWLITE",
      vnp_TransactionNo: "14226112",
      vnp_TransactionStatus: "00",
      vnp_TxnRef: "30000000000040008000000000000001",
    };

    expect(
      adapter.verifyCallback({ ...params, vnp_SecureHash: sign(params) }),
    ).toMatchObject({
      valid: true,
      successful: true,
      amount: 5800000,
      gatewayTransactionNo: "14226112",
      processedAt: new Date("2026-11-12T03:05:00.000Z"),
    });
  });

  it("rejects callback data changed after signing", () => {
    const params = {
      vnp_Amount: "5800000",
      vnp_ResponseCode: "00",
      vnp_TmnCode: "BREWLITE",
      vnp_TransactionStatus: "00",
      vnp_TxnRef: "30000000000040008000000000000001",
    };
    const secureHash = sign(params);

    expect(
      adapter.verifyCallback({
        ...params,
        vnp_Amount: "9900000",
        vnp_SecureHash: secureHash,
      }),
    ).toMatchObject({ valid: false, successful: false });
  });

  it("fails readiness when Sandbox credentials are missing", () => {
    const unconfigured = new VnpayPaymentGatewayAdapter({});
    expect(() => unconfigured.assertReady()).toThrow(
      "VNPay Sandbox is not configured",
    );
  });
});
