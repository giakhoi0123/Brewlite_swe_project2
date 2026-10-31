'use client';

import Link from 'next/link';
import { ArrowUpDown, ChevronRight, Flame, Home, Search } from 'lucide-react';
import { SortOption } from '../../types/menu';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'default', label: 'Mặc định phổ biến' },
  { value: 'best-seller', label: 'Bán chạy nhất' },
  { value: 'price-asc', label: 'Giá: Thấp đến Cao' },
  { value: 'price-desc', label: 'Giá: Cao đến Thấp' },
  { value: 'rating', label: 'Đánh giá cao nhất' },
];

const METRICS = [
  { value: '100%', label: 'Hạt rang mộc' },
  { value: '4.8★', label: '1,500+ Review' },
  { value: '25k+', label: 'Giá sinh viên' },
];

interface MenuHeroProps {
  search: string;
  sort: SortOption;
  onSearchChange: (value: string) => void;
  onSortChange: (value: SortOption) => void;
}

export const MenuHero: React.FC<MenuHeroProps> = ({ search, sort, onSearchChange, onSortChange }) => (
  <section className="w-full bg-gradient-to-b from-surface-container-low via-surface to-surface pb-space-lg">
    <div className="max-w-[1200px] mx-auto px-margin md:px-margin-lg pt-space-md">
      <nav aria-label="Breadcrumb" className="flex items-center gap-space-xs font-display text-label-md text-outline mb-space-md">
        <Link href="/" className="hover:text-primary transition-colors flex items-center gap-1">
          <Home className="w-4 h-4" />
          Trang chủ
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-on-surface font-semibold">Thực đơn BrewLite</span>
      </nav>

      <div className="relative overflow-hidden rounded-xl bg-primary-container text-on-primary p-space-lg md:p-space-xl shadow-md">
        <div className="absolute -right-20 -bottom-20 w-80 h-80 rounded-full bg-secondary/20 blur-3xl pointer-events-none" />
        <div className="absolute -left-10 -top-10 w-64 h-64 rounded-full bg-secondary-fixed/10 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-space-lg">
          <div className="max-w-2xl space-y-space-xs">
            <div className="inline-flex items-center gap-space-xs px-space-sm py-1 rounded-full bg-secondary/30 backdrop-blur-md text-secondary-fixed font-display text-label-sm uppercase tracking-wider">
              <Flame className="w-3.5 h-3.5" />
              Thực đơn thủ công pha mới
            </div>
            <h1 className="font-display text-headline-display-mobile md:text-headline-display text-surface-container-lowest">
              Thực Đơn Đồ Uống BrewLite
            </h1>
            <p className="text-body-lg text-primary-fixed-dim">
              Cà phê rang mộc thủ công &amp; thức uống sáng tạo pha mới mỗi ngày. Dành riêng cho trải nghiệm mộc
              mạc, đậm vị và chuẩn gu học sinh - sinh viên.
            </p>
          </div>

          <div className="flex items-center gap-space-md bg-surface-container-lowest/10 backdrop-blur-md p-space-md rounded-xl text-surface-bright self-start lg:self-auto">
            {METRICS.map((metric, index) => (
              <div key={metric.label} className="flex items-center gap-space-md">
                {index > 0 && <div className="w-px h-8 bg-outline-variant/30" />}
                <div className="text-center px-space-xs sm:px-space-sm">
                  <p className="font-display text-headline-md font-bold text-secondary-fixed">{metric.value}</p>
                  <p className="font-display text-label-sm text-primary-fixed-dim">{metric.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 mt-space-lg pt-space-md flex flex-col md:flex-row gap-space-sm items-stretch md:items-center justify-between">
          <div className="relative flex-1 max-w-lg">
            <Search className="absolute left-space-md top-1/2 -translate-y-1/2 w-5 h-5 text-outline" />
            <input
              type="search"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Tìm món: Cà phê muối, Bạc xỉu, Trà đào cam sả..."
              aria-label="Tìm món trong thực đơn"
              className="w-full bg-surface text-on-surface rounded-full pl-11 pr-space-md py-3 text-body-md placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-secondary shadow-sm transition-all"
            />
          </div>

          <label className="flex items-center gap-space-xs bg-surface-container-lowest/20 backdrop-blur-md px-space-sm py-1.5 rounded-full self-start md:self-auto">
            <span className="font-display text-label-sm text-surface-container-highest uppercase pl-2 flex items-center gap-1">
              <ArrowUpDown className="w-4 h-4" />
              Sắp xếp:
            </span>
            <select
              value={sort}
              onChange={(e) => onSortChange(e.target.value as SortOption)}
              aria-label="Sắp xếp món"
              className="bg-transparent text-surface-bright font-display text-label-md py-1 px-space-xs rounded-full focus:outline-none cursor-pointer"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value} className="bg-primary text-on-primary">
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </div>
  </section>
);
