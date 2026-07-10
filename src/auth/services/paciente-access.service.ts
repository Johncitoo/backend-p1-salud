import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Visita } from '../../pacientes/entities/visita.entity';
import { ProfesionalSalud } from '../../profesionales/entities/profesional-salud.entity';
import type { UsuarioPerfil } from '../../usuarios/usuarios.service';

// Cierra el hueco de autorización a nivel de objeto (IDOR) sobre datos
// clínicos: hasta ahora, RolesGuard solo verificaba el ROL (PROFESIONAL,
// COORDINADOR, ...) pero nunca si el paciente en cuestión está realmente
// asignado a ese profesional — cualquier cuenta PROFESIONAL podía leer o
// descargar la ficha clínica, medicamentos, diagnósticos o adjuntos de
// CUALQUIER paciente del sistema, no solo los que atendió.
//
// ADMIN/COORDINADOR/SUPERVISOR conservan visibilidad total (supervisión
// operativa). Solo PROFESIONAL queda acotado a pacientes con los que tiene
// al menos una visita asignada.
@Injectable()
export class PacienteAccessService {
  constructor(
    @InjectRepository(Visita)
    private readonly visitasRepository: Repository<Visita>,
    @InjectRepository(ProfesionalSalud)
    private readonly profesionalesRepository: Repository<ProfesionalSalud>,
  ) {}

  private async profesionalIdDeUsuario(
    usuarioId: string,
  ): Promise<string | null> {
    const profesional = await this.profesionalesRepository.findOne({
      where: { usuarioId, deletedAt: IsNull() },
    });
    return profesional?.id ?? null;
  }

  /** Lanza ForbiddenException si un PROFESIONAL no tiene ninguna visita asignada con este paciente. */
  async assertAccesoPaciente(
    user: UsuarioPerfil | undefined,
    pacienteId: string,
  ): Promise<void> {
    if (!user || user.rol !== 'PROFESIONAL') return;

    const profesionalId = await this.profesionalIdDeUsuario(user.id);
    if (!profesionalId) {
      throw new ForbiddenException(
        'Tu cuenta no tiene un perfil de profesional de salud asociado.',
      );
    }

    const tieneAcceso = await this.visitasRepository.exist({
      where: {
        pacienteId,
        profesionalSaludId: profesionalId,
        deletedAt: IsNull(),
      },
    });

    if (!tieneAcceso) {
      throw new ForbiddenException(
        'No tienes acceso a los datos de este paciente.',
      );
    }
  }

  /** Igual que assertAccesoPaciente, pero a partir de una visita (resuelve el paciente dueño). */
  async assertAccesoVisita(
    user: UsuarioPerfil | undefined,
    visitaId: string,
  ): Promise<void> {
    if (!user || user.rol !== 'PROFESIONAL') return;

    const visita = await this.visitasRepository.findOne({
      where: { id: visitaId, deletedAt: IsNull() },
    });
    if (!visita) throw new NotFoundException('Visita no encontrada');

    await this.assertAccesoPaciente(user, visita.pacienteId);
  }
}
