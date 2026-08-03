import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import * as Joi from 'joi';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ShopsModule } from './modules/shops/shops.module';
import { EducationModule } from './modules/education/education.module';
import { FeedModule } from './modules/feed/feed.module';
import { MarketplaceModule } from './modules/marketplace/marketplace.module';
import { HospitalModule } from './modules/hospital/hospital.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { UploadModule } from './modules/upload/upload.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    // ─── Config ─────────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test')
          .default('development'),
        PORT: Joi.number().default(3001),
        FRONTEND_URL: Joi.string().default('http://localhost:5173'),
        DATABASE_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().min(32).required(),
        JWT_EXPIRATION: Joi.string().default('15m'),
        JWT_REFRESH_SECRET: Joi.string().min(32).required(),
        JWT_REFRESH_EXPIRATION: Joi.string().default('7d'),
        REDIS_HOST: Joi.string().default('localhost'),
        REDIS_PORT: Joi.number().default(6379),
        CLOUDINARY_CLOUD_NAME: Joi.string().required(),
        CLOUDINARY_API_KEY: Joi.string().required(),
        CLOUDINARY_API_SECRET: Joi.string().required(),
        BCRYPT_ROUNDS: Joi.number().default(12),
      }),
      validationOptions: { abortEarly: false },
    }),

    // ─── Rate Limiting ───────────────────────────────────────────
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 10,
      },
      {
        name: 'medium',
        ttl: 60000,
        limit: 100,
      },
    ]),

    // ─── Core Modules ────────────────────────────────────────────
    PrismaModule,

    // ─── Feature Modules ─────────────────────────────────────────
    AuthModule,
    UsersModule,
    ShopsModule,
    EducationModule,
    FeedModule,
    MarketplaceModule,
    HospitalModule,
    NotificationsModule,
    UploadModule,
    HealthModule,
  ],
  providers: [
    // Apply rate limiting globally
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
