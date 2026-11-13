'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005/api';

interface Promotion {
  id: string;
  code: string;
  description?: string;
  discountType: 'PERCENTAGE' | 'FIXED' | 'FIXED_AMOUNT';
  discountValue: number;
  minOrderAmount?: number;
  isActive: boolean;
  endDate: string;
}

interface MyVoucher {
  code: string;
  name: string;
  redeemedAt: string;
}

const REDEEM_OPTIONS = [
  { points: 20, reward: 'Voucher giảm 10.000 VNĐ', code: 'REDEEM10K' },
  { points: 50, reward: 'Voucher giảm 30.000 VNĐ', code: 'REDEEM30K' },
  { points: 100, reward: 'Voucher giảm 70.000 VNĐ', code: 'REDEEM70K' },
];

export default function PromotionsAndLoyaltyPage() {
  const { user, token } = useAuth();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [points, setPoints] = useState<number>(0);
  const [myVouchers, setMyVouchers] = useState<MyVoucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const activeUserId = user?.id || (user as any)?.userId || (user as any)?.sub;

  const getAuthHeaders = useCallback((): Record<string, string> => {
    const activeToken =
      token ||
      (typeof window !== 'undefined' ? localStorage.getItem('brewlite_access_token') : null);

    return activeToken ? { Authorization: `Bearer ${activeToken}` } : {};
  }, [token]);

  const loadData = useCallback(() => {
    const headers = getAuthHeaders();

    const fetchPromotions = fetch(`${API_URL}/promotions`, {
      headers,
      credentials: 'include',
    })
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []);

    const fetchLoyalty = activeUserId
      ? fetch(`${API_URL}/loyalty/user/${activeUserId}`, {
          headers,
          credentials: 'include',
        })
          .then(async (r) => (r.ok ? await r.json() : null))
          .catch(() => null)
      : Promise.resolve(null);

    Promise.all([fetchPromotions, fetchLoyalty])
      .then(([promoData, loyaltyData]) => {
        const publicPromos = Array.isArray(promoData)
          ? promoData.filter((p: Promotion) => !p.code?.startsWith('REDEEM'))
          : [];
        setPromotions(publicPromos);

        if (loyaltyData && typeof loyaltyData === 'object') {
          setPoints(loyaltyData.currentPoints ?? loyaltyData.points ?? 0);

          if (Array.isArray(loyaltyData.availableVouchers)) {
            setMyVouchers(
              loyaltyData.availableVouchers.map((v: any) => ({
                code: v.code,
                name: v.name,
                redeemedAt: new Date(v.redeemedAt).toLocaleString('vi-VN'),
              })),
            );
          }
        }

        if (activeUserId && typeof window !== 'undefined') {
          localStorage.removeItem(`my_vouchers_${activeUserId}`);
        }

        setLoading(false);
      })
      .catch((err) => {
        console.error('Lỗi tải dữ liệu:', err);
        setLoading(false);
      });
  }, [activeUserId, getAuthHeaders]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRedeem = async (pointsToRedeem: number, baseRewardCode: string, rewardName: string) => {
    if (!activeUserId) {
      setMessage({ type: 'error', text: 'Vui lòng đăng nhập để đổi điểm!' });
      return;
    }

    if (points < pointsToRedeem) {
      setMessage({ type: 'error', text: `Bạn không đủ điểm. Cần tối thiểu ${pointsToRedeem} điểm!` });
      return;
    }

    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const uniqueRewardCode = `${baseRewardCode}-${randomSuffix}`;

    setRedeeming(pointsToRedeem);
    setMessage(null);

    try {
      const res = await fetch(`${API_URL}/loyalty/redeem`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        credentials: 'include',
        body: JSON.stringify({
          userId: activeUserId,
          points: pointsToRedeem,
          rewardCode: uniqueRewardCode,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Đổi điểm thất bại');
      }

      setMessage({
        type: 'success',
        text: `Đổi thành công! Đã thêm mã ${uniqueRewardCode} (${rewardName}) vào Kho Voucher của bạn. Trừ ${pointsToRedeem} điểm.`,
      });

      loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Có lỗi xảy ra khi đổi điểm.' });
    } finally {
      setRedeeming(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6 pt-28 text-center text-gray-600">
        Đang tải thông tin ưu đãi...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 pt-28 space-y-8">
      {/* Thẻ Điểm Thưởng Loyalty */}
      <div className="bg-gradient-to-r from-amber-700 to-amber-900 text-white rounded-xl p-6 shadow-md">
        <h2 className="text-xl font-bold mb-1">Điểm Tích Lũy Loyalty</h2>
        <p className="text-amber-200 text-sm mb-4">
          Tự động cộng 1 điểm cho mỗi 10.000 VNĐ khi đơn hàng PAID
        </p>
        <div className="flex items-baseline space-x-2">
          <span className="text-4xl font-extrabold">{points}</span>
          <span className="text-lg">điểm thưởng</span>
        </div>
      </div>

      {/* Thông báo kết quả đổi điểm */}
      {message && (
        <div
          className={`p-4 rounded-lg font-medium text-sm ${
            message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* 1. KHO VOUCHER CỦA TÔI */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-800">Kho Voucher Của Tôi</h2>
          <span className="text-xs bg-amber-100 text-amber-900 font-bold px-3 py-1 rounded-full">
            {myVouchers.length} voucher
          </span>
        </div>

        {myVouchers.length === 0 ? (
          <div className="bg-gray-50 border border-dashed rounded-xl p-6 text-center text-gray-500 text-sm">
            Bạn chưa có voucher nào trong kho. Hãy dùng điểm tích lũy để đổi quà nhé!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {myVouchers.map((v) => (
              <div
                key={v.code}
                className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-xl p-4 flex justify-between items-center shadow-sm"
              >
                <div>
                  <div className="font-mono font-bold text-amber-900 text-lg">{v.code}</div>
                  <div className="text-sm text-gray-700 font-medium">{v.name}</div>
                  <div className="text-xs text-gray-400 mt-1">Đã đổi: {v.redeemedAt}</div>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(v.code);
                    alert(`Đã sao chép mã ${v.code} vào bộ nhớ tạm!`);
                  }}
                  className="bg-amber-800 hover:bg-amber-900 text-white font-semibold text-xs px-3 py-2 rounded-lg transition-colors"
                >
                  Sao chép mã
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. ĐỔI ĐIỂM LẤY VOUCHER */}
      <div>
        <h2 className="text-2xl font-bold mb-4 text-gray-800">Đổi Điểm Lấy Voucher</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {REDEEM_OPTIONS.map((opt) => (
            <div
              key={opt.points}
              className="bg-white border rounded-xl p-5 shadow-sm flex flex-col justify-between hover:border-amber-500 transition-colors"
            >
              <div>
                <div className="text-amber-900 font-bold text-lg mb-1">{opt.reward}</div>
                <div className="text-xs text-gray-500 mb-3">Yêu cầu: {opt.points} điểm</div>
              </div>
              <button
                onClick={() => handleRedeem(opt.points, opt.code, opt.reward)}
                disabled={points < opt.points || redeeming === opt.points}
                className={`w-full py-2 px-4 rounded-lg text-sm font-bold transition-colors ${
                  points >= opt.points
                    ? 'bg-amber-800 text-white hover:bg-amber-900 cursor-pointer'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {redeeming === opt.points ? 'Đang đổi...' : `Đổi (${opt.points} điểm)`}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 3. MÃ GIẢM GIÁ HỆ THỐNG */}
      <div>
        <h2 className="text-2xl font-bold mb-4 text-gray-800">Mã Giảm Giá Khác</h2>
        {promotions.length === 0 ? (
          <p className="text-gray-500">Hiện chưa có mã khuyến mãi nào khả dụng.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {promotions.map((promo) => (
              <div
                key={promo.id}
                className="border border-dashed border-amber-500 bg-amber-50 rounded-lg p-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-mono font-bold text-lg bg-amber-200 text-amber-900 px-3 py-1 rounded">
                      {promo.code}
                    </span>
                    <span className="text-xs text-amber-800 font-bold">
                      {promo.discountType === 'PERCENTAGE'
                        ? `Giảm ${promo.discountValue}%`
                        : `Giảm ${promo.discountValue?.toLocaleString('vi-VN')} VNĐ`}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    {promo.description || 'Ưu đãi dành cho khách hàng BrewLite'}
                  </p>
                  {promo.minOrderAmount && (
                    <p className="text-xs text-gray-500">
                      Đơn tối thiểu: {promo.minOrderAmount.toLocaleString('vi-VN')} VNĐ
                    </p>
                  )}
                </div>
                <div className="mt-4 pt-2 border-t border-amber-200 text-xs text-gray-500 flex justify-between items-center">
                  <span>HSD: {new Date(promo.endDate).toLocaleDateString('vi-VN')}</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(promo.code)}
                    className="text-amber-800 font-semibold hover:underline"
                  >
                    Sao chép mã
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}