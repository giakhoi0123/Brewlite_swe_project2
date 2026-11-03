import { OptionType } from '@prisma/client';
import { ProductResponseDto } from './product-response.dto';

export class ProductOptionDto {
  id: string;
  type: OptionType;
  name: string;
  extraPrice: number;
}

export class InventoryDto {
  quantity: number;
  reserved: number;
  availableStock: number;
}

export class ProductDetailResponseDto extends ProductResponseDto {
  options: ProductOptionDto[];
  inventory: InventoryDto | null;
}
