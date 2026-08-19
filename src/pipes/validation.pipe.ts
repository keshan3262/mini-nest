import { ClassConstructor, plainToInstance } from 'class-transformer';
import { PipeTransform } from '../decorators/params';
import { validateSync } from 'class-validator';

export class ValidationPipe<T extends object> implements PipeTransform<unknown, T> {
  constructor(private readonly DtoClass: ClassConstructor<T>) {}

  transform(value: any) {
    const instance = plainToInstance(this.DtoClass, value);
    const errors = validateSync(instance);

    if (errors.length > 0) {
      throw errors;
    }

    return instance;
  }
}
