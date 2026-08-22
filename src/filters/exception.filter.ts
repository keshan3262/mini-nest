import { ValidationError } from 'class-validator';

import { Catch, ExceptionFilter } from '../decorators/filters';
import { HttpServerResponse, RequestEssentials } from '../types';
import { ZodError } from 'zod';
import { ErrorWithStatusCode } from '../errors';

@Catch()
export class DefaultExceptionFilter implements ExceptionFilter {
  catch(error: any, _request: RequestEssentials, response: HttpServerResponse): void {
    let validationErrors: (ValidationError | ZodError)[] = [];
    if (error instanceof ValidationError) {
      validationErrors = [error];
    } else if (error instanceof ZodError) {
      validationErrors = [error];
    } else if (Array.isArray(error) && error.every(e => e instanceof ValidationError || e instanceof ZodError)) {
      validationErrors = error;
    }

    if (validationErrors.length > 0) {
      response.statusCode = 400;
      response.write(JSON.stringify(
        validationErrors.flatMap(
          e => e instanceof ValidationError
            ? { property: e.property, constraints: e.constraints }
            : e.issues.map(({ path, code, message }) => ({ property: path.join('.'), constraints: { [code]: message } }))
          )
      ));

      return;
    }

    if (error instanceof ErrorWithStatusCode) {
      response.statusCode = error.statusCode;
      response.write(error.serializedResponse);

      return;
    }

    response.statusCode = 500;
    response.write(JSON.stringify({ message: 'Internal server error' }));
  }
}
