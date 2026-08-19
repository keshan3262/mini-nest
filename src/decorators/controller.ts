import { CONTROLLER_PREFIX } from '../tokens';
import { Injectable } from './injectable';

export const Controller = (prefix: string): ClassDecorator => target => {
  Injectable()(target);
  Reflect.defineMetadata(CONTROLLER_PREFIX, prefix, target);
};
