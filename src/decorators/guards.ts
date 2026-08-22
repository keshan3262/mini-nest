import { INJECTABLE, METHOD_GUARDS } from '../tokens';
import { RequestEssentials } from '../types';

export type Guards = Array<new () => CanActivate>;

export interface CanActivate {
  canActivate(request: RequestEssentials): Promise<boolean>;
}

export const UseGuards = (...guards: Guards): MethodDecorator => (target, propertyKey) => {
  if (propertyKey === undefined) {
    throw new Error(`UseGuards decorator can only be used on class methods (see ${target.constructor.name})`);
  }

  guards.forEach(guard => {
    const injectableMetadata = Reflect.getOwnMetadata(INJECTABLE, guard);

    if (!injectableMetadata) {
      throw new Error(`@Injectable is missing on ${guard.name}`);
    }
  })

  const methodGuards = Reflect.getMetadata(METHOD_GUARDS, target, propertyKey) ?? [];
  methodGuards.push(...guards);
  Reflect.defineMetadata(METHOD_GUARDS, methodGuards, target, propertyKey);
};
