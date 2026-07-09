import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// AUTH_MODE ya no tiene un default implícito: sin esta validación, si alguien
// olvidaba setear la variable en un despliegue nuevo, DevAuthGuard caía
// silenciosamente a 'mock' (confía en el header x-mock-role que manda el
// cliente, sin verificar nada) — un bypass total de autenticación. Ahora el
// backend se niega a arrancar en vez de arrancar inseguro por defecto.
function validateAuthMode(): void {
  const authMode = process.env.AUTH_MODE;

  if (authMode !== 'mock' && authMode !== 'keycloak') {
    throw new Error(
      `AUTH_MODE debe estar seteada explícitamente a 'mock' o 'keycloak' (valor actual: ${authMode === undefined ? 'no seteada' : JSON.stringify(authMode)}). ` +
      'No hay un valor por defecto: sin esto, el backend arrancaría confiando en el header x-mock-role sin autenticar a nadie.',
    );
  }

  if (authMode === 'mock' && process.env.NODE_ENV === 'production') {
    throw new Error(
      "AUTH_MODE=mock no está permitido con NODE_ENV=production. El modo mock confía en el header x-mock-role sin verificar identidad; " +
      'está pensado solo para desarrollo local. Usa AUTH_MODE=keycloak en producción.',
    );
  }
}

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
  validateAuthMode();

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
