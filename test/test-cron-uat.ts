import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { VisitasCronService } from './src/visitas/visitas-cron.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Visita } from './src/pacientes/entities/visita.entity';
import { Paciente } from './src/pacientes/entities/paciente.entity';
import { ProfesionalSalud } from './src/profesionales/entities/profesional-salud.entity';
import { Usuario } from './src/usuarios/entities/usuario.entity';
import { Repository } from 'typeorm';

async function bootstrap() {
  console.log('Iniciando UAT de Cron de Visitas Atrasadas...');
  
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const visitasCronService = app.get(VisitasCronService);
  const visitaRepo = app.get<Repository<Visita>>(getRepositoryToken(Visita));
  const pacienteRepo = app.get<Repository<Paciente>>(getRepositoryToken(Paciente));
  const profRepo = app.get<Repository<ProfesionalSalud>>(getRepositoryToken(ProfesionalSalud));
  const usrRepo = app.get<Repository<Usuario>>(getRepositoryToken(Usuario));

  console.log('0. Obteniendo IDs reales de la DB...');
  const paciente = await pacienteRepo.findOne({ where: {} });
  const prof = await profRepo.findOne({ where: {} });
  const usr = await usrRepo.findOne({ where: {} });

  if (!paciente || !prof || !usr) {
    console.log('No hay datos en la DB para crear la visita. Cierra el script.');
    await app.close();
    process.exit(1);
  }

  console.log('1. Creando una visita ficticia programada para hace 2 horas...');
  
  // Crear fecha hace 2 horas
  const hace2Horas = new Date();
  hace2Horas.setHours(hace2Horas.getHours() - 2);

  const mockVisita = visitaRepo.create({
    pacienteId: paciente.id,
    profesionalSaludId: prof.id,
    creadaPorUsuarioId: usr.id,
    fechaProgramada: hace2Horas.toISOString().split('T')[0],
    horaProgramada: hace2Horas.toTimeString().split(' ')[0], // HH:MM:SS
    estado: 'PROGRAMADA'
  });

  const savedVisita = await visitaRepo.save(mockVisita);
  console.log(`Visita creada con ID: ${savedVisita.id} (hora programada: ${savedVisita.horaProgramada})`);

  console.log('2. Ejecutando manualmente el Cron Job...');
  await visitasCronService.checkLateVisits();

  // Esperar un segundo para operaciones asíncronas
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('3. Verificando estado de la visita...');
  const updatedVisita = await visitaRepo.findOne({ where: { id: savedVisita.id } });
  
  if (updatedVisita?.estado === 'CANCELADA') {
    console.log('✅ ÉXITO: El Cron detectó la visita atrasada, disparó el incidente y actualizó el estado a CANCELADA.');
  } else {
    console.log(`❌ ERROR: La visita quedó en estado ${updatedVisita?.estado}`);
  }

  // Cleanup
  await visitaRepo.remove(updatedVisita as any);
  await app.close();
  process.exit(0);
}

bootstrap();
