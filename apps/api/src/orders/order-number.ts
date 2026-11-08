import * as crypto from 'crypto';

/**
 * Sinh mã đơn hàng (order number) duy nhất, bảo mật và an toàn khi xử lý đồng thời.
 * Định dạng: BL-YYYYMMDD-<SHORT_UUID>
 * Ví dụ: BL-20261108-A1B2C3D4
 *
 * Nguyên tắc:
 * - Không sử dụng COUNT() + 1 hoặc MAX() + 1 (tránh xung đột race condition).
 * - Sử dụng crypto.randomUUID() chuẩn mật mã học làm nguồn entropy.
 */
export function generateOrderNumber(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const datePart = `${year}${month}${day}`;

  const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
  return `BL-${datePart}-${suffix}`;
}
