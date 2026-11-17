'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';

interface OrderItemOption {
  id: string;
  productOptionId: string;
  optionNameSnapshot: string;
  optionType: string;
  extraPriceSnapshot: number;
}

interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  productNameSnapshot?: string;
  quantity: number;
  unitPrice: number;
  subtotal?: number;
  notes?: string | null;
  options?: OrderItemOption[];
}

interface Order {
  id: string;
  orderNumber?: string;
  subtotal?: number;
  discount?: number;
  shippingFee?: number;
  total?: number;
  totalAmount: number;
  discountAmount: number;
  finalAmount: number;
  status: string;
  voucherCode?: string | null;
  pointsEarned?: number;
  pointsRedeemed?: number;
  notes?: string | null;
  createdAt: string;
  updatedAt?: string;
  promotion?: {
    code: string;
    description: string | null;
  } | null;
  items: OrderItem[];
}

const STATUS_CONFIG: Record<string, { label: string; badgeClass: string }> = {
  PENDING: {
    label: 'Chờ thanh toán',
    badgeClass: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  },
  PAID: {
    label: 'Đã thanh toán',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  PAYMENT_FAILED: {
    label: 'Thanh toán thất bại',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-200',
  },
  PREPARING: {
    label: 'Đang pha chế',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  READY: {
    label: 'Sẵn sàng nhận món',
    badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  },
  COMPLETED: {
    label: 'Hoàn thành',
    badgeClass: 'bg-green-100 text-green-800 border-green-200',
  },
  CANCELLED: {
    label: 'Đã hủy',
    badgeClass: 'bg-red-100 text-red-800 border-red-200',
  },
};

function getStatusInfo(status: string) {
  return (
    STATUS_CONFIG[status] ?? {
      label: status,
      badgeClass: 'bg-gray-100 text-gray-800 border-gray-200',
    }
  );
}

function resolveApiBaseUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005/api').replace(/\/+$/, '');
  return raw.endsWith('/api') ? raw : `${raw}/api`;
}

export default function OrderHistoryPage() {
  const { user, token, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const apiUrl = resolveApiBaseUrl();

  const getActiveToken = useCallback(() => {
    return (
      token ||
      (typeof window !== 'undefined' ? localStorage.getItem('brewlite_access_token') : null)
    );
  }, [token]);

  const fetchOrders = useCallback(() => {
    if (authLoading) return;

    if (!user?.id) {
      setLoading(false);
      return;
    }

    const activeToken = getActiveToken();
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (activeToken) {
      headers.Authorization = `Bearer ${activeToken}`;
    }

    setLoading(true);
    setError(null);

    fetch(`${apiUrl}/orders/me`, {
      headers,
      credentials: 'include',
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Lỗi (${res.status}): Không thể tải dữ liệu đơn hàng`);
        }
        return res.json();
      })
      .then((data) => {
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.data)
            ? data.data
            : [];
        setOrders(list);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
  }, [user, authLoading, apiUrl, getActiveToken]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedOrder(null);
        setDetailError(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleViewOrderDetail = async (orderSummary: Order) => {
    const activeToken = getActiveToken();
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (activeToken) {
      headers.Authorization = `Bearer ${activeToken}`;
    }

    setSelectedOrder(orderSummary);
    setDetailError(null);
    setDetailLoading(true);

    try {
      const res = await fetch(`${apiUrl}/orders/${orderSummary.id}`, {
        headers,
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error(`Lỗi (${res.status}): Không thể tải chi tiết đơn hàng`);
      }

      const detailData: Order = await res.json();
      setSelectedOrder(detailData);
    } catch (err: unknown) {
      console.error(err);
      setDetailError(
        err instanceof Error ? err.message : 'Không thể tải chi tiết đơn hàng',
      );
    } finally {
      setDetailLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="max-w-4xl mx-auto p-6 pt-28 text-center text-gray-600">
        Đang tải lịch sử đơn hàng...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto p-6 pt-28 text-center text-gray-600">
        Vui lòng{' '}
        <a href="/login" className="text-amber-800 font-bold underline">
          Đăng nhập
        </a>{' '}
        để xem lịch sử đơn hàng.
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6 pt-28 text-center text-red-500 font-medium">
        {error}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 pt-28 pb-16">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Lịch Sử Đơn Hàng</h1>
        <span className="text-sm text-gray-500">
          Tổng cộng: <strong>{orders.length}</strong> đơn hàng
        </span>
      </div>

      {orders.length === 0 ? (
        <div className="bg-white border rounded-xl p-8 text-center text-gray-500 shadow-sm">
          <p className="text-lg font-medium">Bạn chưa có đơn hàng nào.</p>
          <p className="text-sm text-gray-400 mt-1">
            Hãy đặt món tại trang Thực đơn để trải nghiệm dịch vụ của BrewLite nhé!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const statusInfo = getStatusInfo(order.status);
            const displayCode =
              order.orderNumber || `#${order.id.slice(0, 8).toUpperCase()}`;

            return (
              <div
                key={order.id}
                className="border rounded-xl p-5 shadow-sm bg-white hover:border-amber-300 transition-colors"
              >
                <div className="flex flex-wrap justify-between items-start gap-2 mb-3 pb-3 border-b">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900">
                        Mã đơn: {displayCode}
                      </span>
                      {(order.pointsEarned ?? 0) > 0 && (
                        <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                          +{order.pointsEarned} điểm
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      Đặt lúc: {new Date(order.createdAt).toLocaleString('vi-VN')}
                    </div>
                  </div>

                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold border ${statusInfo.badgeClass}`}
                  >
                    {statusInfo.label}
                  </span>
                </div>

                <div className="divide-y my-2">
                  {order.items?.map((item) => {
                    const lineTotal =
                      item.subtotal ?? item.unitPrice * item.quantity;
                    return (
                      <div
                        key={item.id}
                        className="py-2.5 flex justify-between items-start gap-4 text-sm"
                      >
                        <div>
                          <div className="font-medium text-gray-800">
                            {item.productNameSnapshot || item.productName}{' '}
                            <span className="text-amber-800 font-semibold">
                              x{item.quantity}
                            </span>
                          </div>
                          {item.options && item.options.length > 0 && (
                            <div className="text-xs text-gray-500 mt-0.5">
                              {item.options
                                .map((opt) =>
                                  opt.extraPriceSnapshot > 0
                                    ? `${opt.optionNameSnapshot} (+${opt.extraPriceSnapshot.toLocaleString('vi-VN')}đ)`
                                    : opt.optionNameSnapshot,
                                )
                                .join(' • ')}
                            </div>
                          )}
                        </div>
                        <span className="font-medium text-gray-900 whitespace-nowrap">
                          {lineTotal.toLocaleString('vi-VN')} VNĐ
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="border-t pt-3 mt-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm">
                    <span className="text-gray-600">Tổng thanh toán: </span>
                    <span className="font-bold text-amber-900 text-base">
                      {(order.finalAmount ?? order.total ?? 0).toLocaleString(
                        'vi-VN',
                      )}{' '}
                      VNĐ
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleViewOrderDetail(order)}
                    className="px-4 py-2 rounded-lg text-sm font-semibold bg-amber-800 text-white hover:bg-amber-900 transition-colors cursor-pointer"
                  >
                    Xem chi tiết
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          onClick={() => {
            setSelectedOrder(null);
            setDetailError(null);
          }}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white px-6 py-4 border-b flex items-center justify-between z-10">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Chi Tiết Đơn Hàng{' '}
                  {selectedOrder.orderNumber ||
                    `#${selectedOrder.id.slice(0, 8).toUpperCase()}`}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  ID: {selectedOrder.id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedOrder(null);
                  setDetailError(null);
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-800 font-bold cursor-pointer"
                aria-label="Đóng"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-5">
              {detailLoading && (
                <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Đang đồng bộ dữ liệu chi tiết từ máy chủ...
                </div>
              )}

              {detailError && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {detailError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-gray-50 p-4 rounded-xl border text-sm">
                <div>
                  <span className="text-gray-500 block text-xs">Trạng thái</span>
                  <span
                    className={`inline-block mt-1 px-3 py-0.5 rounded-full text-xs font-bold border ${
                      getStatusInfo(selectedOrder.status).badgeClass
                    }`}
                  >
                    {getStatusInfo(selectedOrder.status).label}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block text-xs">
                    Thời gian đặt hàng
                  </span>
                  <span className="font-medium text-gray-800 mt-1 block">
                    {new Date(selectedOrder.createdAt).toLocaleString('vi-VN')}
                  </span>
                </div>
                {selectedOrder.updatedAt && (
                  <div>
                    <span className="text-gray-500 block text-xs">
                      Cập nhật lần cuối
                    </span>
                    <span className="font-medium text-gray-800 mt-0.5 block">
                      {new Date(selectedOrder.updatedAt).toLocaleString('vi-VN')}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-gray-500 block text-xs">
                    Điểm thưởng từ đơn
                  </span>
                  <span className="font-semibold text-emerald-700 mt-0.5 block">
                    +{selectedOrder.pointsEarned ?? 0} điểm
                  </span>
                </div>
              </div>

              {selectedOrder.notes && (
                <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 text-sm">
                  <span className="font-semibold text-amber-900">
                    Ghi chú đơn hàng:{' '}
                  </span>
                  <span className="text-gray-700">{selectedOrder.notes}</span>
                </div>
              )}

              <div>
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-3">
                  Danh sách món đã đặt ({selectedOrder.items?.length ?? 0})
                </h3>
                <div className="border rounded-xl divide-y">
                  {selectedOrder.items?.map((item) => {
                    const lineTotal =
                      item.subtotal ?? item.unitPrice * item.quantity;
                    return (
                      <div key={item.id} className="p-4 text-sm">
                        <div className="flex justify-between items-start gap-4">
                          <div>
                            <div className="font-bold text-gray-900">
                              {item.productNameSnapshot || item.productName}{' '}
                              <span className="text-amber-800">
                                x{item.quantity}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              Đơn giá: {item.unitPrice.toLocaleString('vi-VN')}{' '}
                              VNĐ
                            </div>
                          </div>
                          <div className="font-bold text-gray-900 whitespace-nowrap">
                            {lineTotal.toLocaleString('vi-VN')} VNĐ
                          </div>
                        </div>

                        {item.options && item.options.length > 0 && (
                          <ul className="mt-2 pl-3 border-l-2 border-amber-200 space-y-1 text-xs text-gray-600">
                            {item.options.map((opt) => (
                              <li
                                key={opt.id}
                                className="flex justify-between items-center"
                              >
                                <span>
                                  • {opt.optionNameSnapshot} ({opt.optionType})
                                </span>
                                {opt.extraPriceSnapshot > 0 && (
                                  <span className="text-gray-500">
                                    +{opt.extraPriceSnapshot.toLocaleString('vi-VN')}đ
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}

                        {item.notes && (
                          <div className="mt-2 text-xs italic text-gray-500">
                            Ghi chú món: &ldquo;{item.notes}&rdquo;
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-gray-50 border rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Tạm tính:</span>
                  <span>
                    {(
                      selectedOrder.subtotal ??
                      selectedOrder.totalAmount ??
                      0
                    ).toLocaleString('vi-VN')}{' '}
                    VNĐ
                  </span>
                </div>

                {selectedOrder.voucherCode && (
                  <div className="flex justify-between text-emerald-700">
                    <span>
                      Mã khuyến mãi ({selectedOrder.voucherCode}
                      {selectedOrder.promotion?.description
                        ? ` - ${selectedOrder.promotion.description}`
                        : ''}
                      ):
                    </span>
                    <span>Đã áp dụng</span>
                  </div>
                )}

                {(selectedOrder.pointsRedeemed ?? 0) > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>
                      Đổi điểm tích lũy ({selectedOrder.pointsRedeemed} điểm):
                    </span>
                    <span>
                      -
                      {(
                        (selectedOrder.pointsRedeemed ?? 0) * 1000
                      ).toLocaleString('vi-VN')}{' '}
                      VNĐ
                    </span>
                  </div>
                )}

                {(selectedOrder.discount ?? selectedOrder.discountAmount ?? 0) >
                  0 && (
                  <div className="flex justify-between text-emerald-700 font-medium">
                    <span>Tổng giảm giá:</span>
                    <span>
                      -
                      {(
                        selectedOrder.discount ??
                        selectedOrder.discountAmount ??
                        0
                      ).toLocaleString('vi-VN')}{' '}
                      VNĐ
                    </span>
                  </div>
                )}

                {/* Chỉ hiển thị cho đơn cũ còn phí giao hàng; đơn mới bán trực tiếp luôn = 0 */}
                {!!selectedOrder.shippingFee && selectedOrder.shippingFee > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Phí giao hàng:</span>
                    <span>{`${selectedOrder.shippingFee.toLocaleString('vi-VN')} VNĐ`}</span>
                  </div>
                )}

                <div className="border-t pt-2.5 mt-2.5 flex justify-between items-center text-base font-bold text-gray-900">
                  <span>Tổng thanh toán:</span>
                  <span className="text-amber-900 text-lg">
                    {(
                      selectedOrder.finalAmount ??
                      selectedOrder.total ??
                      0
                    ).toLocaleString('vi-VN')}{' '}
                    VNĐ
                  </span>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setSelectedOrder(null);
                  setDetailError(null);
                }}
                className="px-5 py-2 rounded-lg text-sm font-semibold bg-gray-800 text-white hover:bg-gray-900 transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}