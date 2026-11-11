const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005/api';

export type PaymentMethod = 'WALLET' | 'CARD';
export type PaymentStatus = 'PROCESSING' | 'PAID' | 'FAILED' | 'UNKNOWN';
export type PaymentOrderStatus = 'PENDING' | 'PAID' | 'PAYMENT_FAILED';

// 1. Cập nhật Interface khớp chính xác DTO Backend đòi hỏi
export interface OrderItemPayload {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  /** UUID của ProductOption (size + topping) — backend validate bằng POSTGRES_UUID_REGEX. */
  selectedOptions?: string[];
}

export interface CreateOrderPayload {
  userId: string;
  items: OrderItemPayload[];
  voucherCode?: string | null;
  paymentMethod?: PaymentMethod;
  notes?: string;
}

export interface OrderResponse {
  id: string;
  orderNumber?: string;
  status: 'PENDING' | 'PAID' | 'CANCELLED';
  subtotal: number;
  discount: number;
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
}

export class CheckoutApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string,
    public retryable?: boolean,
  ) {
    super(message);
    this.name = 'CheckoutApiError';
  }
}

export async function createOrderApi(
  payload: CreateOrderPayload,
  token?: string | null,
): Promise<OrderResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // 2. Ép kiểu chuẩn trước khi truyền đi (xử lý triệt để unitPrice dạng number & UUID string)
  const formattedPayload = {
    userId: String(payload.userId || ''),
    items: (payload.items || []).map((item) => ({
      productId: String(item.productId),
      productName: String(item.productName || ''),
      quantity: Number(item.quantity || 1),
      unitPrice: Number(item.unitPrice || 0),
      ...(item.selectedOptions && item.selectedOptions.length > 0
        ? { selectedOptions: item.selectedOptions }
        : {}),
    })),
    voucherCode: payload.voucherCode || null,
    paymentMethod: payload.paymentMethod || 'WALLET',
    notes: payload.notes || '',
  };

  try {
    const res = await fetch(`${API_BASE_URL}/orders`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(formattedPayload),
    });

    const isJson = res.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await res.json() : null;

    if (!res.ok) {
      // Xử lý thông báo lỗi dạng mảng (nếu có từ class-validator NestJS)
      const errorMsg = Array.isArray(data?.message)
        ? data.message.join(', ')
        : data?.message;

      if (res.status === 409) {
        throw new CheckoutApiError(
          errorMsg || 'Một hoặc nhiều món trong giỏ hàng đã hết hoặc không đủ số lượng.',
          409,
          'INVENTORY_CONFLICT',
          false,
        );
      }
      if (res.status === 401) {
        throw new CheckoutApiError('Yêu cầu đăng nhập để tạo đơn hàng.', 401, 'UNAUTHORIZED');
      }
      if (res.status === 404 || res.status === 501) {
        throw new CheckoutApiError(
          'Hệ thống tiếp nhận đơn hàng (Orders API) đang trong quá trình bàn giao và nâng cấp.',
          res.status,
          'MODULE_PENDING_HANDOFF',
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
      'Không thể kết nối đến hệ thống tạo đơn. Vui lòng kiểm tra lại kết nối mạng.',
      0,
      'NETWORK_ERROR',
      true,
    );
  }
}

export async function processPaymentApi(
  orderId: string,
  method: PaymentMethod,
  idempotencyKey: string,
  token?: string | null,
  mockScenario?: string,
): Promise<PaymentResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'Idempotency-Key': idempotencyKey,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (mockScenario && process.env.NODE_ENV !== 'production') {
    headers['X-Mock-Payment-Scenario'] = mockScenario;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/payments`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ orderId, method }),
    });

    const isJson = res.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await res.json() : null;

    if (!res.ok) {
      const errorMsg = Array.isArray(data?.message) ? data.message.join(', ') : data?.message;
      if (res.status === 402) {
        throw new CheckoutApiError(
          errorMsg || 'Giao dịch thanh toán bị từ chối.',
          402,
          'PAYMENT_DECLINED',
          data?.retryable ?? true,
        );
      }
      if (res.status === 409) {
        throw new CheckoutApiError(
          errorMsg || 'Xung đột khóa giao dịch (Idempotency Key Conflict) hoặc đơn đã thanh toán.',
          409,
          'IDEMPOTENCY_CONFLICT',
          false,
        );
      }
      if (res.status === 404 || res.status === 501) {
        throw new CheckoutApiError(
          'Hệ thống cổng thanh toán (Payment Gateway API) đang trong quá trình bàn giao và nâng cấp.',
          res.status,
          'MODULE_PENDING_HANDOFF',
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
      'Lỗi kết nối khi gửi yêu cầu thanh toán. Trạng thái đang được giữ để đối soát.',
      0,
      'NETWORK_ERROR',
      false,
    );
  }
}