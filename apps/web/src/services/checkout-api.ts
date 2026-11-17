const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3005/api";

export type PaymentMethod = "VNPAY";
export type PaymentStatus =
  | "PROCESSING"
  | "PAID"
  | "FAILED"
  | "UNKNOWN";
export type PaymentOrderStatus =
  | "PENDING"
  | "PAID"
  | "PAYMENT_FAILED";

// 1. Cập nhật Interface khớp chính xác DTO Backend đòi hỏi
export interface OrderItemPayload {
  productId: string;
  quantity: number;
  selectedOptions: string[];
  notes?: string;
}

export interface CreateOrderPayload {
  items: OrderItemPayload[];
  voucherCode?: string | null;
  notes?: string;
  pointsToRedeem?: number;
}

export interface OrderResponse {
  id: string;
  orderNumber?: string;
  status: "PENDING" | "PAID" | "CANCELLED";
  subtotal: number;
  discount: number;
  shippingFee?: number;
  total: number;
  createdAt: string;
}

export interface PaymentPayload {
  orderId: string;
  method: PaymentMethod;
}

export interface PaymentResponse {
  paymentId: string;
  orderId: string;
  method: PaymentMethod;
  amount: number;
  paymentStatus: PaymentStatus;
  orderStatus: PaymentOrderStatus;
  resultCode: string;
  retryable: boolean;
  processedAt: string | null;
  checkoutUrl: string | null;
  expiresAt: string | null;
}

function isPersistedPaymentOutcome(
  res: Response,
  data: unknown,
): data is PaymentResponse {
  return (
    res.status === 402 &&
    Boolean(data && typeof (data as PaymentResponse).paymentStatus === "string")
  );
}

export class CheckoutApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string,
    public retryable?: boolean,
  ) {
    super(message);
    this.name = "CheckoutApiError";
  }
}

export async function createOrderApi(
  payload: CreateOrderPayload,
  token?: string | null,
): Promise<OrderResponse> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Chỉ gửi dữ liệu lựa chọn của khách. Danh tính lấy từ JWT và toàn bộ giá
  // được backend đọc/tính lại từ PostgreSQL.
  const formattedPayload = {
    items: (payload.items || []).map((item) => ({
      productId: String(item.productId),
      quantity: Number(item.quantity || 1),
      selectedOptions: (item.selectedOptions || []).map(String),
      ...(item.notes?.trim() ? { notes: item.notes.trim() } : {}),
    })),
    ...(payload.voucherCode?.trim()
      ? { voucherCode: payload.voucherCode.trim() }
      : {}),
    ...(payload.notes?.trim() ? { notes: payload.notes.trim() } : {}),
    ...(payload.pointsToRedeem !== undefined
      ? { pointsToRedeem: Number(payload.pointsToRedeem) }
      : {}),
  };

  try {
    const res = await fetch(`${API_BASE_URL}/orders`, {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify(formattedPayload),
    });

    const isJson = res.headers
      .get("content-type")
      ?.includes("application/json");
    const data = isJson ? await res.json() : null;

    if (!res.ok) {
      // Xử lý thông báo lỗi dạng mảng (nếu có từ class-validator NestJS)
      const errorMsg = Array.isArray(data?.message)
        ? data.message.join(", ")
        : data?.message;

      if (res.status === 409) {
        throw new CheckoutApiError(
          errorMsg ||
            "Một hoặc nhiều món trong giỏ hàng đã hết hoặc không đủ số lượng.",
          409,
          "INVENTORY_CONFLICT",
          false,
        );
      }
      if (res.status === 401) {
        throw new CheckoutApiError(
          "Yêu cầu đăng nhập để tạo đơn hàng.",
          401,
          "UNAUTHORIZED",
        );
      }
      if (res.status === 404 || res.status === 501) {
        throw new CheckoutApiError(
          "Hệ thống tiếp nhận đơn hàng (Orders API) đang trong quá trình bàn giao và nâng cấp.",
          res.status,
          "MODULE_PENDING_HANDOFF",
          true,
        );
      }
      throw new CheckoutApiError(
        errorMsg || `Lỗi máy chủ khi tạo đơn (HTTP ${res.status})`,
        res.status,
      );
    }

    return data as OrderResponse;
  } catch (err: any) {
    if (err instanceof CheckoutApiError) throw err;
    throw new CheckoutApiError(
      "Không thể kết nối đến hệ thống tạo đơn. Vui lòng kiểm tra lại kết nối mạng.",
      0,
      "NETWORK_ERROR",
      true,
    );
  }
}

export async function processPaymentApi(
  orderId: string,
  method: PaymentMethod,
  idempotencyKey: string,
  token?: string | null,
): Promise<PaymentResponse> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "Idempotency-Key": idempotencyKey,
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  try {
    const res = await fetch(`${API_BASE_URL}/payments`, {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify({ orderId, method }),
    });

    const isJson = res.headers
      .get("content-type")
      ?.includes("application/json");
    const data = isJson ? await res.json() : null;

    // A determinate decline is an accepted and persisted Payment outcome, not
    // a transport/API failure. Return its body so Checkout can retry the same
    // Order with a new Idempotency-Key.
    if (isPersistedPaymentOutcome(res, data)) {
      return data;
    }

    if (!res.ok) {
      const errorMsg = Array.isArray(data?.message)
        ? data.message.join(", ")
        : data?.message;
      if (res.status === 409) {
        throw new CheckoutApiError(
          errorMsg ||
            "Xung đột khóa giao dịch (Idempotency Key Conflict) hoặc đơn đã thanh toán.",
          409,
          "IDEMPOTENCY_CONFLICT",
          false,
        );
      }
      if (res.status === 404 || res.status === 501) {
        throw new CheckoutApiError(
          "Hệ thống cổng thanh toán (Payment Gateway API) đang trong quá trình bàn giao và nâng cấp.",
          res.status,
          "MODULE_PENDING_HANDOFF",
          true,
        );
      }
      throw new CheckoutApiError(
        errorMsg || `Thanh toán thất bại (HTTP ${res.status})`,
        res.status,
      );
    }

    return data as PaymentResponse;
  } catch (err: any) {
    if (err instanceof CheckoutApiError) throw err;
    throw new CheckoutApiError(
      "Lỗi kết nối khi gửi yêu cầu thanh toán. Trạng thái đang được giữ để đối soát.",
      0,
      "NETWORK_ERROR",
      false,
    );
  }
}

export async function getPaymentStatusApi(
  paymentId: string,
  token?: string | null,
): Promise<PaymentResponse> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const res = await fetch(
      `${API_BASE_URL}/payments/${encodeURIComponent(paymentId)}`,
      {
        method: "GET",
        headers,
        credentials: "include",
        cache: "no-store",
      },
    );
    const isJson = res.headers
      .get("content-type")
      ?.includes("application/json");
    const data = isJson ? await res.json() : null;
    if (isPersistedPaymentOutcome(res, data)) {
      return data;
    }
    if (!res.ok) {
      throw new CheckoutApiError(
        data?.message ||
          `Không thể đọc trạng thái thanh toán (HTTP ${res.status})`,
        res.status,
        data?.code,
        data?.retryable,
      );
    }
    return data as PaymentResponse;
  } catch (err: any) {
    if (err instanceof CheckoutApiError) throw err;
    throw new CheckoutApiError(
      "Không thể kết nối để kiểm tra trạng thái thanh toán VNPay.",
      0,
      "NETWORK_ERROR",
      true,
    );
  }
}
