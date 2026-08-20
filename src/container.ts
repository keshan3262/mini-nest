import { DEPENDENCIES, INJECTABLE } from './tokens';
import { InjectableOptions } from './decorators/injectable';
import { MethodArgDependency } from './decorators/inject';

type Constructor<T = unknown> = new (...args: any[]) => T;

export class Container {
  private readonly singletons: Map<Constructor, unknown> = new Map();
  private readonly injectionProviders: Map<symbol | string, Constructor> = new Map();

  bind<T>(token: symbol | string, provider: Constructor<T>): void {
    this.injectionProviders.set(token, provider);
  }

  resolve<T>(constructor: Constructor<T>, depsStack: Constructor[] = []): T {
    if (depsStack.includes(constructor)) {
      throw new Error(`Circular dependency detected: ${depsStack.map(c => c.name).join(' -> ')} -> ${constructor.name}`);
    }

    const options = Reflect.getOwnMetadata(INJECTABLE, constructor) as InjectableOptions | undefined;

    if (!options) {
      throw new Error(`@Injectable is missing on ${constructor.name}`);
    }

    const { scope = 'singleton' } = options;

    if (scope === 'singleton' && this.singletons.has(constructor)) {
      return this.singletons.get(constructor) as T;
    }

    const deps = (Reflect.getMetadata('design:paramtypes', constructor) || []) as Constructor[];
    const resolvedDeps = deps.map((dep, index): any => {
      const methodArgDeps = (Reflect.getOwnMetadata(DEPENDENCIES, constructor) ?? []) as MethodArgDependency[];
      const injectedDep = methodArgDeps.find(({ index: depIndex, key }) => depIndex === index && key === undefined);

      if (dep === Object && !injectedDep) {
        throw new Error(`@Inject is missing on ${constructor.name}#${index}, but the argument is an interface`);
      }

      const injectedDepToken = injectedDep?.token;
      const injectedDepConstructor = injectedDepToken ? this.injectionProviders.get(injectedDepToken) : undefined;

      if (dep === Object && !injectedDepConstructor) {
        throw new Error(`No provider found for ${injectedDepToken?.toString() ?? 'Object'}`);
      }

      return this.resolve(injectedDepConstructor ?? dep, [...depsStack, constructor]);
    });

    const instance = new constructor(...resolvedDeps);

    if (scope === 'singleton') {
      this.singletons.set(constructor, instance);
    }

    return instance;
  }
}
