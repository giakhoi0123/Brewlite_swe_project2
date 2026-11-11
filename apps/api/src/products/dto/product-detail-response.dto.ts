import { OptionType } from '@prisma/client';
import { ProductResponseDto } from './product-response.dto';

export class ProductOptionDto {
  id: string;
  type: OptionType;
  name: string;
  extraPrice: number;
}

/**
 * Backward compatibility projection derived from recipe capacity.
 * Not stored in or read from the legacy product inventories table.
 */
export class InventoryDto {
  quantity: number;
  reserved: number;
  availableStock: number;
}

export class ProductDetailResponseDto extends ProductResponseDto {
  options: ProductOptionDto[];
  /** Compatibility projection calculated from recipe capacity; reserved is 0. */
  inventory: InventoryDto | null;
}
