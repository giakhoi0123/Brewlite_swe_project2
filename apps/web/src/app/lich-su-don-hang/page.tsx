'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';

interface OrderItem {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

interface Order {
  id: string;
  totalAmount: number;
  discountAmount: number;
  finalAmount: number;
  status: string;
  createdAt: string;
  items: OrderItem[];
}

export default function OrderHistoryPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Nếu chưa có thông tin user đăng nhập
    if (!user?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    fetch(`http://localhost:3005/api/orders/me?userId=${user.id}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Lỗi (${res.status}): Không thể tải dữ liệu đơn hàng`);
        return res.json();
      })
      .then((data) => {
        setOrders(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
  }, [user]);

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto p-6 pt-28 text-center text-gray-600">
        Vui lòng <a href="/login" className="text-amber-800 font-bold underline">Đăng nhập</a> để xem lịch sử đơn hàng.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6 pt-28 text-center text-gray-600">
        Đang tải lịch sử đơn hàng...
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
    <div className="max-w-4xl mx-auto p-6 pt-28">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Lịch Sử Đơn Hàng</h1>
      {orders.length === 0 ? (
        <div className="bg-white border rounded-xl p-8 text-center text-gray-500 shadow-sm">
          <p className="text-lg font-medium">Bạn chưa có đơn hàng nào.</p>
          <p className="text-sm text-gray-400 mt-1">
            Hãy đặt món tại trang Thực đơn để trải nghiệm dịch vụ của BrewLite nhé!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div key={order.id} className="border rounded-xl p-5 shadow-sm bg-white">
              <div className="flex justify-between items-center mb-3 pb-3 border-b">
                <div>
                  <span className="font-semibold text-gray-800">Mã đơn: #{order.id.slice(0, 8)}</span>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {new Date(order.createdAt).toLocaleString('vi-VN')}
                  </div>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold ${
                    order.status === 'COMPLETED'
                      ? 'bg-green-100 text-green-800'
                      : order.status === 'CANCELLED'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {order.status}
                </span>
              </div>

              <div className="divide-y my-2">
                {order.items?.map((item) => (
                  <div key={item.id} className="py-2 flex justify-between text-sm">
                    <span className="text-gray-700">
                      {item.productName} x {item.quantity}
                    </span>
                    <span className="font-medium text-gray-900">
                      {(item.unitPrice * item.quantity).toLocaleString('vi-VN')} VNĐ
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t pt-3 mt-3 flex justify-between text-sm font-bold">
                <span>Tổng tiền thanh toán:</span>
                <span className="text-amber-900 text-base">
                  {order.finalAmount?.toLocaleString('vi-VN')} VNĐ
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}