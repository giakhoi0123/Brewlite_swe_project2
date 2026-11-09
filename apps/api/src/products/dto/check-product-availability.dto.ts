import {
  IsArray,
  ArrayNotEmpty,
  ArrayMaxSize,
  IsString,
  Matches,
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Standard PostgreSQL UUID regex (8-4-4-4-12 hex format).
 * Unlike RFC 4122 v4 validator, this accepts version 0 nibble used in seed fixtures.
 */
export const POSTGRES_UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@ValidatorConstraint({ name: 'noDuplicates', async: false })
export class NoDuplicatesConstraint implements ValidatorConstraintInterface {
  validate(items: unknown[]): boolean {
    if (!Array.isArray(items)) return true;
    return new Set(items).size === items.length;
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} không được chứa tùy chọn trùng lặp`;
  }
}

export function NoDuplicates(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: NoDuplicatesConstraint,
    });
  };
}

export class CheckProductAvailabilityDto {
  @IsArray({ message: 'selectedOptions phải là một mảng' })
  @ArrayNotEmpty({ message: 'selectedOptions không được rỗng' })
  @ArrayMaxSize(20, { message: 'selectedOptions không được vượt quá 20 tùy chọn' })
  @IsString({ each: true, message: 'Mỗi tùy chọn trong selectedOptions phải là chuỗi' })
  @Matches(POSTGRES_UUID_REGEX, {
    each: true,
    message: 'Mỗi tùy chọn phải là định dạng UUID hợp lệ (8-4-4-4-12 hex)',
  })
  @NoDuplicates({ message: 'selectedOptions không được chứa tùy chọn trùng lặp' })
  selectedOptions: string[];
}

export class ProductAvailabilityResponseDto {
  productId: string;
  availableStock: number;
  canOrder: boolean;
}
