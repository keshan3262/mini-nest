import 'reflect-metadata';
import http, { ServerResponse } from 'node:http';

import { Container } from './container';
import { router, UserController } from './router';
import { Method } from './decorators/methods';
import { METHOD_GUARDS, METHOD_INTERCEPTORS, METHOD_PARAMS, FILTER_ERROR_TYPES, CONTROLLER_FILTERS } from './tokens';
import { ParamResolution } from './decorators/params';
import { Guards } from './decorators/guards';
import { BadRequestError, ErrorWithStatusCode, ForbiddenError, NotFoundError } from './errors';
import { Interceptors } from './decorators/interceptors';
import { from, Observable, of, switchMap, throwError } from 'rxjs';
import { ValidationContext } from './context/validation-context';
import { Errors, ExceptionFilters } from './decorators/filters';
import { Constructor, Middleware, RequestEssentials } from './types';
import { contextMiddleware } from './middlewares/context.middleware';

export const container = new Container();

const middlewaresByController = new Map<Constructor<any>, Middleware[]>([
  [UserController, [contextMiddleware]]
]);

export const createServer = (port = 3000) => http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '', `http://localhost:${port}`);
    const { pathname, searchParams } = url;
    const headers = new Headers(
      Object.entries(req.headers).flatMap(([key, value]): [string, string][] => {
        if (Array.isArray(value)) {
          return value.map(v => [key, v]);
        }

        return value === undefined ? [] : [[key, value]];
      })
    );
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
        throw new BadRequestError([{ property: 'body', constraints: { isJson: 'Must be valid JSON' } }]);
      }
    }

    const routeResolution = router.resolve(req.method as Method, pathname);

    if (!routeResolution) {
      throw new NotFoundError();
    }

    const { constructor: Controller, methodName, routeParams } = routeResolution;
    const controller = container.resolve(Controller) as any;
    const handler = controller[methodName];
    const middlewares = middlewaresByController.get(Controller) ?? [];

    const requestEssentials = { method: req.method!, url: url, headers, body };

    const makeFlowWithMiddlewares = (onSuccess: () => Promise<void>, startIndex = 0): () => Promise<void> => {
      if (startIndex === middlewares.length) {
        return onSuccess;
      }

      const middleware = middlewares[startIndex];
      const nextSuccess = makeFlowWithMiddlewares(onSuccess, startIndex + 1);

      return () => new Promise<void>((resolve, reject) => {
        middleware(requestEssentials, res, err => {
          if (err === undefined) {
            nextSuccess().then(resolve).catch(reject);
          } else {
            reject(err);
          }
        });
      })
    };
    await makeFlowWithMiddlewares(() => new Promise<void>((resolve, reject) => {
      guardsStage$(requestEssentials, controller, methodName).pipe(
        switchMap(() => {
          const interceptors: Interceptors = Reflect.getMetadata(METHOD_INTERCEPTORS, controller, methodName) ?? [];
          let handle: () => Observable<any> = () => from(Promise.resolve(
            handler.apply(controller, resolveArgs(controller, methodName, body, routeParams, searchParams))
          ));
          for (let i = interceptors.length - 1; i >= 0; i--) {
            const interceptorInstance = container.resolve(interceptors[i]);
            const prevHandle = handle;
            handle = () => from(interceptorInstance.intercept(requestEssentials, { handle: prevHandle }));
          }

          return handle();
        })
      ).subscribe({
        next: result => {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result));
          resolve();
        },
        error: reject
      })
    }))().catch(
      err => new Promise<void>(
        (resolve, reject) =>
          flowErrorHandler(err, requestEssentials, res, Controller, newError => {
            if (newError === undefined) {
              resolve();
            } else {
              reject(newError);
            }
          })
      )
    );
  } catch (error) {
    if (error instanceof ErrorWithStatusCode) {
      res.statusCode = error.statusCode;
      res.end(error.serializedResponse);
    } else {
      console.error(error);
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
  const totalValidationErrors: BadRequestError['responseBody'] = [];
  for (const index in argsResolutions) {
    const i = Number(index);
    const resolution = argsResolutions[i];

    if (!resolution) {
      throw new Error(`Cannot resolve argument ${i} for method ${methodName} in controller ${controller.constructor.name}`);
    }

    try {
      args[i] = resolveArgument(resolution, body, routeParams, searchParams);
    } catch (error) {
      if (error instanceof BadRequestError) {
        totalValidationErrors.push(...error.responseBody);
      } else {
        throw error;
      }
    }
  }

  if (totalValidationErrors.length > 0) {
    throw new BadRequestError(totalValidationErrors);
  }

  return args;
};

const resolveArgument = (
  resolution: ParamResolution,
  body: any,
  routeParams: Record<string, string>,
  searchParams: URLSearchParams
) => {
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
    const transform = resolution.transform;
    value = resolution.name
      ? ValidationContext.als.run(resolution.name, () => transform.transform(value))
      : transform.transform(value);
  }

  return value;
};

const guardsStage$ = (requestEssentials: RequestEssentials, controller: any, methodName: string) => {
  const guards: Guards = Reflect.getMetadata(METHOD_GUARDS, controller, methodName) ?? [];

  return from(Promise.allSettled(guards.map(async (Guard) => {
    const guardInstance = container.resolve(Guard);

    return await guardInstance.canActivate(requestEssentials);
  }))).pipe(
    switchMap(results => {
      const failedGuardResult = results.find(result => result.status === 'rejected');
      if (failedGuardResult) {
        return throwError(() => failedGuardResult.reason);
      }

      if (results.some(result => result.status === 'fulfilled' && !result.value)) {
        return throwError(() => new ForbiddenError());
      }

      return of(true);
    })
  );
};

const flowErrorHandler = (
  err: any,
  requestEssentials: RequestEssentials,
  res: ServerResponse,
  Controller: Constructor<any>,
  callback: (err?: any) => void) => {
  try {
    const exceptionFilters: ExceptionFilters = Reflect.getMetadata(CONTROLLER_FILTERS, Controller) ?? [];
    for (const Filter of exceptionFilters) {
      const filter = container.resolve(Filter);
      const errorsTypes: Errors | undefined = Reflect.getMetadata(FILTER_ERROR_TYPES, Filter);
      if (!errorsTypes) {
        console.warn(`Filter ${Filter.name} does not have any errors types metadata`);
        continue;
      }

      if (errorsTypes.length === 0 || errorsTypes.some(ErrorType => err instanceof ErrorType)) {
        filter.catch(err, requestEssentials, res);
        res.end();
        callback();

        return;
      }
    }
  } catch (error) {
    console.error(error);
    callback(error);

    return;
  }

  callback(err);
};
