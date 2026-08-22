import { CanActivate } from '../decorators/guards';
import { Injectable } from '../decorators/injectable';
import { RequestEssentials } from '../types';

@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate({ headers }: RequestEssentials) {
    return Boolean(headers.get('Authorization') || headers.get('authorization'));
  }
}
