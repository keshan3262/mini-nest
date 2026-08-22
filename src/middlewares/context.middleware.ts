import { Middleware } from '../types';
import { randomUUID } from 'node:crypto';
import { RequestContext } from '../context/request-context';

export const contextMiddleware: Middleware = (req, res, next) => {
  const requestId = req.headers.get('x-request-id') ?? req.headers.get('X-Request-Id') ?? randomUUID();
  res.setHeader('x-request-id', requestId);
  RequestContext.als.run(requestId, () => next());
};
