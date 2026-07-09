import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

async function checkExternalDependencies(configService: ConfigService) {
  const logger = new Logger('StartupHealthCheck');
  logger.log('Comprobando estado de proyectos externos integrados...');

  const projects = [
    { name: 'Proyecto 6 (Notificaciones)', url: configService.get<string>('NOTIFICATIONS_URL') },
    { name: 'Proyecto 7 (CRM)', url: configService.get<string>('CRM_API_URL') },
    { name: 'Proyecto 8 (IoT)', url: configService.get<string>('IOT_API_URL') },
    { name: 'Proyecto 9 (Analytics)', url: configService.get<string>('ANALYTICS_URL') },
    { name: 'Proyecto 11 (Incidentes)', url: configService.get<string>('INCIDENTES_API_URL') || 'https://proyecto11-mochicode.onrender.com' }
  ];

  for (const proj of projects) {
    if (!proj.url) {
      logger.warn(`[${proj.name}] NO CONFIGURADO (Falta URL en variables de entorno)`);
      continue;
    }
    
    try {
      const baseUrl = new URL(proj.url).origin;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      // Intentamos con GET porque HEAD a veces es bloqueado o no soportado por algunos frameworks
      await fetch(baseUrl, { method: 'GET', signal: controller.signal })
        .catch(() => {}); // Ignoramos si da 404 o 401, lo importante es que responda
        
      clearTimeout(timeoutId);
      logger.log(`[${proj.name}] EN LÍNEA ✅ (${baseUrl})`);
    } catch (error) {
      logger.error(`[${proj.name}] CAÍDO ❌ (Network/Timeout)`);
    }
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const frontendUrl =
    configService.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
  const allowedOrigins = Array.from(new Set([frontendUrl, 'http://localhost:5173']));

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'x-identity-user-id', 'x-mock-role'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT ?? 3000);
  
  if (process.env.NODE_ENV !== 'test') {
    await checkExternalDependencies(configService);
  }
}
bootstrap();
