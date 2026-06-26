import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  const configService = app.get<import('@nestjs/config').ConfigService>(
    (await import('@nestjs/config')).ConfigService,
  );

  const port = configService.get<number>('port') ?? 3001;
  const apiPrefix = configService.get<string>('apiPrefix') ?? 'api/v1';
  const frontendUrl = configService.get<string>('frontendUrl') ?? 'http://localhost:5173';
  const swaggerEnabled = configService.get<boolean>('swaggerEnabled') ?? false;
  const nodeEnv = configService.get<string>('nodeEnv') ?? 'development';

  // Trust reverse-proxy headers (X-Forwarded-For, X-Forwarded-Proto) in production.
  // Required for correct IP logging and secure-cookie detection behind nginx/Caddy/Railway/etc.
  if (nodeEnv === 'production') {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }

  // Global API prefix (e.g. /api/v1)
  app.setGlobalPrefix(apiPrefix);

  // Cookie parser — required for refresh token cookie
  app.use(cookieParser());

  // Helmet — safe defaults for JSON APIs; disable CSP so Swagger UI loads in dev
  app.use(
    helmet({
      contentSecurityPolicy: nodeEnv === 'production' ? undefined : false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  // CORS — exact origin only; no wildcards in production
  app.enableCors({
    origin: [frontendUrl],
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global exception filter — structured error shape
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global logging interceptor — logs method, path, status, duration
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Swagger — dev only or when SWAGGER_ENABLED=true
  if (swaggerEnabled && nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('LifeRPG API')
      .setDescription('Gamified life productivity for software engineers')
      .setVersion('MVP')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'access-token',
      )
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    // Mount at /<prefix>/docs
    SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
      swaggerOptions: { persistAuthorization: true },
    });

    logger.log(`Swagger UI → http://localhost:${port}/${apiPrefix}/docs`);
  }

  // Graceful shutdown — allow in-flight requests to drain before process exits
  app.enableShutdownHooks();

  await app.listen(port, '0.0.0.0');
  logger.log(`LifeRPG API running on http://localhost:${port}/${apiPrefix}`);
  logger.log(`Environment: ${nodeEnv}`);
}

bootstrap();
