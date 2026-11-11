import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export enum BaristaQueueStatus {
  PAID = 'PAID',
  PREPARING = 'PREPARING',
  READY = 'READY',
}

export class BaristaQueueQueryDto {
  @IsOptional()
  @IsEnum(BaristaQueueStatus, {
    message:
      'Trạng thái lọc trong hàng đợi Barista chỉ chấp nhận: PAID, PREPARING, READY',
  })
  status?: BaristaQueueStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Trang phải là số nguyên' })
  @Min(1, { message: 'Trang tối thiểu là 1' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số lượng mỗi trang phải là số nguyên' })
  @Min(1, { message: 'Số lượng mỗi trang tối thiểu là 1' })
  @Max(50, { message: 'Số lượng mỗi trang tối đa là 50' })
  limit?: number = 20;
}
