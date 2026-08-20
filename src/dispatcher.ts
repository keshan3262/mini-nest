import 'reflect-metadata';
import http from 'node:http';
import { Container } from './container';
import { router } from './router';
import { Method } from './decorators/methods';
import { METHOD_PARAMS } from './tokens';
import { ValidationError } from 'class-validator';
import { ParamResolution } from './decorators/params';

export const container = new Container();

abstract class ErrorWithStatusCode extends Error {
  abstract readonly statusCode: number;
  readonly response: string;

  protected abstract getMessage(): string;

  constructor(responseBody: any) {
    const response = JSON.stringify(responseBody);
    super();
    this.response = response;
    this.message = this.getMessage();
  }
}

class BadRequestError extends ErrorWithStatusCode {
  statusCode = 400;

  protected getMessage(): string {
    return `${this.statusCode} Bad Request: ${this.response}`;
  }
}

class NotFoundError extends ErrorWithStatusCode {
  statusCode = 404;

  constructor() {
    super({ error: 'Not Found' });
  }

  protected getMessage(): string {
    return `${this.statusCode} Not Found`;
  }
}

export const createServer = (port = 3000) => http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '', `http://localhost:${port}`);
    const { pathname, searchParams } = url;
    let body: any;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const rawBody = await new Promise<string>((resolve) => {
        let rawBodyPart = '';
        req.on('data', (chunk) => {
          rawBodyPart += chunk;
        });
        req.on('end', () => {
          resolve(rawBodyPart);
        });
      });

      try {
        body = JSON.parse(rawBody);
      } catch (error) {
        throw new BadRequestError({ error: 'Invalid JSON' });
      }
    }

    const routeResolution = router.resolve(req.method as Method, pathname);

    if (!routeResolution) {
      throw new NotFoundError();
    }

    const { constructor: Controller, methodName, routeParams } = routeResolution;
    const controller = container.resolve(Controller) as any;
    const handler = controller[methodName];

    const args = resolveArgs(controller, methodName, body, routeParams, searchParams);
    const result = await handler.apply(controller, args);
    res.statusCode = 200;
    res.end(JSON.stringify(result));
  } catch (error) {
    if (error instanceof ErrorWithStatusCode) {
      res.statusCode = error.statusCode;
      res.end(error.response);
    } else {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'Internal Server Error' }));
    }
  }
}).listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

const resolveArgs = (
  controller: object,
  methodName: string,
  body: any,
  routeParams: Record<string, string>,
  searchParams: URLSearchParams
) => {
  let args: any[] = [];
  const argsResolutions = Reflect.getMetadata(METHOD_PARAMS, controller, methodName) ?? {};
  const totalValidationErrors: ValidationError[] = [];
  for (const index in argsResolutions) {
    const i = Number(index);
    const resolution = argsResolutions[i];

    if (!resolution) {
      throw new Error(`Cannot resolve argument ${i} for method ${methodName} in controller ${controller.constructor.name}`);
    }

    const { validationErrors, value } = resolveArgument(resolution, body, routeParams, searchParams);

    if (validationErrors.length > 0) {
      totalValidationErrors.push(...validationErrors);
    } else {
      args[i] = value;
    }
  }

  if (totalValidationErrors.length > 0) {
    throw new BadRequestError(totalValidationErrors.map(e => ({ property: e.property, constraints: e.constraints })));
  }

  return args;
};

const resolveArgument = (
  resolution: ParamResolution,
  body: any,
  routeParams: Record<string, string>,
  searchParams: URLSearchParams
) => {
  let validationErrors: ValidationError[] = [];
  let value: any;

  switch (resolution.type) {
    case 'body':
      value = body;
      break;
    case 'param':
      value = routeParams[resolution.name];
      break;
    case 'query':
      value = searchParams.get(resolution.name);
      break;
  }

  if (resolution.transform) {
    try {
      value = resolution.transform.transform(value);
    } catch (error) {
      if (Array.isArray(error) && error.every(e => e instanceof ValidationError)) {
        validationErrors = error;
      } else if (error instanceof ValidationError) {
        if (resolution.name) {
          error.property = resolution.name;
        }
        validationErrors.push(error);
      } else {
        throw error;
      }
    }
  }

  return { validationErrors, value };
}