import { AsyncLocalStorage } from "node:async_hooks"

export class ValidationContext {
  static readonly als = new AsyncLocalStorage<string>();

  static get singleFieldName() {
    return ValidationContext.als.getStore() ?? 'value';
  }
}