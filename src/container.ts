import 'reflect-metadata';
import { DEPENDENCIES, INJECTABLE } from './tokens';
import { InjectableOptions } from './decorators/injectable';
import { MethodArgDependency } from './decorators/inject';

type Constructor<T = unknown> = new (...args: any[]) => T;

export class Container {
  private readonly singletons: Map<symbol | string, unknown> = new Map();
  private readonly injectionProviders: Map<symbol | string, Constructor> = new Map();

  // TODO: implement kosher resolution with decorators
  bind<T>(token: symbol | string, provider: Constructor<T>): void {
    this.injectionProviders.set(token, provider);
  }

  resolve<T>(constructor: Constructor<T>, depsStack: string[] = []): T {
    if (depsStack.includes(constructor.name)) {
      throw new Error(`Circular dependency detected: ${depsStack.join(' -> ')} -> ${constructor.name}`);
    }

    const options = Reflect.getOwnMetadata(INJECTABLE, constructor) as InjectableOptions | undefined;

    if (!options) {
      throw new Error(`@Injectable is missing on ${constructor.name}`);
    }

    const { scope = 'singleton' } = options;

    if (scope === 'singleton' && this.singletons.has(constructor.name)) {
      return this.singletons.get(constructor.name) as T;
    }

    const deps = (Reflect.getMetadata('design:paramtypes', constructor) || []) as Constructor[];
    const resolvedDeps = deps.map((dep, index): any => {
      if (dep === Object) {
        const methodArgDeps = (Reflect.getOwnMetadata(DEPENDENCIES, constructor) ?? []) as MethodArgDependency[];
        const methodArgDep = methodArgDeps.find(({ index: depIndex, key }) => depIndex === index && key === undefined);

        if (!methodArgDep) {
          throw new Error(`@Inject is missing on ${constructor.name}#${index}, but the argument is an interface`);
        }

        const depToken = methodArgDep.token;
        const depConstructor = this.injectionProviders.get(depToken);

        if (!depConstructor) {
          throw new Error(`No provider found for ${depToken.toString()}`);
        }

        return this.resolve(depConstructor, [...depsStack, constructor.name]);
      }

      return this.resolve(dep, [...depsStack, constructor.name]);
    });

    const instance = new constructor(...resolvedDeps);

    if (scope === 'singleton') {
      this.singletons.set(constructor.name, instance);
    }

    return instance;
  }
}
