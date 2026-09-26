import { Observable } from 'rxjs';
import { RequestEssentials } from '../types';
import { METHOD_INTERCEPTORS } from '../tokens';

export interface CallHandler<T = any> {
  handle(): Observable<T>;
}

export interface Interceptor<T = any, R = any> {
  intercept(request: RequestEssentials, next: CallHandler<T>): Observable<R> | Promise<Observable<R>>;
}

export type Interceptors = Array<new () => Interceptor>;

export const UseInterceptors = (...interceptors: Interceptors): MethodDecorator => (target, propertyKey) => {
  if (propertyKey === undefined) {
    throw new Error(`UseInterceptors decorator can only be used on class methods (see ${target.constructor.name})`);
  }

  const methodInterceptors = Reflect.getMetadata(METHOD_INTERCEPTORS, target, propertyKey) ?? [];
  methodInterceptors.push(...interceptors);
  Reflect.defineMetadata(METHOD_INTERCEPTORS, methodInterceptors, target, propertyKey);
};
