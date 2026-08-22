import { ZodType } from "zod";
import { PipeTransform } from "../decorators/params";

export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      throw result.error;
    }

    return result.data;
  }
}
