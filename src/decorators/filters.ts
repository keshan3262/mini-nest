import { Constructor, HttpServerResponse, RequestEssentials } from '../types';
import { CONTROLLER_FILTERS, FILTER_ERROR_TYPES } from '../tokens';
import { Injectable } from './injectable';

export interface ExceptionFilter {
  catch(error: any, request: RequestEssentials, response: HttpServerResponse): void;
}

export type ExceptionFilters = Array<new () => ExceptionFilter>;

export type Errors = Array<Constructor<any> | Abstract<any>>;

interface Abstract<T> extends Function {
  prototype: T;
}

export const Catch = (...errors: Errors): ClassDecorator => (target) => {
  Injectable()(target);
  const controllerFilters = Reflect.getMetadata(FILTER_ERROR_TYPES, target) ?? [];
  controllerFilters.push(...errors);
  Reflect.defineMetadata(FILTER_ERROR_TYPES, controllerFilters, target);
};

export const UseFilters = (...filters: ExceptionFilters): ClassDecorator => (target) => {
  const controllerFilters = Reflect.getMetadata(CONTROLLER_FILTERS, target) ?? [];
  controllerFilters.push(...filters);
  Reflect.defineMetadata(CONTROLLER_FILTERS, controllerFilters, target);
};
