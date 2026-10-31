import { normalizeSearchText } from './menu-filter';

/** "Bạc Xỉu 3 Tầng Sài Gòn" -> "bac-xiu-3-tang-sai-gon" */
export function slugify(value: string): string {
  return normalizeSearchText(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
