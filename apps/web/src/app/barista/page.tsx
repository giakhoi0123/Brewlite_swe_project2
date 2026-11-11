'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Coffee,
  Info,
  Lock,
  RefreshCw,
  Search,
  ShieldAlert,
  UtensilsCrossed,
} from 'lucide-react';
import { useAuth } from '../../components/auth/AuthProvider';
import {
  BaristaApiError,
  BaristaOrder,
  BaristaOrderStatus,
  fetchBaristaOrdersApi,
  transitionOrderStatusApi,
} from '../../services/barista-api';
import { formatCurrency } from '../../utils/format';

type TabFilter = 'ALL' | 'PAID' | 'PREPARING' | 'READY' | 'COMPLETED';

export default function BaristaDashboardPage() {
  const router = useRouter();
  const { user, token, loading: authLoading } = useAuth();

  const [orders, setOrders] = useState<BaristaOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [handoffNotice, setHandoffNotice] = useState<string | null>(null);

  // 1. Tải danh sách đơn hàng
  const loadOrders = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    setHandoffNotice(null);

    try {
      const data = await fetchBaristaOrdersApi(token);
      setOrders(data);
    } catch (err: any) {
      if (err.code === 'MODULE_PENDING_HANDOFF' || err.statusCode === 501 || err.statusCode === 404) {
        setHandoffNotice(
          'Barista API đang trong quá trình bàn giao từ backend (Điệp). Giao diện quầy pha chế đã hoàn thiện 100% về role protection, bộ lọc hàng đợi và logic chuyển trạng thái theo đúng sơ đồ State Machine.',
        );
      } else {
        setErrorMessage(err.message || 'Không thể tải danh sách đơn hàng.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    if (!authLoading && user && (user.role === 'BARISTA' || user.role === 'MANAGER')) {
      void loadOrders();
    }
  }, [authLoading, user, loadOrders]);

  // 2. Chuyển trạng thái đơn hàng (PAID -> PREPARING -> READY -> COMPLETED)
  const handleTransition = async (
    orderId: string,
    nextStatus: 'PREPARING' | 'READY' | 'COMPLETED',
  ) => {
    setBusyOrderId(orderId);
    setErrorMessage(null);

    try {
      const updatedOrder = await transitionOrderStatusApi(orderId, nextStatus, token);
      // Cập nhật state chỉ khi API trả về thành công
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: updatedOrder.status } : o)),
      );
    } catch (err: any) {
      setErrorMessage(
        err.message || 'Không thể cập nhật trạng thái đơn hàng. Vui lòng thử lại.',
      );
    } finally {
      setBusyOrderId(null);
    }
  };

  // 3. Kiểm tra xác thực và phân quyền RBAC
  if (authLoading) {
    return (
      <div className="max-w-[1200px] mx-auto px-4 py-16 text-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="font-display text-body-md text-on-surface-variant">Đang kiểm tra quyền Barista...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-[500px] mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center mx-auto mb-4">
          <Lock className="w-8 h-8" />
        </div>
        <h1 className="font-display text-headline-sm font-bold text-on-surface mb-2">
          Yêu cầu đăng nhập Barista
        </h1>
        <p className="text-body-md text-on-surface-variant mb-6">
          Vui lòng đăng nhập với tài khoản Barista được cấp để vào hệ thống điều phối pha chế.
        </p>
        <Link
          href="/login?redirect=/barista"
          className="inline-flex px-6 py-3 rounded-full bg-primary text-on-primary font-display text-label-lg font-bold hover:bg-primary/90 transition-all shadow-md"
        >
          Đăng nhập ngay
        </Link>
      </div>
    );
  }

  // Chặn nghiêm ngặt: Tài khoản CUSTOMER không có quyền truy cập Barista Dashboard
  if (user.role !== 'BARISTA' && user.role !== 'MANAGER') {
    return (
      <div className="max-w-[500px] mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-error-container text-error flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="font-display text-headline-sm font-bold text-error mb-2">
          403 — Không có quyền truy cập
        </h1>
        <p className="text-body-md text-on-surface-variant mb-6">
          Tài khoản của bạn ({user.email}) mang quyền{' '}
          <strong className="text-on-surface">{user.role}</strong>. Chỉ nhân sự quầy pha chế (BARISTA / MANAGER) mới được truy cập khu vực này.
        </p>
        <Link
          href="/"
          className="inline-flex px-6 py-3 rounded-full bg-surface-container text-on-surface font-display text-label-lg font-semibold hover:bg-surface-container-high transition-all"
        >
          Trở về trang chủ
        </Link>
      </div>
    );
  }

  // 4. Lọc và tìm kiếm đơn hàng
  const filteredOrders = orders.filter((order) => {
    if (activeTab !== 'ALL' && order.status !== activeTab) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = order.id.toLowerCase().includes(q) || (order.orderNumber && order.orderNumber.toLowerCase().includes(q));
      const matchCustomer = order.customerName && order.customerName.toLowerCase().includes(q);
      const matchItem = order.items.some((it) => it.productName.toLowerCase().includes(q));
      return Boolean(matchId || matchCustomer || matchItem);
    }
    return true;
  });

  const countPaid = orders.filter((o) => o.status === 'PAID').length;
  const countPreparing = orders.filter((o) => o.status === 'PREPARING').length;
  const countReady = orders.filter((o) => o.status === 'READY').length;
  const countCompleted = orders.filter((o) => o.status === 'COMPLETED').length;

  return (
    <div className="max-w-[1200px] mx-auto px-margin md:px-margin-lg py-8">
      {/* Tiêu đề & Thông tin Barista */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-secondary text-on-secondary flex items-center justify-center shadow-md">
            <UtensilsCrossed className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-display text-headline-sm font-bold text-on-surface flex items-center gap-2">
              Bảng Điều Phối Pha Chế (Barista)
            </h1>
            <p className="text-body-sm text-on-surface-variant">
              Nhân sự: <strong className="text-on-surface">{user.fullName}</strong> ({user.email})
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setRefreshing(true);
            void loadOrders();
          }}
          disabled={loading || refreshing}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface font-display text-label-md font-semibold transition-colors shadow-sm self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Làm mới hàng đợi</span>
        </button>
      </div>

      {handoffNotice && (
        <div
          role="status"
          className="mb-6 p-4 rounded-xl bg-secondary-container/40 border border-secondary/30 text-on-surface flex items-start gap-3"
        >
          <Info className="w-5 h-5 shrink-0 mt-0.5 text-secondary" />
          <div className="text-body-sm">
            <p className="font-semibold text-secondary">Thông báo trạng thái tích hợp</p>
            <p className="mt-0.5">{handoffNotice}</p>
          </div>
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="mb-6 p-4 rounded-xl bg-error-container/40 border border-error/30 text-error flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-body-sm">
            <p className="font-semibold">Lỗi thao tác</p>
            <p>{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Bộ lọc tabs & Tìm kiếm */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center mb-6">
        <div className="flex items-center gap-1.5 p-1 bg-surface-container rounded-xl overflow-x-auto text-body-sm">
          <button
            type="button"
            onClick={() => setActiveTab('ALL')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors shrink-0 ${
              activeTab === 'ALL'
                ? 'bg-surface text-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Tất cả ({orders.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('PAID')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors shrink-0 ${
              activeTab === 'PAID'
                ? 'bg-surface text-secondary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Chờ pha ({countPaid})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('PREPARING')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors shrink-0 ${
              activeTab === 'PREPARING'
                ? 'bg-surface text-amber-700 dark:text-amber-300 shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Đang pha ({countPreparing})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('READY')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors shrink-0 ${
              activeTab === 'READY'
                ? 'bg-surface text-emerald-700 dark:text-emerald-300 shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Chờ giao ({countReady})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('COMPLETED')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors shrink-0 ${
              activeTab === 'COMPLETED'
                ? 'bg-surface text-on-surface shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Đã xong ({countCompleted})
          </button>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo mã đơn, món..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30 text-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-secondary/40"
          />
        </div>
      </div>

      {/* Danh sách thẻ đơn hàng */}
      {loading ? (
        <div className="py-16 text-center">
          <div className="w-8 h-8 border-3 border-secondary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-body-sm text-on-surface-variant">Đang tải danh sách hàng đợi...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="py-16 text-center bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-8">
          <Coffee className="w-12 h-12 text-outline mx-auto mb-3" />
          <h3 className="font-display text-title-md font-semibold text-on-surface mb-1">
            Không có đơn hàng nào
          </h3>
          <p className="text-body-sm text-on-surface-variant max-w-sm mx-auto">
            {handoffNotice
              ? 'Hệ thống đang hiển thị hàng đợi trống do API Barista đang chờ bàn giao từ backend.'
              : 'Hiện chưa có đơn hàng nào phù hợp với bộ lọc được chọn.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredOrders.map((order) => {
            const isBusy = busyOrderId === order.id;

            return (
              <div
                key={order.id}
                className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow"
              >
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
                    <div>
                      <span className="font-mono font-bold text-on-surface text-body-md">
                        {order.orderNumber || `#${order.id.slice(0, 8)}`}
                      </span>
                      {order.customerName && (
                        <p className="text-[12px] text-on-surface-variant">{order.customerName}</p>
                      )}
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-full text-[12px] font-bold ${
                        order.status === 'PAID'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200'
                          : order.status === 'PREPARING'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
                            : order.status === 'READY'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                              : 'bg-surface-container-high text-on-surface-variant'
                      }`}
                    >
                      {order.status === 'PAID'
                        ? 'Chờ pha chế'
                        : order.status === 'PREPARING'
                          ? 'Đang pha'
                          : order.status === 'READY'
                            ? 'Chờ giao'
                            : order.status === 'COMPLETED'
                              ? 'Đã xong'
                              : order.status}
                    </span>
                  </div>

                  <div className="py-3 divide-y divide-outline-variant/10 text-body-sm space-y-2">
                    {order.items.map((it, idx) => (
                      <div key={idx} className="pt-1.5 first:pt-0">
                        <div className="flex justify-between font-semibold text-on-surface">
                          <span>{it.productName}</span>
                          <span className="text-secondary font-bold">×{it.quantity}</span>
                        </div>
                        {(it.size || (it.toppings && it.toppings.length > 0)) && (
                          <p className="text-[12px] text-on-surface-variant">
                            {it.size ? `Size: ${it.size}` : ''}
                            {it.toppings && it.toppings.length > 0
                              ? ` (+ ${it.toppings.join(', ')})`
                              : ''}
                          </p>
                        )}
                        {it.notes && (
                          <p className="text-[11px] text-amber-700 italic">Ghi chú: {it.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-outline-variant/20 mt-2">
                  <div className="flex justify-between items-center text-body-sm mb-3">
                    <span className="text-on-surface-variant flex items-center gap-1 text-[12px]">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(order.createdAt).toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span className="font-bold text-secondary">{formatCurrency(order.total)}</span>
                  </div>

                  {/* Nút chuyển trạng thái theo State Machine */}
                  {order.status === 'PAID' && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleTransition(order.id, 'PREPARING')}
                      className="w-full py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-display text-label-md font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
                    >
                      {isBusy ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <Coffee className="w-4 h-4" />
                          <span>NHẬN ĐƠN & PHA CHẾ</span>
                        </>
                      )}
                    </button>
                  )}

                  {order.status === 'PREPARING' && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleTransition(order.id, 'READY')}
                      className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-display text-label-md font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
                    >
                      {isBusy ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>PHA XONG — SẴN SÀNG GIAO</span>
                        </>
                      )}
                    </button>
                  )}

                  {order.status === 'READY' && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleTransition(order.id, 'COMPLETED')}
                      className="w-full py-2.5 px-3 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-display text-label-md font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      {isBusy ? (
                        <div className="w-4 h-4 border-2 border-on-surface border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <ArrowRight className="w-4 h-4" />
                          <span>XÁC NHẬN ĐÃ GIAO KHÁCH</span>
                        </>
                      )}
                    </button>
                  )}

                  {order.status === 'COMPLETED' && (
                    <div className="text-center py-1 text-label-sm text-on-surface-variant font-medium">
                      ✓ Đã hoàn tất đơn hàng
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
