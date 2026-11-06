import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsInt, Matches, Max, Min, ValidateNested } from 'class-validator';

// PostgreSQL UUID accepts canonical hexadecimal IDs used by existing seed data.
const DATABASE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class AvailabilityItemDto {
  @Matches(DATABASE_UUID) productId: string;
  @Matches(DATABASE_UUID) sizeId: string;
  @IsArray() @ArrayMaxSize(30) @ArrayUnique() @Matches(DATABASE_UUID, { each: true }) toppingIds: string[];
  @IsInt() @Min(1) @Max(99) quantity: number;
}
export class CheckAvailabilityDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100)
  @ValidateNested({ each: true }) @Type(() => AvailabilityItemDto)
  items: AvailabilityItemDto[];
}
