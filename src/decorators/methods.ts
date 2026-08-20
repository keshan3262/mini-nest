import { CONTROLLER_ROUTES } from '../tokens';

export type Method = 'GET' | 'POST';

const methodFactory = (name: Method) => (path: string): MethodDecorator => (target, propertyKey) => {
  const controllerRoutes = Reflect.getMetadata(CONTROLLER_ROUTES, target.constructor) || {};

  if (controllerRoutes[name]?.[path]) {
    throw new Error(`Route ${name} ${path} already defined for ${target.constructor.name}`);
  }

  if (!controllerRoutes[name]) {
    controllerRoutes[name] = {};
  }

  controllerRoutes[name][path] = propertyKey;

  Reflect.defineMetadata(CONTROLLER_ROUTES, controllerRoutes, target.constructor);
};

export const Get = methodFactory('GET');
export const Post = methodFactory('POST');
