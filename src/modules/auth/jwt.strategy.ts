// src/modules/auth/jwt.strategy.ts
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import jwksRsa from 'jwks-rsa';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../config/prisma.service';
import fetch from 'node-fetch';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      issuer: `https://${config.get('AUTH0_DOMAIN')}/`,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      audience: config.get('AUTH0_AUDIENCE'),
      algorithms: ['RS256'],
      // allow validate to access req so we can call userinfo if email absent
      passReqToCallback: true,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      secretOrKeyProvider: jwksRsa.passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        jwksUri: `https://${config.get('AUTH0_DOMAIN')}/.well-known/jwks.json`,
      }) as any,
    } as any);

    this.logger.log('JwtStrategy initialized');
  }

  // Because passReqToCallback is true, validate receives (req, payload)
  async validate(req: any, payload: any) {
    // payload contains e.g. sub, iss, aud, maybe email
    const auth0Id: string = payload.sub;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    let email: string | undefined = payload.email;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const name: string | undefined = payload.name;

    // If email missing in access token payload, call Auth0 /userinfo with the bearer token
    if (!email) {
      this.logger.debug('Email missing from token payload; calling /userinfo');
      try {
        const authHeader = req.headers?.authorization;
        if (!authHeader) throw new Error('No Authorization header present');

        const accessToken = authHeader.split(' ')[1];
        const userinfoUrl = `https://${this.config.get('AUTH0_DOMAIN')}/userinfo`;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const resp = await fetch(userinfoUrl, {
          method: 'GET',
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!resp.ok) {
          this.logger.warn('Failed to fetch userinfo', await resp.text());
        } else {
          const info = await resp.json();
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          email = info.email || email;
          // optionally name = info.name || name;
        }
      } catch (err) {
        this.logger.warn('Userinfo request failed', (err as Error).message);
      }
    }

    // Upsert user in DB (keeps roles, resume, etc)
    try {
      const dbUser = await this.prisma.user.upsert({
        where: { auth0Id },
        update: {
          email: email ?? undefined,
          name: name ?? undefined,
        },
        create: {
          auth0Id,
          email: email ?? '',
          name: name ?? '',
        },
      });

      // return a lightweight object that will be set to req.user
      return { auth0Id: dbUser.auth0Id, email: dbUser.email, name: dbUser.name };
    } catch (err) {
      this.logger.error('Prisma upsert error in JwtStrategy.validate', err);
      throw new UnauthorizedException('Could not process user');
    }
  }
}
