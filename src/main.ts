import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const frontendUrl =
    configService.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';

  app.enableCors({
    origin: frontendUrl,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'x-identity-user-id', 'x-mock-role'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
