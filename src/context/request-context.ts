import { AsyncLocalStorage } from "node:async_hooks";

export class RequestContext {
  static readonly als = new AsyncLocalStorage<string>();

  static get requestId() {
    return RequestContext.als.getStore();
  }
}
