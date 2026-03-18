import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

type JwtRequest = {
  cookies?: Record<string, string | undefined>;
  headers?: Record<string, string | string[] | undefined>;
};

const normalizeJwt = (value?: string | null) => {
  if (!value) {
    return null;
  }

  const token = value.trim().replace(/^"|"$/g, '');

  if (!token || token === 'null' || token === 'undefined') {
    return null;
  }

  const segments = token.split('.');
  if (segments.length !== 3 || segments.some((segment) => !segment)) {
    return null;
  }

  return token;
};

const jwtCookieExtractor = (request: JwtRequest) =>
  normalizeJwt(request?.cookies?.access_token ?? null);

const jwtBearerExtractor = (request: JwtRequest) => {
  const authorization = request?.headers?.authorization;
  const header = Array.isArray(authorization)
    ? authorization[0]
    : authorization;

  if (!header) {
    return null;
  }

  const [scheme, token, ...rest] = header.trim().split(/\s+/);
  if (scheme !== 'Bearer' || rest.length > 0) {
    return null;
  }

  return normalizeJwt(token);
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        jwtBearerExtractor,
        jwtCookieExtractor,
      ]),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('JWT_SECRET') ||
        'your-secret-key-change-in-production',
    });
  }

  async validate(payload: any) {
    if (!payload || !payload.sub) {
      return null;
    }

    const user = {
      id: payload.sub,
      email: payload.email,
    };

    return user;
  }
}
