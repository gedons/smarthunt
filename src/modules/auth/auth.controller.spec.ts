import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { UsersModule } from '../users/users.module';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from './auth.module';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService } from '../../config/prisma.service';
import { ConfigModule } from '@nestjs/config';
import envConfig from '../../config/env.config';

describe('Auth /users (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        // Provide ConfigModule so JwtStrategy gets ConfigService (Auth0 domain/audience)
        ConfigModule.forRoot({ isGlobal: true, load: [envConfig] }),
        DatabaseModule,
        AuthModule,
        UsersModule,
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue({
        canActivate: (context) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          const req = context.switchToHttp().getRequest();
          // Mock Auth0 payload as req.user
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          req.user = {
            auth0Id: 'auth0|test-user',
            email: 'test@example.com',
            name: 'Test User',
          };
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    prisma = moduleRef.get(PrismaService);
  });

  afterAll(async () => {
    // Optionally cleanup test user for repeatable runs:
    try {
      await prisma.user.deleteMany({ where: { auth0Id: 'auth0|test-user' } });
    } catch (error) {
      // ignore
      console.error(error);
    }
    await app.close();
  });

  it('GET /auth/me should create or return user', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument
    const res = await request(app.getHttpServer())
      .get('/api/auth/me')
      .expect(200);
    expect(res.body).toHaveProperty('auth0Id', 'auth0|test-user');
    expect(res.body).toHaveProperty('email', 'test@example.com');
  });
});
