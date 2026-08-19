import { METHOD_PARAMS } from "../tokens";

export interface PipeTransform<T = any, R = any> {
  transform(value: T): R;
}

const paramFactory = <T extends unknown[]>(
  type: string,
  paramResolutionFn: (...args: T) => { type: string; [k: string]: any }
) => (...args: T): ParameterDecorator => (target, propertyKey, index) => {
  if (propertyKey === undefined) {
    throw new Error(`${type} decorator can only be used on class methods (see ${target.constructor.name})`);
  }

  const methodParams = Reflect.getMetadata(METHOD_PARAMS, target, propertyKey) ?? {};

  methodParams[index] = paramResolutionFn(...args);

  Reflect.defineMetadata(METHOD_PARAMS, methodParams, target, propertyKey);
};

export const Body = paramFactory('body', (transform?: PipeTransform) => ({ type: 'body', transform }));
export const Param = paramFactory(
  'param',
  (name: string, transform?: PipeTransform) => ({ type: 'param', name, transform })
);
export const Query = paramFactory('query', (name: string, transform?: PipeTransform) => ({ type: 'query', name, transform }));
