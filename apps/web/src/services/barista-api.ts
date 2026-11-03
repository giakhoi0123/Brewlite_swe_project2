const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005/api';

export type BaristaOrderStatus = 'PAID' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED';

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

    return Array.isArray(data) ? data : data?.orders || [];
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

  try {
    const res = await fetch(`${API_BASE_URL}/barista/orders/${orderId}/status`, {
      method: 'PATCH',
      headers,
      credentials: 'include',
      body: JSON.stringify({ status: nextStatus }),
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

    return data as BaristaOrder;
  } catch (err: any) {
    if (err instanceof BaristaApiError) throw err;
    throw new BaristaApiError(
      'Không thể cập nhật trạng thái đơn. Vui lòng kiểm tra lại kết nối.',
      0,
      'NETWORK_ERROR',
    );
  }
}
