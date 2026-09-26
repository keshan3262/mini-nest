import type { ValidationError } from 'class-validator';

export abstract class ErrorWithStatusCode extends Error {
  abstract readonly statusCode: number;
  readonly serializedResponse: string;

  protected abstract getMessage(): string;

  constructor(responseBody: any) {
    const serializedResponse = JSON.stringify(responseBody);
    super();
    this.serializedResponse = serializedResponse;
    this.message = this.getMessage();
  }
}

export class BadRequestError extends ErrorWithStatusCode {
  statusCode = 400;

  constructor(public readonly responseBody: Array<Pick<ValidationError, 'property' | 'constraints'>>) {
    super(responseBody);
  }

  protected getMessage(): string {
    return `${this.statusCode} Bad Request: ${this.serializedResponse}`;
  }
}

export class ForbiddenError extends ErrorWithStatusCode {
  statusCode = 403;

  constructor() {
    super({ error: 'Forbidden' });
  }

  protected getMessage(): string {
    return `${this.statusCode} Forbidden`;
  }
}

export class NotFoundError extends ErrorWithStatusCode {
  statusCode = 404;

  constructor() {
    super({ error: 'Not Found' });
  }

  protected getMessage(): string {
    return `${this.statusCode} Not Found`;
  }
}
