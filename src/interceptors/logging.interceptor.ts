import { tap } from 'rxjs';
import { CallHandler, Interceptor } from '../decorators/interceptors';
import { RequestEssentials } from '../types';
import { Injectable } from '../decorators/injectable';

@Injectable()
export class LoggingInterceptor implements Interceptor {
  intercept(request: RequestEssentials, next: CallHandler) {
    const t0 = Date.now();

    return next.handle().pipe(
      tap(() => console.log(`${request.method} ${request.url.pathname} — ${Date.now() - t0}ms`))
    );
  }
}
