import { redirect } from 'next/navigation';

// Trang chủ chưa có thiết kế — tạm thời chuyển thẳng sang Thực đơn.
export default function HomePage() {
  redirect('/products');
}
