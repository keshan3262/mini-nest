import { INJECTABLE } from '../tokens';

export interface InjectableOptions {
  scope?: 'singleton' | 'transient';
}

export const Injectable = (options: InjectableOptions = {}): ClassDecorator => target => {
  Reflect.defineMetadata(INJECTABLE, options, target);
};
