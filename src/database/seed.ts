/**
 * Script de seed para desarrollo/pruebas locales. Uso: `npm run seed`.
 *
 * A diferencia del seed de appBack (endpoints HTTP GET/POST /database/seed sin auth,
 * que además borraba tablas enteras), esto es un script CLI, idempotente, que reutiliza
 * los servicios de Nest (misma validación/auditoría que los endpoints reales) para crear:
 * un profesional de prueba (modo mock, identity_user_id fijo), pacientes con dirección,
 * una plantilla de ficha con un campo de variable clínica, y visitas de hoy para el
 * profesional. No borra nada; si ya existe, lo reutiliza.
 */
import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IsNull, type Repository } from 'typeorm';
import { AppModule } from '../app.module';
import { UsuariosService } from '../usuarios/usuarios.service';
import { ProfesionalesService } from '../profesionales/profesionales.service';
import { ProfesionalSalud } from '../profesionales/entities/profesional-salud.entity';
import { PacientesService } from '../pacientes/pacientes.service';
import { Paciente } from '../pacientes/entities/paciente.entity';
import { Visita } from '../pacientes/entities/visita.entity';
import { VariablesClinicasService } from '../variables-clinicas/variables-clinicas.service';
import { PlantillasFichaService } from '../plantillas-ficha/plantillas-ficha.service';
import { VisitasService } from '../visitas/visitas.service';
import { calcularDv } from '../lib/rut.util';

export const SEED_PROFESIONAL_IDENTITY_USER_ID = 'seed-profesional-terreno-01';

function rutConDv(cuerpo: number): string {
  return `${cuerpo}-${calcularDv(cuerpo)}`;
}

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

async function seedProfesional(usuariosService: UsuariosService, profesionalesService: ProfesionalesService) {
  const usuario = await usuariosService.findOrCreateFromKeycloak({
    sub: SEED_PROFESIONAL_IDENTITY_USER_ID,
    email: 'seed.profesional@salud.local',
    preferredUsername: 'seed.profesional',
    rol: 'PROFESIONAL',
  });
  if (!usuario) {
    throw new Error('No se pudo crear el usuario de seed (¿existe el rol PROFESIONAL en la tabla roles?)');
  }

  const existentes = await profesionalesService.findAll();
  const existente = existentes.find(p => p.usuarioId === usuario.id);
  const profesional = existente ?? await profesionalesService.create({
    usuarioId: usuario.id,
    profesion: 'Enfermería',
  });

  return { usuario, profesional };
}

async function seedPaciente(
  pacientesService: PacientesService,
  pacientesRepo: Repository<Paciente>,
  cuerpoRut: number,
  nombres: string,
  apellidos: string,
  direccion: { calle: string; numero: string; comuna: string; region: string },
) {
  const rut = rutConDv(cuerpoRut);
  const existente = await pacientesRepo.findOne({ where: { rut } });
  const paciente = existente ?? await pacientesService.create({ rut, nombres, apellidos });

  const direcciones = await pacientesService.findDirecciones(paciente.id);
  const direccionPrincipal = direcciones.find(d => d.esPrincipal) ?? direcciones[0]
    ?? await pacientesService.createDireccion({ pacienteId: paciente.id, esPrincipal: true, ...direccion });

  return { paciente, direccion: direccionPrincipal };
}

