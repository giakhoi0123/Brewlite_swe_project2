import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class EarnPointsDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsInt()
  @Min(1)
  points: number;

  @IsOptional()
  @IsString()
  orderId?: string;

  @IsOptional()
  @IsString()
  description?: string;
}