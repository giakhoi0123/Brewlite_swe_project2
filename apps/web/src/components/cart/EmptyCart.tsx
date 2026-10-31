import Link from 'next/link';
import { BookOpen, Coffee } from 'lucide-react';

export const EmptyCart: React.FC = () => (
  <div data-testid="cart-empty" className="flex flex-col items-center justify-center text-center py-space-xl px-margin max-w-lg mx-auto">
    <div className="w-24 h-24 rounded-full bg-surface-container flex items-center justify-center text-secondary mb-space-md shadow-inner">
      <Coffee className="w-12 h-12" />
    </div>
    <h2 className="font-display text-headline-lg font-bold text-on-surface mb-space-xs">Giỏ hàng của bạn đang trống</h2>
    <p className="text-body-md text-on-surface-variant mb-space-lg">
      Hãy chọn một ly cà phê đậm đà thơm ngát từ xưởng rang BrewLite để bắt đầu một ngày ngập tràn cảm hứng.
    </p>
    <Link
      href="/thuc-don"
      className="px-space-xl py-3.5 rounded-full bg-primary-container text-on-primary font-display text-label-lg font-bold shadow-md hover:bg-primary transition-transform active:scale-95 inline-flex items-center gap-space-xs"
    >
      <BookOpen className="w-5 h-5" />
      KHÁM PHÁ MENU NGAY
    </Link>
  </div>
);
