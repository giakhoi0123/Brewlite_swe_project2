import { MenuCategory } from '../types/menu';

export const MENU_CATEGORIES: MenuCategory[] = [
  { id: 'ca-phe', label: 'Cà phê', shortLabel: 'Cà Phê' },
  { id: 'cold-brew', label: 'Cold Brew', shortLabel: 'Cold Brew' },
  { id: 'tra-sua', label: 'Trà sữa', shortLabel: 'Trà Sữa' },
  { id: 'tra-matcha', label: 'Trà & Matcha', shortLabel: 'Trà & Matcha' },
  { id: 'tra-trai-cay', label: 'Trà trái cây', shortLabel: 'Trà Trái Cây' },
  { id: 'cacao', label: 'Cacao & Socola', shortLabel: 'Cacao' },
  { id: 'giai-nhiet', label: 'Giải nhiệt', shortLabel: 'Giải Nhiệt' },
];

export function getCategory(id: string): MenuCategory | undefined {
  return MENU_CATEGORIES.find((category) => category.id === id);
}
