import { describe, it, expect } from 'vitest';
import { AppError } from '../../src/api/middleware/errorHandler.js';

describe('AppError', () => {
  it('creates operational error with correct properties', () => {
    const err = new AppError('Something went wrong', 400, 'BAD_REQUEST');
    expect(err.message).toBe('Something went wrong');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('BAD_REQUEST');
    expect(err.isOperational).toBe(true);
  });

  it('defaults to status 500', () => {
    const err = new AppError('Internal error');
    expect(err.statusCode).toBe(500);
  });
});

