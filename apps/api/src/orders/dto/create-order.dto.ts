import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { CreateOrderItemDto } from './create-order-item.dto';

export class CreateOrderDto {
  @IsArray({ message: 'items phải là một danh sách các món hàng' })
  @ArrayMinSize(1, { message: 'Đơn hàng phải có ít nhất 1 món hàng' })
  @ArrayMaxSize(50, { message: 'Đơn hàng không được vượt quá 50 món hàng trong một lần tạo' })
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  @IsOptional()
  @IsString({ message: 'voucherCode phải là chuỗi ký tự' })
  @MaxLength(50, { message: 'voucherCode không được vượt quá 50 ký tự' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  voucherCode?: string;

  @IsOptional()
  @IsString({ message: 'notes phải là chuỗi ký tự' })
  @MaxLength(1000, { message: 'notes của đơn hàng không được vượt quá 1000 ký tự' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  notes?: string;

  @IsOptional()
  @IsInt({ message: 'pointsToRedeem phải là số nguyên' })
  @Min(0, { message: 'pointsToRedeem không được là số âm' })
  @Max(100000, { message: 'pointsToRedeem không được vượt quá 100,000' })
  @Type(() => Number)
  pointsToRedeem?: number;
}
