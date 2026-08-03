import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import * as compression from 'compression';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3001);
  const frontendUrl = configService.get<string>('FRONTEND_URL', 'http://localhost:5173');

  // ─── Security Middleware ──────────────────────────────────────
  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());

  // ─── CORS ────────────────────────────────────────────────────
  app.enableCors({
    origin: [frontendUrl, 'http://localhost:5174', 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // ─── API Versioning ──────────────────────────────────────────
  app.setGlobalPrefix('api/v1');
  app.enableVersioning({ type: VersioningType.URI });

  // ─── Global Pipes, Filters, Interceptors ─────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TransformInterceptor(),
  );

  // ─── Swagger Documentation ────────────────────────────────────
  if (configService.get('NODE_ENV') !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('PakVerse Portal API')
      .setDescription(
        'Complete REST API for PakVerse Portal — Pakistan\'s multi-vertical community platform',
      )
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
        'JWT',
      )
      .addCookieAuth('refreshToken')
      .addTag('Auth', 'Authentication & authorization')
      .addTag('Users', 'User profiles & management')
      .addTag('Shops', 'Store / shops module')
      .addTag('Education', 'Institutes, courses & enrollments')
      .addTag('Feed', 'Social feed, posts, comments & reactions')
      .addTag('Marketplace', 'Buy & sell marketplace')
      .addTag('Hospital', 'Healthcare & appointments')
      .addTag('Notifications', 'Real-time notifications')
      .addTag('Upload', 'File & media uploads')
      .addTag('Health', 'Health check')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
    });
  }

  await app.listen(port, '0.0.0.0');

  console.log(`
  ╔═══════════════════════════════════════════════╗
  ║          🇵🇰 PakVerse Portal API              ║
  ╠═══════════════════════════════════════════════╣
  ║  API:     http://localhost:${port}/api/v1        ║
  ║  Swagger: http://localhost:${port}/api/docs      ║
  ║  Env:     ${configService.get('NODE_ENV')}                  ║
  ╚═══════════════════════════════════════════════╝
  `);
}

bootstrap();
