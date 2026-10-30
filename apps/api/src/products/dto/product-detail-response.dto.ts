import { OptionType } from '@prisma/client';

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

export class ProductDetailResponseDto {
  id: string;
  name: string;
  basePrice: number;
  imageUrl: string;
  isAvailable: boolean;
  createdAt: string;
  options: ProductOptionDto[];
  inventory: InventoryDto | null;
}
