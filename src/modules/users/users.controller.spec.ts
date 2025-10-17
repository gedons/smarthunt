// src/modules/users/users.controller.spec.ts
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { UsersModule } from './users.module';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { AuthGuard } from '@nestjs/passport';
import envConfig from '../../config/env.config';
import { ConfigModule } from '@nestjs/config';

describe('UsersController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [envConfig] }),
        DatabaseModule,
        AuthModule,
        UsersModule,
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue({
        canActivate: (context) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const req = context.switchToHttp().getRequest();
          // mock user
          req.user = {
            auth0Id: 'auth0|test',
            email: 'test@example.com',
            name: 'Test',
          };
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /auth/me -> returns user', async () => { 
    const res = await request(app.getHttpServer()).get('/api/auth/me').expect(200);
    expect(res.body).toHaveProperty('auth0Id', 'auth0|test');
    expect(res.body).toHaveProperty('email');
  });
});
