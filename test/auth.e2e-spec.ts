import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.use(cookieParser());

    prisma = app.get(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── Signup ──────────────────────────────────────────────────
  describe('POST /api/v1/auth/signup', () => {
    it('should create a new user', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/signup')
        .send({
          fullName: 'Test User',
          email: `test_${Date.now()}@pakverse.pk`,
          password: 'TestPass123!',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user.email).toContain('pakverse.pk');
    });

    it('should reject duplicate email', async () => {
      const email = `dup_${Date.now()}@pakverse.pk`;
      await request(app.getHttpServer())
        .post('/api/v1/auth/signup')
        .send({ fullName: 'User', email, password: 'TestPass123!' });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/signup')
        .send({ fullName: 'User 2', email, password: 'TestPass123!' })
        .expect(409);

      expect(res.body.success).toBe(false);
    });

    it('should reject weak password', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/signup')
        .send({ fullName: 'User', email: 'weak@test.com', password: '123' })
        .expect(400);
    });
  });

  // ─── Login ───────────────────────────────────────────────────
  describe('POST /api/v1/auth/login', () => {
    const testEmail = `login_test_${Date.now()}@pakverse.pk`;

    beforeAll(async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/signup')
        .send({ fullName: 'Login Test', email: testEmail, password: 'TestPass123!' });
    });

    it('should login and return access token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: testEmail, password: 'TestPass123!' })
        .expect(200);

      expect(res.body.data.accessToken).toBeDefined();
      accessToken = res.body.data.accessToken;
    });

    it('should reject wrong password', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: testEmail, password: 'WrongPass!' })
        .expect(401);
    });
  });

  // ─── Auth/Me ─────────────────────────────────────────────────
  describe('GET /api/v1/auth/me', () => {
    it('should return current user when authenticated', async () => {
      if (!accessToken) return;
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.data.email).toBeDefined();
    });

    it('should reject unauthenticated request', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .expect(401);
    });
  });

  // ─── Health ──────────────────────────────────────────────────
  describe('GET /api/v1/health', () => {
    it('should return ok status', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      expect(res.body.data.status).toBe('ok');
    });
  });
});
