import { createHmac, timingSafeEqual } from "crypto";
import {
  PaymentGatewayCallback,
  PaymentGatewayRequest,
  PaymentGatewayResult,
} from "../domain/payment.types";
import { PaymentGatewayPort } from "../ports/payment-gateway.port";

export interface VnpayGatewayConfig {
  tmnCode?: string;
  hashSecret?: string;
  paymentUrl?: string;
  returnUrl?: string;
}

const DEFAULT_PAYMENT_URL =
  "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
const PAYMENT_WINDOW_MS = 15 * 60 * 1000;

export class VnpayPaymentGatewayAdapter implements PaymentGatewayPort {
  constructor(
    private readonly config: VnpayGatewayConfig,
    private readonly now: () => Date = () => new Date(),
  ) {}

  assertReady(): void {
    this.requiredConfig();
  }

  async process(request: PaymentGatewayRequest): Promise<PaymentGatewayResult> {
    const { tmnCode, hashSecret, returnUrl } = this.requiredConfig();
    const createdAt = this.now();
    const expiresAt = new Date(createdAt.getTime() + PAYMENT_WINDOW_MS);
    const providerTransactionRef = request.paymentId.replace(/-/g, "");

    const params: Record<string, string> = {
      vnp_Version: "2.1.0",
      vnp_Command: "pay",
      vnp_TmnCode: tmnCode,
      vnp_Amount: this.toVnpayAmount(request.amount).toString(),
      vnp_CurrCode: "VND",
      vnp_TxnRef: providerTransactionRef,
      vnp_OrderInfo: `Thanh toan don hang ${request.orderId}`,
      vnp_OrderType: "other",
      vnp_Locale: "vn",
      vnp_ReturnUrl: returnUrl,
      vnp_IpAddr: this.normalizeIpAddress(request.ipAddress),
      vnp_CreateDate: this.formatVnpayDate(createdAt),
      vnp_ExpireDate: this.formatVnpayDate(expiresAt),
    };

    const signedQuery = this.toSortedQuery(params);
    const secureHash = this.sign(signedQuery, hashSecret);
    const paymentUrl = this.config.paymentUrl || DEFAULT_PAYMENT_URL;

    return {
      paymentStatus: "PROCESSING",
      resultCode: "PAYMENT_PROCESSING",
      retryable: false,
      processedAt: null,
      providerTransactionRef,
      providerTransactionDate: params.vnp_CreateDate,
      checkoutUrl: `${paymentUrl}?${signedQuery}&vnp_SecureHash=${secureHash}`,
      expiresAt,
    };
  }

  verifyCallback(params: Record<string, string>): PaymentGatewayCallback {
    const processedAt = this.now();
    const secureHash = params.vnp_SecureHash;
    const transactionRef = params.vnp_TxnRef;
    const amount = this.parseInteger(params.vnp_Amount);
    const responseCode = params.vnp_ResponseCode;
    const transactionStatus = params.vnp_TransactionStatus;

    if (!secureHash || !transactionRef) {
      return {
        valid: false,
        successful: false,
        finalFailure: false,
        processedAt,
      };
    }

    let expectedTmnCode: string;
    let hashSecret: string;
    try {
      const required = this.requiredConfig();
      expectedTmnCode = required.tmnCode;
      hashSecret = required.hashSecret;
    } catch {
      return {
        valid: false,
        successful: false,
        finalFailure: false,
        processedAt,
      };
    }

    const signedParams = Object.fromEntries(
      Object.entries(params).filter(
        ([key]) => key !== "vnp_SecureHash" && key !== "vnp_SecureHashType",
      ),
    );
    const expectedHash = this.sign(
      this.toSortedQuery(signedParams),
      hashSecret,
    );
    const valid =
      params.vnp_TmnCode === expectedTmnCode &&
      this.safeHashEquals(secureHash, expectedHash);

    const successful =
      valid && responseCode === "00" && transactionStatus === "00";
    const ambiguousStatuses = new Set(["01", "04", "05", "06", "07", "09"]);

    return {
      valid,
      transactionRef,
      gatewayTransactionNo: params.vnp_TransactionNo,
      amount,
      successful,
      finalFailure:
        valid &&
        !successful &&
        responseCode !== "07" &&
        !ambiguousStatuses.has(transactionStatus || ""),
      responseCode,
      transactionStatus,
      processedAt: this.parseVnpayDate(params.vnp_PayDate) ?? processedAt,
    };
  }

  private requiredConfig(): {
    tmnCode: string;
    hashSecret: string;
    returnUrl: string;
  } {
    const tmnCode = this.config.tmnCode?.trim();
    const hashSecret = this.config.hashSecret?.trim();
    const returnUrl = this.config.returnUrl?.trim();

    if (!tmnCode || !hashSecret || !returnUrl) {
      throw new Error(
        "VNPay Sandbox is not configured. Set VNPAY_TMN_CODE, VNPAY_HASH_SECRET and VNPAY_RETURN_URL.",
      );
    }

    return { tmnCode, hashSecret, returnUrl };
  }

  private toSortedQuery(params: Record<string, string>): string {
    const sorted = Object.entries(params)
      .filter(
        ([, value]) => value !== undefined && value !== null && value !== "",
      )
      .sort(([left], [right]) => left.localeCompare(right));
    const query = new URLSearchParams();
    for (const [key, value] of sorted) query.append(key, value);
    return query.toString();
  }

  private sign(data: string, secret: string): string {
    return createHmac("sha512", secret).update(data, "utf8").digest("hex");
  }

  private safeHashEquals(actual: string, expected: string): boolean {
    if (!/^[a-fA-F0-9]{128}$/.test(actual)) return false;
    const actualBuffer = Buffer.from(actual.toLowerCase(), "hex");
    const expectedBuffer = Buffer.from(expected.toLowerCase(), "hex");
    return (
      actualBuffer.length === expectedBuffer.length &&
      timingSafeEqual(actualBuffer, expectedBuffer)
    );
  }

  private toVnpayAmount(amount: number): number {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("VNPay amount must be a positive number.");
    }
    return Math.round(amount * 100);
  }

  private parseInteger(value?: string): number | undefined {
    if (!value || !/^\d+$/.test(value)) return undefined;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : undefined;
  }

  private normalizeIpAddress(value?: string): string {
    const first = value?.split(",")[0]?.trim();
    if (!first || first === "::1") return "127.0.0.1";
    return first.replace(/^::ffff:/, "");
  }

  private formatVnpayDate(date: Date): string {
    const vietnamTime = new Date(date.getTime() + 7 * 60 * 60 * 1000);
    const part = (value: number) => value.toString().padStart(2, "0");
    return [
      vietnamTime.getUTCFullYear().toString(),
      part(vietnamTime.getUTCMonth() + 1),
      part(vietnamTime.getUTCDate()),
      part(vietnamTime.getUTCHours()),
      part(vietnamTime.getUTCMinutes()),
      part(vietnamTime.getUTCSeconds()),
    ].join("");
  }

  private parseVnpayDate(value?: string): Date | null {
    if (!value || !/^\d{14}$/.test(value)) return null;
    const year = Number(value.slice(0, 4));
    const month = Number(value.slice(4, 6));
    const day = Number(value.slice(6, 8));
    const hour = Number(value.slice(8, 10));
    const minute = Number(value.slice(10, 12));
    const second = Number(value.slice(12, 14));
    const parsed = new Date(
      Date.UTC(year, month - 1, day, hour - 7, minute, second),
    );
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
}
