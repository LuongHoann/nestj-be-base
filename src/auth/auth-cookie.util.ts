import type { CookieOptions } from 'express';

const parseSameSite = (): CookieOptions['sameSite'] => {
  const value = (process.env.COOKIE_SAME_SITE ?? 'lax').toLowerCase();

  if (value === 'strict' || value === 'lax' || value === 'none') {
    return value;
  }

  return 'lax';
};

const parseSecure = (sameSite: CookieOptions['sameSite']) => {
  if (process.env.COOKIE_SECURE === 'true') {
    return true;
  }

  if (process.env.COOKIE_SECURE === 'false') {
    return false;
  }

  return sameSite === 'none' || process.env.NODE_ENV === 'production';
};

export const buildAuthCookieOptions = (maxAge: number): CookieOptions => {
  const sameSite = parseSameSite();

  return {
    httpOnly: true,
    secure: parseSecure(sameSite),
    sameSite,
    maxAge,
    path: '/',
  };
};
