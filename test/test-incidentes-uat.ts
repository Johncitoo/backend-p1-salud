import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { IncidentesSaludService } from './src/incidentes-salud/incidentes-salud.service';

async function bootstrap() {
  console.log('Iniciando UAT de Incidentes Operacionales (Proyecto 11)...');
  
  // 1. Levantar aplicación NestJS
  const app = await NestFactory.createApplicationContext(AppModule);
  
  // 2. Obtener el servicio de incidentes clínicos
  const incidentesSaludService = app.get(IncidentesSaludService);
  
  console.log('Creando incidente de severidad CRÍTICA (debería gatillar envío al P11)...');
  
  // 3. Crear incidente
  const incidente = await incidentesSaludService.create({
    titulo: 'TEST UAT - Fallo Crítico de Sistema',
    descripcion: 'Generado desde script de prueba UAT para verificar el webhook del P11',
    severidad: 'CRITICA',
    tipo: 'FALLA_TECNICA',
    estado: 'ABIERTO',
    origen: 'SISTEMA',
  });
  
  console.log(`Incidente clínico guardado en BD con ID: ${incidente.id}`);
  
  // Esperar un par de segundos para permitir que la promesa asíncrona de envío termine
  console.log('Esperando respuesta del webhook externo asíncrono...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  console.log('UAT Finalizada. Si no hubo errores en consola roja, el webhook fue un éxito.');
  await app.close();
  process.exit(0);
}

bootstrap();
