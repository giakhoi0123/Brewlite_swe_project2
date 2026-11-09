import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CheckProductAvailabilityDto } from './check-product-availability.dto';

describe('CheckProductAvailabilityDto Validation', () => {
  it('passes validation for valid PostgreSQL UUIDs including version 0 seed IDs', async () => {
    const dto = plainToInstance(CheckProductAvailabilityDto, {
      selectedOptions: [
        'b0000000-0000-0000-0000-000000000001',
        'b0000000-0000-0000-0000-000000000003',
      ],
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('fails validation when selectedOptions is not an array', async () => {
    const dto = plainToInstance(CheckProductAvailabilityDto, {
      selectedOptions: 'not-an-array',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('selectedOptions');
  });

  it('fails validation when selectedOptions is empty', async () => {
    const dto = plainToInstance(CheckProductAvailabilityDto, {
      selectedOptions: [],
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints?.arrayNotEmpty).toBeDefined();
  });

  it('fails validation when an element is not a valid UUID format', async () => {
    const dto = plainToInstance(CheckProductAvailabilityDto, {
      selectedOptions: ['b0000000-0000-0000-0000-000000000001', 'not-a-uuid'],
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints?.matches).toBeDefined();
  });

  it('fails validation when selectedOptions contains duplicate IDs', async () => {
    const dto = plainToInstance(CheckProductAvailabilityDto, {
      selectedOptions: [
        'b0000000-0000-0000-0000-000000000001',
        'b0000000-0000-0000-0000-000000000001',
      ],
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints?.noDuplicates).toBeDefined();
  });

  it('fails validation when selectedOptions exceeds max 20 items', async () => {
    const items = Array.from({ length: 21 }, (_, i) => {
      const hex = i.toString(16).padStart(12, '0');
      return `b0000000-0000-0000-0000-${hex}`;
    });

    const dto = plainToInstance(CheckProductAvailabilityDto, {
      selectedOptions: items,
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints?.arrayMaxSize).toBeDefined();
  });
});
