import { IsString, IsOptional, IsArray, ValidateNested, IsInt, Min, IsNumber, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class OrderItemDto {
  @IsUUID()
  productId: string;

  @IsString()
  productName: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;
}

export class CreateOrderDto {
  @IsUUID()
  userId: string;

  @IsOptional()
  @IsString()
  promoCode?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  pointsToRedeem?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}