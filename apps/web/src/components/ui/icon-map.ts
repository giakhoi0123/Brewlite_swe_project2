import {
  Award,
  Citrus,
  Clock,
  Coffee,
  Droplets,
  Flame,
  Flower2,
  GraduationCap,
  Leaf,
  LucideIcon,
  Milk,
  Snowflake,
  Sparkles,
  Star,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { IconKey } from '../../types/menu';

// Dữ liệu chỉ lưu tên icon (chuỗi) để dễ chuyển sang API sau này; component tra icon tại đây.
export const ICONS: Record<IconKey, LucideIcon> = {
  star: Star,
  trending: TrendingUp,
  leaf: Leaf,
  flame: Flame,
  award: Award,
  clock: Clock,
  flower: Flower2,
  zap: Zap,
  school: GraduationCap,
  sparkles: Sparkles,
  coffee: Coffee,
  snowflake: Snowflake,
  droplets: Droplets,
  milk: Milk,
  citrus: Citrus,
};
