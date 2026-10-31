'use client';

import { Coffee, CupSoda, Cookie, GlassWater, Leaf, LucideIcon, Snowflake, Citrus } from 'lucide-react';
import { MENU_CATEGORIES } from '../../data/menu-categories';
import { CategoryFilter } from '../../lib/menu-filter';
import { MenuCategoryId } from '../../types/menu';

const CATEGORY_ICONS: Record<MenuCategoryId, LucideIcon> = {
  'ca-phe': Coffee,
  'cold-brew': Snowflake,
  'tra-sua': CupSoda,
  'tra-matcha': Leaf,
  'tra-trai-cay': Citrus,
  cacao: Cookie,
  'giai-nhiet': GlassWater,
};

interface CategoryTabsProps {
  active: CategoryFilter;
  counts: Record<string, number>;
  total: number;
  onChange: (category: CategoryFilter) => void;
}

const baseClass =
  'flex items-center gap-1 px-space-md py-2 rounded-full font-display text-label-md whitespace-nowrap transition-transform duration-200 active:scale-95';
const activeClass = 'bg-primary text-on-primary shadow-sm';
const idleClass = 'bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high';

export const CategoryTabs: React.FC<CategoryTabsProps> = ({ active, counts, total, onChange }) => (
  <section className="sticky top-20 z-40 bg-surface/90 backdrop-blur-md py-space-sm shadow-sm">
    <div className="max-w-[1200px] mx-auto px-margin md:px-margin-lg">
      <div role="tablist" aria-label="Danh mục đồ uống" className="flex items-center gap-space-xs overflow-x-auto no-scrollbar py-1">
        <button
          type="button"
          role="tab"
          aria-selected={active === 'all'}
          onClick={() => onChange('all')}
          className={`${baseClass} ${active === 'all' ? activeClass : idleClass}`}
        >
          <span>Tất cả</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-secondary text-on-secondary">{total}</span>
        </button>

        {MENU_CATEGORIES.map((category) => {
          const Icon = CATEGORY_ICONS[category.id];
          const isActive = active === category.id;
          return (
            <button
              key={category.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(category.id)}
              className={`${baseClass} ${isActive ? activeClass : idleClass}`}
            >
              <Icon className="w-4 h-4" />
              <span>{category.label}</span>
              <span className="text-[11px] opacity-70">({counts[category.id] ?? 0})</span>
            </button>
          );
        })}
      </div>
    </div>
  </section>
);
