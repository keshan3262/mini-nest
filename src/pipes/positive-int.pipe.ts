import { ValidationError } from 'class-validator';
import { PipeTransform } from '../decorators/params';

export class PositiveIntPipe<T extends number | undefined> implements PipeTransform<string, T> {
  constructor(readonly required: (undefined extends T ? false : true)) {}

  transform(value: string) {
    if (!this.required && !value) {
      return undefined as T;
    }

    const id = Number.parseInt(value);

    if (Number.isNaN(id) || id < 1) {
      const error = new ValidationError();
      error.constraints = { isPositiveInt: 'Must be a positive integer' };
      throw error;
    }

    return id as T;
  }
}
