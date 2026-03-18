import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const corsOrigins = (process.env.FRONTEND_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  // Keep request body limit fixed in code.
  // 25MB file in base64 is larger than 25MB, so transport limit must be higher.
  const bodyLimit = '40mb';

  if (corsOrigins.length > 0 || process.env.NODE_ENV !== 'production') {
    app.enableCors({
      origin: corsOrigins.length > 0 ? corsOrigins : true,
      credentials: true,
    });
  }

  app.use(json({ limit: bodyLimit }));
  app.use(urlencoded({ extended: true, limit: bodyLimit }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      stopAtFirstError: true,
      exceptionFactory: (validationErrors) => {
        const errors = {};

        for (const err of validationErrors) {
          const field = err.property;
          const messages = Object.values(err.constraints || {});
          errors[field] = messages.length === 1 ? messages[0] : messages;
        }
        console.log(
          'Validation Errors:',
          JSON.stringify(validationErrors, null, 2),
        );
        return new BadRequestException({
          errors,
        });
      },
    }),
  );

  app.use(cookieParser());

  const config = new DocumentBuilder()
    .setTitle('Webmail API')
    .setDescription('API tài liệu cho frontend')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'jwt',
    )
    .addCookieAuth(
      'exchange_session',
      {
        type: 'apiKey',
        in: 'cookie',
      },
      'exchange_cookie',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
