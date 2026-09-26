import { tap } from 'rxjs';
import { RequestContext } from '../src/context/request-context';
import { container, createServer } from '../src/dispatcher';
import { AuthGuard } from '../src/guards/auth.guard';
import { LoggingInterceptor } from '../src/interceptors/logging.interceptor';
import * as contextMiddlewareModule from '../src/middlewares/context.middleware';
import { UserController, UserService } from '../src/router';
import { METHOD_PARAMS } from '../src/tokens';

jest.mock('../src/middlewares/context.middleware', () => {
  const actual = jest.requireActual('../src/middlewares/context.middleware');
  return {
    ...actual,
    contextMiddleware: jest.fn(actual.contextMiddleware),
  };
});

const originalContextMiddleware = jest.requireActual<typeof contextMiddlewareModule>(
  '../src/middlewares/context.middleware'
).contextMiddleware;

describe('server', () => {
  let spies: Array<Pick<jest.SpyInstance, 'mockRestore'>> = [];
  let mocks: jest.Mock[] = [];
  const port = 3001;
  const baseUrl = `http://localhost:${port}`;
  const server = createServer(port);

  const makeLogTimeTestFn = (
    controller: any,
    methodName: string,
    httpMethod: string,
    reqPath: string,
    reqInit?: RequestInit
  ) => async () => {
    const originalMethod = controller[methodName];
    const methodSpy = jest.spyOn(controller, methodName);
    const consoleLogSpy = jest.spyOn(console, 'log');
    spies.push(methodSpy, consoleLogSpy);
    methodSpy.mockImplementation(async (...args) => {
      await new Promise(resolve => setTimeout(resolve, 10));
      return originalMethod.apply(controller, args);
    });
    await fetch(`${baseUrl}${reqPath}`, reqInit);
    const matchingLogCall = consoleLogSpy.mock.calls.find(call => call[0].includes(`${httpMethod} ${reqPath}`));
    expect(matchingLogCall).toBeDefined();
    const match = new RegExp(`${httpMethod} ${reqPath} — (\\d+)ms`).exec(matchingLogCall![0]);
    expect(match).toBeTruthy();
    expect(parseInt(match![1])).toBeGreaterThanOrEqual(10);
  };

  beforeAll(async () => {
    await new Promise<void>(resolve => {
      if (server.listening) {
        resolve();
      } else {
        server.once('listening', resolve);
      }
    });
  });

  describe('unknown route', () => {
    test.each(['/user', '/users/user/42'])('should return 404 for %s', async (path) => {
      const response = await fetch(`${baseUrl}${path}`);
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body).toEqual({ error: 'Not Found' });
    });
  });

  describe('GET /users', () => {
    const authorizedRequestInit: RequestInit = { headers: { Authorization: 'Bearer 123' } };

    it('should return 403 if the user is not authenticated', async () => {
      const response = await fetch(`${baseUrl}/users`);
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body).toEqual({ error: 'Forbidden' });
    });

    it('should return all users by default', async () => {
      const response = await fetch(`${baseUrl}/users`, authorizedRequestInit);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toHaveLength(11);
    });

    it('should return a limited number of users if a limit is provided', async () => {
      const response = await fetch(`${baseUrl}/users?limit=5`, authorizedRequestInit);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toHaveLength(5);
    });

    it('should call UserController.getUsers with the limit if provided', async () => {
      const getUsersSpy = jest.spyOn(container.resolve(UserController), 'getUsers');
      spies.push(getUsersSpy);
      await fetch(`${baseUrl}/users?limit=5`, authorizedRequestInit);
      expect(getUsersSpy).toHaveBeenCalledWith(5);
    });

    test.each(['invalid', '0'])('should return 400 if the limit is "%s"', async (limit) => {
      const response = await fetch(`${baseUrl}/users?limit=${limit}`, authorizedRequestInit);
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body).toEqual([{ property: 'limit', constraints: { isPositiveInt: 'Must be a positive integer' } }]);
    });

    it(
      'should log the response time',
      makeLogTimeTestFn(container.resolve(UserController), 'getUsers', 'GET', '/users', authorizedRequestInit)
    );
  });

  describe('GET /users/:id', () => {
    it('should return 400 if the id is invalid', async () => {
      const response = await fetch(`${baseUrl}/users/invalid`);
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body).toEqual([{ property: 'id', constraints: { isPositiveInt: 'Must be a positive integer' } }]);
    });

    it('should return null if the user does not exist', async () => {
      const response = await fetch(`${baseUrl}/users/666`);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toBeNull();
    });

    it('should return the user if it exists', async () => {
      const response = await fetch(`${baseUrl}/users/42`);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({ id: 42, name: 'Jane Doe', email: 'jane.doe@example.com', age: 21 });
    });

    it('should call UserController.getUser with the id', async () => {
      const getUserSpy = jest.spyOn(container.resolve(UserController), 'getUser');
      spies.push(getUserSpy);
      await fetch(`${baseUrl}/users/42`);
      expect(getUserSpy).toHaveBeenCalledWith(42);
    });

    it(
      'should log the response time',
      makeLogTimeTestFn(container.resolve(UserController), 'getUser', 'GET', '/users/42')
    );
  });

  describe('POST /users', () => {
    const validBody = { name: 'John Doe', email: 'john.doe@example.com', age: 16 };

    it('should respond with error code 400 and all missing fields if the body is an empty object', async () => {
      const response = await fetch(`${baseUrl}/users`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body).toEqual([
        {
          property: 'name',
          constraints: {
            invalid_type: "Invalid input: expected string, received undefined"
          }
        },
        { property: 'email', constraints: { invalid_type: "Invalid input: expected string, received undefined" } },
        {
          property: 'age',
          constraints: { invalid_type: "Invalid input: expected number, received undefined" }
        }
      ]);
    });

    test.each([
      {
        reqBody: { ...validBody, name: 'J' },
        resBody: [{ property: 'name', constraints: { too_small: 'Too small: expected string to have >=2 characters' } }]
      },
      {
        reqBody: { ...validBody, email: 'invalid' },
        resBody: [{ property: 'email', constraints: { invalid_format: 'Invalid email address' } }]
      },
      {
        reqBody: { ...validBody, age: 15 },
        resBody: [{ property: 'age', constraints: { 'too_small': 'Too small: expected number to be >=16' } }]
      }
    ])(
      'should respond with error code 400 and an error for invalid field "$resBody.0.property"',
      async ({ reqBody, resBody }) => {
        const response = await fetch(`${baseUrl}/users`, {
          method: 'POST',
          body: JSON.stringify(reqBody),
        });
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body).toEqual(resBody);
      }
    );

    it('should return a new user if the body is valid', async () => {
      const response = await fetch(`${baseUrl}/users`, {
        method: 'POST',
        body: JSON.stringify(validBody),
      });
      expect(response.status).toBe(200);
      const { id, ...restProps } = await response.json();
      expect(id).toBeGreaterThan(0);
      expect(restProps).toEqual(validBody);
    });

    it(
      'should log the response time',
      makeLogTimeTestFn(container.resolve(UserController), 'addUser', 'POST', '/users', {
        method: 'POST',
        body: JSON.stringify(validBody)
      })
    );
  });

  describe('context middleware', () => {
    it('should respond with "x-request-id" header defined in the request', async () => {
      const response = await fetch(`${baseUrl}/users`, { headers: { 'x-request-id': '123' } });
      expect(response.headers.get('x-request-id')).toBe('123');
    });

    it('should respond with a generated "x-request-id" header if not provided', async () => {
      const response = await fetch(`${baseUrl}/users`);
      expect(response.headers.get('x-request-id')).toMatch(/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/);
    });

    it('should put the request id into ALS', async () => {
      const userService = container.resolve(UserService);
      const originalGetUser = userService.getUser;
      let actualRequestId: string | undefined;
      const getUserMock = jest.fn().mockImplementation(async (id: number) => {
        actualRequestId = RequestContext.requestId;
        return originalGetUser.apply(userService, [id]);
      });
      userService.getUser = getUserMock;
      mocks.push(getUserMock);
      await fetch(`${baseUrl}/users/42`, { headers: { 'x-request-id': '1234' } });
      expect(actualRequestId).toBe('1234');
    });

    it('should not mix requests ids between requests', async () => {
      const userService = container.resolve(UserService);
      const originalGetUser = userService.getUser;
      const actualRequestIds: (string | undefined)[] = [];
      const getUserMock = jest.fn().mockImplementation(async (id: number) => {
        actualRequestIds.push(RequestContext.requestId);
        return originalGetUser.apply(userService, [id]);
      });
      userService.getUser = getUserMock;
      mocks.push(getUserMock);
      const expectedRequestIds = Array(10).fill(undefined).map((_, i) => String(i));
      await Promise.all(expectedRequestIds.map((requestId) =>
        fetch(`${baseUrl}/users/42`, { headers: { 'x-request-id': requestId } })
      ));
      expect(actualRequestIds.sort()).toEqual(expectedRequestIds);
    });
  });

  describe('exception filter', () => {
    it('should respond with default 500 status code if an unexpected error in handler occurs', async () => {
      const userController = container.resolve(UserController);
      const originalGetUser = userController.getUser;
      const getUserMock = jest.fn().mockImplementation(async (id: number) => {
        throw new Error('Unexpected error');
      });
      userController.getUser = getUserMock;
      mocks.push(getUserMock);
      const response = await fetch(`${baseUrl}/users/42`);
      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body).toEqual({ message: 'Internal server error' });
    });
  })

  describe('stages execution order', () => {
    const setupSpies = (stagesExecutionOrder: string[]) => {
      const contextMiddlewareSpy = jest.mocked(contextMiddlewareModule.contextMiddleware);
      contextMiddlewareSpy.mockImplementation((req, res, next) => {
        stagesExecutionOrder.push('middleware');

        originalContextMiddleware(req, res, next);
      });
      const authGuard = container.resolve(AuthGuard);
      const originalCanActivate = authGuard.canActivate;
      const authGuardSpy = jest.spyOn(authGuard, 'canActivate');
      authGuardSpy.mockImplementation(async (req) => {
        stagesExecutionOrder.push('guard');
        return originalCanActivate.apply(authGuard, [req]);
      });
      const loggingInterceptor = container.resolve(LoggingInterceptor);
      const interceptSpy = jest.spyOn(loggingInterceptor, 'intercept');
      interceptSpy.mockImplementation((_req, next) => {
        stagesExecutionOrder.push('interceptor:before');

        return next.handle().pipe(
          tap(() => stagesExecutionOrder.push('interceptor:after'))
        );
      });
      const controller = container.resolve(UserController);
      const pipeTransform = Reflect.getMetadata(METHOD_PARAMS, controller, 'getUsers')[0].transform;
      const originalTransform = pipeTransform.transform;
      const pipeTransformSpy = jest.spyOn(pipeTransform, 'transform');
      pipeTransformSpy.mockImplementation((value) => {
        stagesExecutionOrder.push('pipe');

        return originalTransform.apply(pipeTransform, [value]);
      });
      const originalGetUsers = controller.getUsers;
      const getUsersSpy = jest.spyOn(controller, 'getUsers');
      getUsersSpy.mockImplementation((...args) => {
        stagesExecutionOrder.push('handler');

        return originalGetUsers.apply(controller, args);
      });
      spies.push(
        {
          mockRestore: () => {
            contextMiddlewareSpy.mockImplementation(originalContextMiddleware);
          },
        },
        authGuardSpy,
        interceptSpy,
        pipeTransformSpy,
        getUsersSpy
      );
    };

    it('should execute all stages in the correct order if there are no errors', async () => {
      const stagesExecutionOrder: string[] = [];
      setupSpies(stagesExecutionOrder);
      await fetch(`${baseUrl}/users?limit=5`, { headers: { Authorization: 'Bearer 123' } });
      expect(stagesExecutionOrder).toEqual([
        'middleware',
        'guard',
        'interceptor:before',
        'pipe',
        'handler',
        'interceptor:after'
      ])
    });

    it('guard should prevent execution if it returns false', async () => {
      const stagesExecutionOrder: string[] = [];
      setupSpies(stagesExecutionOrder);
      await fetch(`${baseUrl}/users?limit=5`);
      expect(stagesExecutionOrder).toEqual([
        'middleware',
        'guard',
      ]);
    });
  });

  afterEach(() => {
    if (spies.length > 0) {
      spies.forEach(spy => spy.mockRestore());
      spies = [];
    }
    if (mocks.length > 0) {
      mocks.forEach(mock => mock.mockRestore());
      mocks = [];
    }
  });

  afterAll(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
  });
});
