import z from 'zod';

import { PipeTransform } from '../decorators/params';
import { ValidationContext } from '../context/validation-context';
import { BadRequestError } from '../errors';

export class PositiveIntPipe<T extends number | undefined> implements PipeTransform<string, T> {
  static readonly numberSchema = z.number().int().positive();

  constructor(readonly required: (undefined extends T ? false : true)) {}

  transform(value: string) {
    if (!this.required && !value) {
      return undefined as T;
    }

    const parsedValue = Number.parseInt(value);
    const validationResult = PositiveIntPipe.numberSchema.safeParse(parsedValue);

    if (!validationResult.success) {
      throw new BadRequestError([
        { property: ValidationContext.singleFieldName, constraints: { isPositiveInt: 'Must be a positive integer' } }
      ]);
    }

    return validationResult.data as T;
  }
}
