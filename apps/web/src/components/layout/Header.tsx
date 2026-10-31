'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { Coffee, Search, ShoppingBag, User } from 'lucide-react';
import { useCart } from '../cart/CartProvider';

const NAV_LINKS = [
  { href: '/', label: 'Trang chủ' },
  { href: '/thuc-don', label: 'Thực đơn' },
  { href: '/khuyen-mai', label: 'Khuyến mãi' },
  { href: '/ve-chung-toi', label: 'Về chúng tôi' },
];

export const Header: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { totalQuantity } = useCart();
  const [query, setQuery] = useState('');

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/thuc-don?q=${encodeURIComponent(q)}` : '/thuc-don');
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-surface/85 backdrop-blur-md shadow-[0_1px_8px_rgba(43,24,16,0.04)]">
      <div className="h-20 max-w-[1200px] mx-auto px-margin md:px-margin-lg flex items-center justify-between gap-space-md">
        <div className="flex items-center gap-space-xl">
          <Link href="/" className="flex items-center gap-space-sm group">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-on-primary transition-transform group-hover:scale-95">
              <Coffee className="w-5 h-5" />
            </div>
            <span className="font-display text-headline-sm text-primary tracking-tight">BrewLite</span>
          </Link>

          <nav className="hidden lg:flex items-center gap-space-xs p-space-xs bg-surface-container rounded-full">
            {NAV_LINKS.map((link) => {
              const active = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={`px-space-md py-space-xs rounded-full font-display text-label-lg transition-colors ${
                    active
                      ? 'bg-primary text-on-primary shadow-[0_2px_8px_rgba(43,24,16,0.08)]'
                      : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-space-sm">
          <form
            onSubmit={handleSearch}
            role="search"
            className="hidden md:flex items-center bg-surface-container-low rounded-full px-space-md py-space-xs text-on-surface-variant w-56 focus-within:w-64 focus-within:bg-surface-container-lowest transition-all shadow-[0_2px_8px_rgba(43,24,16,0.04)]"
          >
            <Search className="w-[18px] h-[18px] mr-space-xs text-outline" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm cà phê, hạt rang..."
              aria-label="Tìm kiếm trên toàn trang"
              className="bg-transparent w-full text-body-sm text-on-surface focus:outline-none placeholder:text-outline"
            />
          </form>

          <Link
            href="/gio-hang"
            aria-label={`Giỏ hàng (${totalQuantity} món)`}
            className="relative w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors shadow-[0_2px_8px_rgba(43,24,16,0.04)]"
          >
            <ShoppingBag className="w-5 h-5" />
            {totalQuantity > 0 && (
              <span className="absolute -top-1 -right-1 bg-secondary text-on-secondary font-display text-label-sm min-w-5 h-5 px-1 rounded-full flex items-center justify-center shadow-sm">
                {totalQuantity > 99 ? '99+' : totalQuantity}
              </span>
            )}
          </Link>

          <div className="w-8 h-8 rounded-full bg-primary-container text-primary-fixed-dim flex items-center justify-center ring-2 ring-surface-container-high shadow-sm">
            <User className="w-4 h-4" />
          </div>
        </div>
      </div>
    </header>
  );
};
