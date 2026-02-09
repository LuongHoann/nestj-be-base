import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  BadRequestException,
  ValidationPipe,
} from '@nestjs/common';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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
        console.log('Validation Errors:', JSON.stringify(validationErrors, null, 2));
        return new BadRequestException({
          errors,
        });
      },
    }),
  );

  app.use(cookieParser());

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
