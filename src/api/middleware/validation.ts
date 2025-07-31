import { Request, Response, NextFunction } from 'express';

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export class APIError extends Error {
  public statusCode: number;
  public errors?: ValidationError[];

  constructor(message: string, statusCode: number = 500, errors?: ValidationError[]) {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
    this.errors = errors;
  }
}

export function validationMiddleware(req: Request, res: Response, next: NextFunction): void {
  try {
    // Basic request validation
    if (req.method === 'POST' && req.path === '/api/authorize-fill') {
      validateAuthorizeFillRequest(req);
    }
    
    // Sanitize common inputs
    sanitizeRequest(req);
    
    next();
  } catch (error) {
    next(error);
  }
}

function validateAuthorizeFillRequest(req: Request): void {
  const errors: ValidationError[] = [];
  const { orderHash, fillAmount, takerAddress } = req.body;

  // Validate orderHash
  if (!orderHash) {
    errors.push({ field: 'orderHash', message: 'Order hash is required' });
  } else if (typeof orderHash !== 'string') {
    errors.push({ field: 'orderHash', message: 'Order hash must be a string', value: orderHash });
  } else if (!/^0x[a-fA-F0-9]{64}$/.test(orderHash)) {
    errors.push({ field: 'orderHash', message: 'Order hash must be a valid 32-byte hex string', value: orderHash });
  }

  // Validate fillAmount
  if (!fillAmount) {
    errors.push({ field: 'fillAmount', message: 'Fill amount is required' });
  } else if (typeof fillAmount !== 'string') {
    errors.push({ field: 'fillAmount', message: 'Fill amount must be a string', value: fillAmount });
  } else {
    try {
      const amount = BigInt(fillAmount);
      if (amount <= 0n) {
        errors.push({ field: 'fillAmount', message: 'Fill amount must be positive', value: fillAmount });
      }
    } catch {
      errors.push({ field: 'fillAmount', message: 'Fill amount must be a valid number string', value: fillAmount });
    }
  }

  // Validate takerAddress
  if (!takerAddress) {
    errors.push({ field: 'takerAddress', message: 'Taker address is required' });
  } else if (typeof takerAddress !== 'string') {
    errors.push({ field: 'takerAddress', message: 'Taker address must be a string', value: takerAddress });
  } else if (!/^0x[a-fA-F0-9]{40}$/.test(takerAddress)) {
    errors.push({ field: 'takerAddress', message: 'Taker address must be a valid Ethereum address', value: takerAddress });
  }

  if (errors.length > 0) {
    throw new APIError('Validation failed', 400, errors);
  }
}

function sanitizeRequest(req: Request): void {
  // Trim string values in body
  if (req.body && typeof req.body === 'object') {
    for (const [key, value] of Object.entries(req.body)) {
      if (typeof value === 'string') {
        req.body[key] = value.trim();
      }
    }
  }

  // Sanitize query parameters
  if (req.query && typeof req.query === 'object') {
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string') {
        req.query[key] = value.trim();
      }
    }
  }
}

export function validateOrderHash(orderHash: string): boolean {
  return typeof orderHash === 'string' && /^0x[a-fA-F0-9]{64}$/.test(orderHash);
}

export function validateAddress(address: string): boolean {
  return typeof address === 'string' && /^0x[a-fA-F0-9]{40}$/.test(address);
}

export function validateAmount(amount: string): boolean {
  try {
    const bigIntAmount = BigInt(amount);
    return bigIntAmount > 0n;
  } catch {
    return false;
  }
} 