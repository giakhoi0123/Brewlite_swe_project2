import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { OrderStatus } from '@prisma/client';

export class UpdateOrderStatusDto {
  @IsNotEmpty({ message: 'status không được để trống' })
  @IsEnum(OrderStatus, {
    message: `status phải là một trong các giá trị hợp lệ: ${Object.values(OrderStatus).join(', ')}`,
  })
  status: OrderStatus;

  @IsOptional()
  @IsString({ message: 'reason phải là chuỗi ký tự' })
  @MaxLength(255, { message: 'reason không được vượt quá 255 ký tự' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  reason?: string;
}
