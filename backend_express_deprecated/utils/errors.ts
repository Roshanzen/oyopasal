import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export class ApiError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor(statusCode: number, message: string, code = 'API_ERROR', details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export interface RequestWithContext extends Request {
  requestId?: string;
}

export function requestLoggerMiddleware(req: RequestWithContext, res: Response, next: NextFunction) {
  const requestId = req.headers['x-request-id']?.toString() || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  const startedAt = Date.now();
  res.on('finish', () => {
    if (req.path.startsWith('/api/')) {
      const durationMs = Date.now() - startedAt;
      console.log(
        JSON.stringify({
          level: res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
          requestId,
          method: req.method,
          path: req.originalUrl,
          status: res.statusCode,
          durationMs,
        })
      );
    }
  });
  next();
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function errorHandlerMiddleware(
  err: unknown,
  req: RequestWithContext,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      detail: err.message,
      error: err.message,
      code: err.code,
      details: err.details,
      requestId: req.requestId,
    });
  }

  const message = err instanceof Error ? err.message : 'Internal server error';
  console.error('Unhandled API error:', { requestId: req.requestId, message, err });
  return res.status(500).json({
    detail: message,
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    requestId: req.requestId,
  });
}
