import { CartItem } from './cart';

export const FREE_SHIPPING_THRESHOLD = 100000;
export const SHIPPING_FEE = 15000;

export interface Voucher {
  code: string;
  label: string;
  type: 'fixed' | 'percent';
  value: number;
  /** Giảm tối đa (cho loại %). */
  maxDiscount?: number;
  minSubtotal: number;
}

// Bổ sung đầy đủ HELLOBREW và BREW20 vào mảng VOUCHERS
export const VOUCHERS: Voucher[] = [
  { code: 'HELLOBREW', label: 'Giảm 20.000đ', type: 'fixed', value: 20000, minSubtotal: 50000 },
  { code: 'BREW20', label: 'Giảm 20% tối đa 30.000đ', type: 'percent', value: 20, maxDiscount: 30000, minSubtotal: 100000 },
  { code: 'COFFEE10', label: 'Giảm 10.000đ', type: 'fixed', value: 10000, minSubtotal: 50000 },
  { code: 'BREWLITEVIP', label: 'Giảm thành viên 20.000đ', type: 'fixed', value: 20000, minSubtotal: 100000 },
  { code: 'SINHVIEN15', label: 'Giảm 15% tối đa 30.000đ', type: 'percent', value: 15, maxDiscount: 30000, minSubtotal: 0 },
];

export type VoucherResult = { ok: true; voucher: Voucher } | { ok: false; error: string };

export function findVoucher(code: string): Voucher | undefined {
  const normalized = code.trim().toUpperCase();

  // 1. Tìm trong danh sách mã khuyến mãi mặc định
  const existing = VOUCHERS.find((v) => v.code === normalized);
  if (existing) return existing;

  // 2. Nhận diện động các mã đổi từ Loyalty (REDEEM10K, REDEEM30K, REDEEM70K...)
  if (normalized.startsWith('REDEEM')) {
    let value = 10000;
    if (normalized.includes('30K')) value = 30000;
    else if (normalized.includes('70K')) value = 70000;

    return {
      code: normalized,
      label: `Giảm ${value.toLocaleString('vi-VN')}đ`,
      type: 'fixed',
      value: value,
      minSubtotal: 0,
    };
  }

  return undefined;
}

export function validateVoucher(code: string, subtotal: number): VoucherResult {
  if (!code.trim()) return { ok: false, error: 'Vui lòng nhập mã giảm giá trước khi áp dụng.' };
  const voucher = findVoucher(code);
  if (!voucher) return { ok: false, error: 'Mã giảm giá không hợp lệ hoặc đã hết hạn.' };
  if (subtotal < voucher.minSubtotal) {
    return {
      ok: false,
      error: `Mã ${voucher.code} áp dụng cho đơn từ ${voucher.minSubtotal.toLocaleString('vi-VN')}đ.`,
    };
  }
  return { ok: true, voucher };
}

export function calcDiscount(voucher: Voucher, subtotal: number): number {
  if (subtotal < voucher.minSubtotal) return 0;
  const raw = voucher.type === 'fixed' ? voucher.value : Math.round((subtotal * voucher.value) / 100);
  const capped = voucher.maxDiscount ? Math.min(raw, voucher.maxDiscount) : raw;
  return Math.min(capped, subtotal);
}

export interface CartSummary {
  itemCount: number;
  subtotal: number;
  voucher: Voucher | null;
  /** Mã đã nhập nhưng đơn hiện không đủ điều kiện (ví dụ sau khi giảm số lượng). */
  voucherInactive: boolean;
  discount: number;
  shipping: number;
  total: number;
}

export function computeCartSummary(items: CartItem[], voucherCode: string | null): CartSummary {
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const voucher = voucherCode ? findVoucher(voucherCode) ?? null : null;
  const discount = voucher ? calcDiscount(voucher, subtotal) : 0;
  const shipping = subtotal === 0 || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;

  return {
    itemCount,
    subtotal,
    voucher,
    voucherInactive: Boolean(voucher && discount === 0 && subtotal > 0),
    discount,
    shipping,
    total: Math.max(0, subtotal - discount + shipping),
  };
}