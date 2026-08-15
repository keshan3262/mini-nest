import { DEPENDENCIES } from '../tokens';

export interface MethodArgDependency {
  index: number;
  key: string | symbol | undefined;
  token: symbol | string;
}

export const Inject = (token: symbol | string): ParameterDecorator => (target, key, index) => {
  const dependencies = Reflect.getOwnMetadata(DEPENDENCIES, target) || [];
  dependencies.push({ index, key, token });
  Reflect.defineMetadata(DEPENDENCIES, dependencies, target);
};
