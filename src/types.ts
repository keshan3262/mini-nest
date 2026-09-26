import type { IncomingMessage, ServerResponse } from 'node:http';

export type RequestEssentials = Pick<Request, 'method' | 'headers' | 'body'> & { url: URL };

export type Constructor<T = unknown> = new (...args: any[]) => T;

export type HttpServerResponse = ServerResponse<IncomingMessage>;

export type Middleware = (req: RequestEssentials, res: HttpServerResponse, next: (err?: any) => void) => void;
