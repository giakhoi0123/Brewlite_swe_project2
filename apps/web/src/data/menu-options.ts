import { DrinkCustomization, SizeOption, ToppingOption } from '../types/menu';

export const SIZE_OPTIONS: SizeOption[] = [
  { code: 'M', label: 'Size M', volume: '350ml', extraPrice: 0 },
  { code: 'L', label: 'Size L', volume: '500ml', extraPrice: 6000 },
];

export const SUGAR_LEVELS = ['100% (Chuẩn)', '70% (Ít ngọt)', '50%', '30%', '0% (Không đường)'];

export const ICE_LEVELS = ['100% (Đá chuẩn)', '70% (Ít đá)', '50%', 'Không đá'];

export const MAX_TOPPINGS = 3;

export const TOPPING_OPTIONS: ToppingOption[] = [
  { id: 'tran-chau-den', name: 'Trân châu đen dẻo', price: 5000 },
  { id: 'thach-cu-nang', name: 'Thạch củ năng giòn', price: 6000 },
  { id: 'kem-cheese', name: 'Kem cheese mặn béo ngậy', price: 8000 },
  { id: 'kem-trung-chay', name: 'Kem trứng cháy xém', price: 8000 },
  { id: 'dao-ngam', name: 'Đào ngâm miếng giòn (2 miếng)', price: 8000 },
  { id: 'shot-espresso', name: 'Thêm 1 shot Espresso Robusta', price: 10000 },
];

/** Tùy chọn mặc định khi "Thêm nhanh" hoặc mới mở hộp tùy chỉnh. */
export const DEFAULT_CUSTOMIZATION: DrinkCustomization = {
  size: 'M',
  sugar: SUGAR_LEVELS[0],
  ice: ICE_LEVELS[0],
  toppingIds: [],
  note: '',
};
