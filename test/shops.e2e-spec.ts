import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';

describe('Shops (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.use(cookieParser());
    await app.init();

    // Login to get token
    const email = `shop_test_${Date.now()}@pakverse.pk`;
    await request(app.getHttpServer())
      .post('/api/v1/auth/signup')
      .send({ fullName: 'Shop Owner', email, password: 'TestPass123!' });

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'TestPass123!' });

    accessToken = res.body.data.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/shops', () => {
    it('should return shops without auth', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/shops')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.shops).toBeDefined();
      expect(res.body.data.pagination).toBeDefined();
    });

    it('should filter by city', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/shops?city=Lahore')
        .expect(200);

      expect(res.body.data.shops).toBeDefined();
    });
  });

  describe('POST /api/v1/shops', () => {
    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/shops')
        .send({ name: 'Test Shop' })
        .expect(401);
    });
  });
});
