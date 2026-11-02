export class ProductResponseDto {
  id: string;
  name: string;
  basePrice: number;
  imageUrl: string;
  /** Catalog sale flag; does not account for reserved stock. */
  isAvailable: boolean;
  /** Whether one unit can be ordered at the time of this read. */
  canOrder: boolean;
  createdAt: string;
}