async function seedPlantilla(
  variablesClinicasService: VariablesClinicasService,
  plantillasFichaService: PlantillasFichaService,
) {
  const codigoVariable = 'TEMPERATURA_CORPORAL';
  const variable = (await variablesClinicasService.findByCodigo(codigoVariable))
    ?? await variablesClinicasService.create({
      codigo: codigoVariable,
      nombre: 'Temperatura corporal',
      tipoDato: 'NUMERO',
      unidad: '°C',
    });

  const codigoPlantilla = 'CONTROL_GENERAL_SEED';
  const plantillasExistentes = await plantillasFichaService.findAll();
  let plantilla = plantillasExistentes.find(p => p.codigo === codigoPlantilla);
  if (!plantilla) {
    plantilla = await plantillasFichaService.create({
      codigo: codigoPlantilla,
      nombre: 'Control general',
      tipoAtencion: 'CONTROL',
    });
  }

  const campos = await plantillasFichaService.findCamposByPlantilla(plantilla.id);
  if (campos.length === 0) {
    await plantillasFichaService.createCampo({
      plantillaFichaId: plantilla.id,
      codigoCampo: 'observaciones',
      etiqueta: 'Observaciones',
      tipoCampo: 'TEXTO_LIBRE',
      orden: 0,
    });
    await plantillasFichaService.createCampo({
      plantillaFichaId: plantilla.id,
      codigoCampo: 'temperatura',
      etiqueta: 'Temperatura',
      tipoCampo: 'VARIABLE_CLINICA',
      variableClinicaId: variable.id,
      orden: 1,
    });
  }

  return plantilla;
}

async function seedVisitas(
  visitasService: VisitasService,
  visitasRepo: Repository<Visita>,
  usuarioCreadorId: string,
  profesionalSaludId: string,
  pacientes: { paciente: Paciente; direccion: { id: string } }[],
) {
  const fecha = hoyISO();
  const existentesHoy = await visitasRepo.count({
    where: { profesionalSaludId, fechaProgramada: fecha, deletedAt: IsNull() },
  });
  if (existentesHoy > 0) return existentesHoy;

  const horas = ['09:00', '11:00', '15:00', '17:00'];
  const prioridades = ['NORMAL', 'ALTA', 'NORMAL', 'URGENTE'];

  for (let i = 0; i < pacientes.length; i++) {
    const { paciente, direccion } = pacientes[i];
    await visitasService.create(
      {
        pacienteId: paciente.id,
        profesionalSaludId,
        direccionPacienteId: direccion.id,
        fechaProgramada: fecha,
        horaProgramada: horas[i % horas.length],
        prioridad: prioridades[i % prioridades.length],
      },
      usuarioCreadorId,
    );
  }

  return pacientes.length;
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const usuariosService = app.get(UsuariosService);
    const profesionalesService = app.get(ProfesionalesService);
    const pacientesService = app.get(PacientesService);
    const pacientesRepo = app.get<Repository<Paciente>>(getRepositoryToken(Paciente));
    const variablesClinicasService = app.get(VariablesClinicasService);
    const plantillasFichaService = app.get(PlantillasFichaService);
    const visitasService = app.get(VisitasService);
    const visitasRepo = app.get<Repository<Visita>>(getRepositoryToken(Visita));

    const { usuario, profesional } = await seedProfesional(usuariosService, profesionalesService);
    console.log(`Profesional listo: usuarioId=${usuario.id} profesionalSaludId=${profesional.id} identityUserId=${SEED_PROFESIONAL_IDENTITY_USER_ID}`);

    const pacientes = await Promise.all([
      seedPaciente(pacientesService, pacientesRepo, 19000001, 'Pedro', 'Marmol', {
        calle: 'Los Aromos', numero: '123', comuna: 'Ñuñoa', region: 'Metropolitana',
      }),
      seedPaciente(pacientesService, pacientesRepo, 19000002, 'Maria', 'Gomez', {
        calle: 'Las Rosas', numero: '456', comuna: 'Providencia', region: 'Metropolitana',
      }),
      seedPaciente(pacientesService, pacientesRepo, 19000003, 'Ana', 'Rojas Castro', {
        calle: 'El Bosque', numero: '789', comuna: 'La Reina', region: 'Metropolitana',
      }),
    ]);
    console.log(`Pacientes listos: ${pacientes.map(p => p.paciente.rut).join(', ')}`);

    const plantilla = await seedPlantilla(variablesClinicasService, plantillasFichaService);
    console.log(`Plantilla lista: ${plantilla.codigo} (${plantilla.id})`);

    const creadas = await seedVisitas(visitasService, visitasRepo, usuario.id, profesional.id, pacientes);
    console.log(`Visitas de hoy: ${creadas} (o ya existían para este profesional)`);
  } finally {
    await app.close();
  }
}

main().catch(error => {
  console.error('Error en seed:', error);
  process.exit(1);
});
