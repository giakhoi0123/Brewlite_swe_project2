const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005/api';

export type BaristaOrderStatus = 'PAID' | 'PREPARING' | 'READY' | 'COMPLETED';

export interface BaristaOrderItem {
  id?: string;
  productName: string;
  quantity: number;
  size?: string;
  toppings?: string[];
  notes?: string;
}

export interface BaristaOrder {
  id: string;
  orderNumber?: string;
  status: BaristaOrderStatus;
  total: number;
  createdAt: string;
  paidAt?: string | null;
  customerName?: string;
  items: BaristaOrderItem[];
}

export class BaristaApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string,
  ) {
    super(message);
    this.name = 'BaristaApiError';
  }
}

export async function fetchBaristaOrdersApi(token?: string | null): Promise<BaristaOrder[]> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/barista/orders`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });

    const isJson = res.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await res.json() : null;

    if (!res.ok) {
      if (res.status === 403) {
        throw new BaristaApiError('Bạn không có quyền truy cập vào kênh Barista.', 403, 'FORBIDDEN');
      }
      if (res.status === 401) {
        throw new BaristaApiError('Yêu cầu đăng nhập tài khoản Barista.', 401, 'UNAUTHORIZED');
      }
      if (res.status === 404 || res.status === 501) {
        throw new BaristaApiError(
          'Barista API đang trong quá trình bàn giao từ thành viên phụ trách nghiệp vụ Barista (Điệp).',
          res.status,
          'MODULE_PENDING_HANDOFF',
        );
      }
      throw new BaristaApiError(
        data?.message || `Lỗi khi tải danh sách đơn (HTTP ${res.status})`,
        res.status,
      );
    }

    const rawList = Array.isArray(data) ? data : data?.data || data?.orders || [];
    return rawList.map((o: any) => ({
      id: o.id || o.orderId,
      orderNumber: o.orderNumber,
      status: o.status,
      total: Number(o.total || 0),
      createdAt: o.createdAt,
      paidAt: o.paidAt ?? null,
      customerName: o.customer?.fullName || o.customerName || 'Khách hàng',
      items: (o.items || []).map((it: any) => ({
        id: it.id,
        productName: it.productName,
        quantity: it.quantity,
        size:
          it.size ||
          it.options?.find((opt: any) => opt.type === 'SIZE')?.name ||
          (Array.isArray(it.optionsSnapshot)
            ? it.optionsSnapshot.find((opt: any) => opt.type === 'SIZE')?.name
            : undefined),
        toppings:
          it.toppings ||
          it.options?.filter((opt: any) => opt.type === 'TOPPING')?.map((opt: any) => opt.name) ||
          (Array.isArray(it.optionsSnapshot)
            ? it.optionsSnapshot.filter((opt: any) => opt.type === 'TOPPING')?.map((opt: any) => opt.name)
            : []),
        notes: it.notes,
      })),
    }));
  } catch (err: any) {
    if (err instanceof BaristaApiError) throw err;
    throw new BaristaApiError(
      'Không thể kết nối đến máy chủ Barista.',
      0,
      'NETWORK_ERROR',
    );
  }
}

export async function transitionOrderStatusApi(
  orderId: string,
  nextStatus: 'PREPARING' | 'READY' | 'COMPLETED',
  token?: string | null,
): Promise<BaristaOrder> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Khớp chính xác với Backend BaristaController endpoints:
  // - PREPARING: POST /api/barista/orders/:id/accept
  // - READY:     POST /api/barista/orders/:id/ready
  // - COMPLETED: POST /api/barista/orders/:id/complete
  let action = 'accept';
  if (nextStatus === 'PREPARING') action = 'accept';
  else if (nextStatus === 'READY') action = 'ready';
  else if (nextStatus === 'COMPLETED') action = 'complete';

  try {
    const res = await fetch(`${API_BASE_URL}/barista/orders/${orderId}/${action}`, {
      method: 'POST',
      headers,
      credentials: 'include',
    });

    const isJson = res.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await res.json() : null;

    if (!res.ok) {
      if (res.status === 404 || res.status === 501) {
        throw new BaristaApiError(
          'Chức năng cập nhật trạng thái Barista đang chờ bàn giao backend.',
          res.status,
          'MODULE_PENDING_HANDOFF',
        );
      }
      throw new BaristaApiError(
        data?.message || `Lỗi cập nhật trạng thái đơn (HTTP ${res.status})`,
        res.status,
      );
    }

    return {
      id: data.id || data.orderId || orderId,
      orderNumber: data.orderNumber,
      status: data.status || nextStatus,
      total: Number(data.total || 0),
      createdAt: data.createdAt,
      paidAt: data.paidAt ?? null,
      customerName: data.customer?.fullName || 'Khách hàng',
      items: (data.items || []).map((it: any) => ({
        id: it.id,
        productName: it.productName,
        quantity: it.quantity,
        size: it.options?.find((opt: any) => opt.type === 'SIZE')?.name,
        toppings: it.options?.filter((opt: any) => opt.type === 'TOPPING')?.map((opt: any) => opt.name) || [],
        notes: it.notes,
      })),
    };
  } catch (err: any) {
    if (err instanceof BaristaApiError) throw err;
    throw new BaristaApiError(
      'Không thể cập nhật trạng thái đơn. Vui lòng kiểm tra lại kết nối.',
      0,
      'NETWORK_ERROR',
    );
  }
}
