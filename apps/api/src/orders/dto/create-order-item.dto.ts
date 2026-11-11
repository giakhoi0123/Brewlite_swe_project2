import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Regex định dạng UUID tương thích với PostgreSQL native UUID type và toàn bộ seed data:
 * - Chuẩn 32 ký tự hex với các dấu gạch ngang theo mẫu 8-4-4-4-12.
 * - Cho phép cả UUID seed (a000..., b000..., c000..., d000...) lẫn RFC-4122 v4 UUID.
 * - Thay thế @IsUUID(4) vốn sẽ từ chối seed ID hợp lệ của dự án.
 */
export const POSTGRES_UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * Custom Validator kiểm tra mảng selectedOptions không được chứa các phần tử trùng lặp.
 * Validator thuần logic, không phụ thuộc database.
 */
export function IsNoDuplicateOptions(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isNoDuplicateOptions',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          if (value === undefined || value === null) {
            return true;
          }
          if (!Array.isArray(value)) {
            return false;
          }
          const uniqueItems = new Set(value);
          return uniqueItems.size === value.length;
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} không được chứa các tùy chọn (options) trùng lặp trong cùng một món hàng`;
        },
      },
    });
  };
}

export class CreateOrderItemDto {
  @IsString({ message: 'productId phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'productId không được để trống' })
  @Matches(POSTGRES_UUID_REGEX, {
    message: 'productId phải là định dạng UUID hợp lệ',
  })
  productId: string;

  @IsInt({ message: 'quantity phải là số nguyên' })
  @Min(1, { message: 'quantity tối thiểu phải là 1' })
  quantity: number;

  @IsOptional()
  @IsArray({ message: 'selectedOptions phải là một mảng nếu được cung cấp' })
  @Matches(POSTGRES_UUID_REGEX, {
    each: true,
    message: 'Mỗi phần tử trong selectedOptions phải là định dạng UUID hợp lệ',
  })
  @IsNoDuplicateOptions()
  selectedOptions?: string[];

  @IsOptional()
  @IsString({ message: 'notes phải là chuỗi ký tự' })
  @MaxLength(500, { message: 'notes của món không được vượt quá 500 ký tự' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  notes?: string;
}
