// src/modules/auth/jwt.strategy.ts
import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import jwksRsa from 'jwks-rsa';
import { ConfigService } from '@nestjs/config';

@Injectable()
// eslint-disable-next-line @typescript-eslint/no-unsafe-call
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(private readonly config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // issuer must include trailing slash
      issuer: `https://${config.get('AUTH0_DOMAIN')}/`,
      audience: config.get('AUTH0_AUDIENCE'),
      algorithms: ['RS256'],
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      secretOrKeyProvider: jwksRsa.passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `https://${config.get('AUTH0_DOMAIN')}/.well-known/jwks.json`,
      }) as any,
    } as any);

    this.logger.log('JwtStrategy initialized');
  }

  // payload is the decoded JWT
  // eslint-disable-next-line @typescript-eslint/require-await
  async validate(payload: any) {
    // Return a lightweight user object attached to req.user
    return {
      auth0Id: payload.sub,
      email: payload.email,
      name: payload.name,
    };
  }
}
