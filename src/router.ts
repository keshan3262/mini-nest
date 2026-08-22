import { z } from 'zod';

import { Controller } from './decorators/controller';
import { UseGuards } from './decorators/guards';
import { Injectable } from './decorators/injectable';
import { UseInterceptors } from './decorators/interceptors';
import { Get, Method, Post } from './decorators/methods';
import { Body, Param, Query } from './decorators/params';
import { AuthGuard } from './guards/auth.guard';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { PositiveIntPipe } from './pipes/positive-int.pipe';
import { CONTROLLER_PREFIX, CONTROLLER_ROUTES } from './tokens';
import { ZodValidationPipe } from './pipes/zod-validation.pipe';
import { Constructor } from './types';
import { UseFilters } from './decorators/filters';
import { DefaultExceptionFilter } from './filters/exception.filter';

@Injectable()
export class UserService {
  private dummyUsers = [
    { id: 1, name: 'John Doe', email: 'john.doe@example.com', age: 20 },
    { id: 42, name: 'Jane Doe', email: 'jane.doe@example.com', age: 21 },
    { id: 100, name: 'John Smith', email: 'john.smith@example.com', age: 22 },
    { id: 101, name: 'Jane Smith', email: 'jane.smith@example.com', age: 23 },
    { id: 102, name: 'John Doe', email: 'john.doe@example.com', age: 24 },
    { id: 103, name: 'Jane Doe', email: 'jane.doe@example.com', age: 25 },
    { id: 104, name: 'John Smith', email: 'john.smith@example.com', age: 26 },
    { id: 105, name: 'Jane Smith', email: 'jane.smith@example.com', age: 27 },
    { id: 106, name: 'John Doe', email: 'john.doe@example.com', age: 28 },
    { id: 107, name: 'Jane Doe', email: 'jane.doe@example.com', age: 29 },
    { id: 108, name: 'John Smith', email: 'john.smith@example.com', age: 30 }
  ];

  async getUsers(limit?: number) {
    return this.dummyUsers.slice(0, limit);
  }

  addUser(user: CreateUserDto) {
    return { ...user, id: this.dummyUsers.at(-1)!.id + 1 };
  }

  getUser(id: number) {
    return this.dummyUsers.find(user => user.id === id);
  }
}

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.email(),
  age: z.int().min(16)
});
type CreateUserDto = z.infer<typeof createUserSchema>;

@Controller('users')
@UseFilters(DefaultExceptionFilter)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get(':id')
  @UseInterceptors(LoggingInterceptor)
  getUser(@Param('id', new PositiveIntPipe<number>(true)) id: number) {
    return this.userService.getUser(id) ?? null;
  }

  @Get('/')
  @UseGuards(AuthGuard)
  @UseInterceptors(LoggingInterceptor)
  getUsers(@Query('limit', new PositiveIntPipe(false)) limit?: number) {
    return this.userService.getUsers(limit);
  }

  @Post('/')
  @UseInterceptors(LoggingInterceptor)
  addUser(@Body(new ZodValidationPipe(createUserSchema)) user: CreateUserDto) {
    return this.userService.addUser(user);
  }
}

const trimSlashes = (path: string) => {
  let start = 0;
  let end = path.length;
  while (start < end && path[start] === '/') {
    start++;
  }
  while (end > start && path[end - 1] === '/') {
    end--;
  }
  return path.slice(start, end);
};

class Router {
  private routeMap: Map<Method, Map<string, { constructor: Constructor, methodName: string }>> = new Map();

  constructor(readonly controllers: Constructor[]) {
    controllers.forEach(controller => {
      const prefix = Reflect.getMetadata(CONTROLLER_PREFIX, controller);

      if (!prefix) {
        throw new Error(`@Controller is missing on ${controller.name}`);
      }

      const controllerRoutes = Reflect.getMetadata(CONTROLLER_ROUTES, controller) ?? {};

      for (const [methodName, methodRoutes] of Object.entries(controllerRoutes)) {
        for (const [path, handlerName] of Object.entries(methodRoutes as Record<string, string>)) {
          const typedMethodName = methodName as Method;
          let sameMethodRoutes = this.routeMap.get(typedMethodName);
          if (!sameMethodRoutes) {
            sameMethodRoutes = new Map();
            this.routeMap.set(typedMethodName, sameMethodRoutes);
          }
          let pathAfterPrefix = trimSlashes(path);
          if (pathAfterPrefix) {
            pathAfterPrefix = `/${pathAfterPrefix}`;
          }
          const fullPath = `${trimSlashes(prefix)}${pathAfterPrefix}`;
          sameMethodRoutes.set(fullPath, { constructor: controller, methodName: handlerName });
        }
      }
    });
  }

  resolve(method: Method, path: string) {
    path = trimSlashes(path);
    const sameMethodRoutes = this.routeMap.get(method);

    if (!sameMethodRoutes) {
      return undefined;
    }

    const exactMatch = sameMethodRoutes.get(path);

    if (exactMatch) {
      return { ...exactMatch, routeParams: {} };
    }

    const segments = path.split('/');
    for (const [wildcard, resolution] of sameMethodRoutes.entries()) {
      const wildcardSegments = wildcard.split('/');

      // TODO: Implement matching * and ** wildcards
      if (wildcardSegments.length !== segments.length) {
        continue;
      }

      let isMatch = true;
      const routeParams: Record<string, string> = {};
      for (let i = 0; i < segments.length; i++) {
        const wildcardSegment = wildcardSegments[i];
        const segment = segments[i];

        if (!wildcardSegment.startsWith(':') && wildcardSegment !== segment) {
          isMatch = false;
          break;
        }

        if (wildcardSegment.startsWith(':')) {
          routeParams[wildcardSegment.slice(1)] = segment;
        }
      }

      if (isMatch) {
        return { ...resolution, routeParams };
      }
    }

    return undefined;
  }
}

export const router = new Router([UserController]);
