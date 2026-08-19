import 'reflect-metadata';
import http from 'node:http';
import { Container } from './container';
import { router } from './router';
import { Method } from './decorators/methods';
import { METHOD_PARAMS } from './tokens';
import { ValidationError } from 'class-validator';

export const container = new Container();

export const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '', 'http://localhost:3000');
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
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'Invalid JSON' }));

      return;
    }
  }

  const routeResolution = router.resolve(req.method as Method, pathname);

  if (!routeResolution) {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Not Found' }));

    return;
  }

  const { constructor: Controller, methodName, routeParams } = routeResolution;
  const controller = container.resolve(Controller) as any;
  const handler = controller[methodName];

  const { args, validationErrors } = resolveArgs(controller, methodName, body, routeParams, searchParams);

  if (validationErrors.length > 0) {
    res.statusCode = 400;
    res.end(JSON.stringify(validationErrors.map(e => ({ property: e.property, constraints: e.constraints }))));

    return;
  }

  try {
    const result = await handler.apply(controller, args);
    res.statusCode = 200;
    res.end(JSON.stringify(result));
  } catch {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Internal Server Error' }));
  }
}).listen(3000, () => {
  console.log('Server is running on port 3000');
});

const resolveArgs = (controller: object, methodName: string, body: any, routeParams: Record<string, string>, searchParams: URLSearchParams) => {
  let args: any[] = [];
  const argsResolutions = Reflect.getMetadata(METHOD_PARAMS, controller, methodName) ?? {};
  const validationErrors: ValidationError[] = [];
  for (const index in argsResolutions) {
    const i = Number(index);
    const resolution = argsResolutions[i];

    if (!resolution) {
      throw new Error(`Cannot resolve argument ${i} for method ${methodName} in controller ${controller.constructor.name}`);
    }

    switch (resolution.type) {
      case 'body':
        args[i] = body;
        break;
      case 'param':
        args[i] = routeParams[resolution.name];
        break;
      case 'query':
        args[i] = searchParams.get(resolution.name);
        break;
    }

    if (resolution.transform) {
      try {
        args[i] = resolution.transform.transform(args[i]);
      } catch (error) {
        if (Array.isArray(error) && error.every(e => e instanceof ValidationError)) {
          validationErrors.push(...error);
        } else if (error instanceof ValidationError) {
          error.property = resolution.name;
          validationErrors.push(error);
        } else {
          throw error;
        }
      }
    }
  }

  return { args, validationErrors };
};
