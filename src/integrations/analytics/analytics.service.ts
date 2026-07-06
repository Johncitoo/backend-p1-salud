import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Alerta } from '../../alertas/entities/alerta.entity';
import { FichaClinica } from '../../fichas-clinicas/entities/ficha-clinica.entity';
import { Paciente } from '../../pacientes/entities/paciente.entity';
import { Visita } from '../../pacientes/entities/visita.entity';
import { Especialidad } from '../../profesionales/entities/especialidad.entity';
import { ProfesionalSalud } from '../../profesionales/entities/profesional-salud.entity';
import { Zona } from '../../zonas/entities/zona.entity';

// =========================================================
// Tipo genérico de evento que espera el Grupo 9 (Analítica)
// Formato: { source: "salud", event_type: "...", payload: {...} }
// =========================================================

type AnalyticsEvent = {
  source: 'salud';
  event_type: string;
  payload: Record<string, unknown>;
};

// =========================================================
// Payloads tipados por cada evento
// =========================================================

type VisitaUpsertPayload = {
  visita_id: string;
  paciente_id: string;
  profesional_id: string;
  zona_id: string | null;
  usuario_creador_id: string | null;
  fecha_programada: string | null;
  hora_programada: string | null;
  estado: 'programada' | 'en_proceso' | 'completada' | 'cancelada';
  fecha_inicio_real: string | null;
  fecha_fin_real: string | null;
  completada: 0 | 1;
  puntual: 0 | 1;
  visit_type: string;
};

type UsuarioUpsertPayload = {
  usuario_id: string;
  nombres: string;
  apellidos: string;
  rut?: string;
  email?: string;
  telefono?: string | null;
  activo?: boolean;
};

type PacienteUpsertPayload = {
  paciente_id: string;
  nombres: string;
  apellidos: string;
  rut?: string;
  fecha_nacimiento?: string | null;
  sexo?: string | null;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
};

type ProfesionalUpsertPayload = {
  profesional_id: string;
  usuario_id: string;
  nombres: string;
  apellidos: string;
  profesion?: string;
  numero_registro?: string | null;
  activo?: boolean;
};

type ZonaUpsertPayload = {
  zona_id: string;
  nombre: string;
  descripcion?: string | null;
  comuna?: string;
  region?: string;
  activa?: boolean;
};

type EspecialidadUpsertPayload = {
  especialidad_id: string;
  nombre: string;
  descripcion?: string | null;
};

type VisitaInicioPayload = {
  visita_id: string;
  fecha_inicio_real: string;
};

type VisitaFinPayload = {
  visita_id: string;
  fecha_fin_real: string;
  estado?: string;
  completada?: 0 | 1;
  puntual?: 0 | 1;
};

type FichaUpsertPayload = {
  ficha_id: string;
  visita_id: string;
  estado: 'DRAFT' | 'COMPLETED' | 'ARCHIVED';
  contenido?: string;
  usuario_creador_id?: string | null;
  usuario_actualizador_id?: string | null;
  tiene_adjuntos?: string;
  cantidad_adjuntos?: string;
};

type AlertaUpsertPayload = {
  alerta_id: string;
  paciente_id: string;
  visita_id?: string;
  tipo: string;
  mensaje?: string;
  prioridad?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  estado?: 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
  dias_abierta?: number;
};

// =========================================================
// Opciones / formas de datos auxiliares
// =========================================================

export type VisitAnalyticsOptions = {
  puntual?: boolean | null;
  visitType?: string | null;
};

// Forma estructural mínima para usuario (UsuariosService retorna UsuarioResponse,
// no la entidad). Se evita acoplar al tipo del service para no crear dependencia circular.
type UsuarioData = {
  id: string;
  nombres: string;
  apellidos: string;
  rut?: string;
  email?: string;
  telefono?: string | null;
  activo?: boolean;
};

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly configService: ConfigService) {}

  // =========================================================
  // Envío genérico de eventos
  // Centraliza la lógica HTTP: lee config, valida, hace POST.
  // Es no-bloqueante: cualquier error se loguea, nunca se lanza.
  // =========================================================

  // Reintentos con backoff: Render free tier puede tardar ~30-50s en "despertar"
  // (cold start) y antes el primer fallo descartaba el evento para siempre,
  // sin dejar ningún rastro recuperable más allá de un log de error.
  private static readonly MAX_ATTEMPTS = 3;
  private static readonly ATTEMPT_TIMEOUT_MS = 20_000;
  private static readonly RETRY_BACKOFF_MS = [3_000, 8_000];

  private async sendEvent(event: AnalyticsEvent): Promise<void> {
    const enabled = this.configService.get<string>('ANALYTICS_ENABLED') === 'true';
    const baseUrl = (this.configService.get<string>('ANALYTICS_URL') ?? '').trim();
    const eventsPath = this.configService.get<string>('ANALYTICS_EVENTS_PATH') ?? '/events';

    if (!enabled) {
      this.logger.log(`[Analytics mock] Evento ${event.event_type}:\n${JSON.stringify(event, null, 2)}`);
      return;
    }

    if (!baseUrl) {
      this.logger.warn(`ANALYTICS_ENABLED=true pero ANALYTICS_URL está vacío. Evento no enviado:\n${JSON.stringify(event, null, 2)}`);
      return;
    }

    const endpoint = `${baseUrl}${this.normalizeEventsPath(eventsPath)}`;

    this.logger.log(
      `[Analytics outgoing] Evento ${event.event_type}:\n${JSON.stringify(event, null, 2)}`,
    );

    for (let attempt = 1; attempt <= AnalyticsService.MAX_ATTEMPTS; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        AnalyticsService.ATTEMPT_TIMEOUT_MS,
      );

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(event),
          signal: controller.signal,
        });

        const responseText = typeof response.text === 'function'
          ? await response.text().catch(() => '')
          : '';
        this.logger.log(
          `[Analytics response] Evento ${event.event_type} (intento ${attempt}/${AnalyticsService.MAX_ATTEMPTS}): HTTP ${response.status} - ${responseText}`,
        );

        if (response.ok) return;

        this.logger.error(
          `No se pudo enviar evento ${event.event_type} a Analítica (intento ${attempt}/${AnalyticsService.MAX_ATTEMPTS}): HTTP ${response.status}`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `No se pudo enviar evento ${event.event_type} a Analítica (intento ${attempt}/${AnalyticsService.MAX_ATTEMPTS}): ${message}`,
        );
      } finally {
        clearTimeout(timeout);
      }

      const backoff = AnalyticsService.RETRY_BACKOFF_MS[attempt - 1];
      if (backoff) await this.delay(backoff);
    }

    this.logger.error(
      `Evento ${event.event_type} descartado tras ${AnalyticsService.MAX_ATTEMPTS} intentos fallidos: ${JSON.stringify(event)}`,
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // =========================================================
  // Eventos públicos (uno por tipo que pide el Grupo 9)
  // =========================================================

  async sendVisitUpsertEvent(visita: Visita, options: VisitAnalyticsOptions = {}): Promise<void> {
    const estado = this.normalizeVisitaEstado(visita.estado);
    const payload: VisitaUpsertPayload = {
      visita_id: visita.id,
      paciente_id: visita.pacienteId,
      profesional_id: visita.profesionalSaludId,
      zona_id: visita.zonaId ?? null,
      usuario_creador_id: visita.creadaPorUsuarioId ?? null,
      fecha_programada: this.formatDateOnly(visita.fechaProgramada),
      hora_programada: this.formatTimeOnly(visita.horaProgramada),
      estado,
      fecha_inicio_real: this.formatDateTime(visita.fechaHoraInicioReal),
      fecha_fin_real: this.formatDateTime(visita.fechaHoraFinReal),
      completada: estado === 'completada' ? 1 : 0,
      puntual: options.puntual === true ? 1 : 0,
      visit_type: options.visitType ?? 'General',
    };

    await this.sendEvent({ source: 'salud', event_type: 'visita_upsert', payload });
  }

  async sendUsuarioUpsertEvent(usuario: UsuarioData): Promise<void> {
    const payload: UsuarioUpsertPayload = {
      usuario_id: usuario.id,
      nombres: usuario.nombres,
      apellidos: usuario.apellidos,
      email: usuario.email,
      activo: usuario.activo,
    };

    await this.sendEvent({ source: 'salud', event_type: 'usuario_upsert', payload });
  }

  async sendPacienteUpsertEvent(paciente: Paciente): Promise<void> {
    const payload: PacienteUpsertPayload = {
      paciente_id: paciente.id,
      nombres: paciente.nombres,
      apellidos: paciente.apellidos,
      rut: paciente.rut,
      fecha_nacimiento: this.formatDateOnly(paciente.fechaNacimiento),
      sexo: paciente.sexo ?? null,
      telefono: paciente.telefono ?? null,
      email: paciente.email ?? null,
      direccion: paciente.direccion ?? null,
    };

    await this.sendEvent({ source: 'salud', event_type: 'paciente_upsert', payload });
  }

  async sendProfesionalUpsertEvent(
    profesional: ProfesionalSalud,
    usuario: { nombres: string; apellidos: string },
  ): Promise<void> {
    const payload: ProfesionalUpsertPayload = {
      profesional_id: profesional.id,
      usuario_id: profesional.usuarioId,
      nombres: usuario.nombres,
      apellidos: usuario.apellidos,
      profesion: profesional.profesion,
      activo: profesional.activo,
    };

    await this.sendEvent({ source: 'salud', event_type: 'profesional_upsert', payload });
  }

  async sendZonaUpsertEvent(zona: Zona): Promise<void> {
    const payload: ZonaUpsertPayload = {
      zona_id: zona.id,
      nombre: zona.nombre,
      descripcion: zona.descripcion ?? null,
      comuna: zona.comuna,
      region: zona.region,
      activa: zona.activa,
    };

    await this.sendEvent({ source: 'salud', event_type: 'zona_upsert', payload });
  }

  async sendEspecialidadUpsertEvent(especialidad: Especialidad): Promise<void> {
    const payload: EspecialidadUpsertPayload = {
      especialidad_id: especialidad.id,
      nombre: especialidad.nombre,
      descripcion: especialidad.descripcion ?? null,
    };

    await this.sendEvent({ source: 'salud', event_type: 'especialidad_upsert', payload });
  }

  async sendVisitaInicioEvent(visita: Visita): Promise<void> {
    const fechaInicio = this.formatDateTime(visita.fechaHoraInicioReal);
    if (!fechaInicio) return;

    const payload: VisitaInicioPayload = {
      visita_id: visita.id,
      fecha_inicio_real: fechaInicio,
    };

    await this.sendEvent({ source: 'salud', event_type: 'visita_inicio', payload });
  }

  async sendVisitaFinEvent(visita: Visita, options: VisitAnalyticsOptions = {}): Promise<void> {
    const fechaFin = this.formatDateTime(visita.fechaHoraFinReal);
    if (!fechaFin) return;

    const estado = this.normalizeVisitaEstado(visita.estado);
    const payload: VisitaFinPayload = {
      visita_id: visita.id,
      fecha_fin_real: fechaFin,
      estado,
      completada: estado === 'completada' ? 1 : 0,
      puntual: options.puntual === true ? 1 : 0,
    };

    await this.sendEvent({ source: 'salud', event_type: 'visita_fin', payload });
  }

  async sendFichaUpsertEvent(ficha: FichaClinica, adjuntosCount: number): Promise<void> {
    const payload: FichaUpsertPayload = {
      ficha_id: ficha.id,
      visita_id: ficha.visitaId,
      estado: this.normalizeFichaEstado(ficha.estado),
      contenido: ficha.contenido ? JSON.stringify(ficha.contenido) : undefined,
      usuario_creador_id: ficha.creadaPorUsuarioId ?? null,
      usuario_actualizador_id: ficha.actualizadaPorUsuarioId ?? null,
      tiene_adjuntos: adjuntosCount > 0 ? '1' : '0',
      cantidad_adjuntos: String(adjuntosCount),
    };

    await this.sendEvent({ source: 'salud', event_type: 'ficha_upsert', payload });
  }

  async sendAlertaUpsertEvent(alerta: Alerta): Promise<void> {
    const payload: AlertaUpsertPayload = {
      alerta_id: alerta.id,
      paciente_id: alerta.pacienteId,
      visita_id: alerta.visitaId,
      tipo: alerta.tipo,
      mensaje: alerta.mensaje,
      prioridad: this.normalizeAlertaPrioridad(alerta.prioridad),
      estado: this.normalizeAlertaEstado(alerta.estado),
      dias_abierta: Math.max(
        0,
        Math.floor(
          (Date.now() - new Date(alerta.createdAt).getTime()) / 86_400_000,
        ),
      ),
    };

    await this.sendEvent({
      source: 'salud',
      event_type: 'alerta_upsert',
      payload,
    });
  }

  // =========================================================
  // Helpers de normalización de estados
  // =========================================================

  private normalizeVisitaEstado(estado?: string): VisitaUpsertPayload['estado'] {
    const normalized = estado?.trim().toUpperCase().replace(/\s+/g, '_');

    if (['REALIZADA', 'FINALIZADA', 'TERMINADA', 'COMPLETADA'].includes(normalized ?? '')) return 'completada';
    if (['EN_ATENCION', 'EN_CAMINO', 'INICIADA', 'EN_CURSO'].includes(normalized ?? '')) return 'en_proceso';
    if (['CANCELADA', 'NO_REALIZADA', 'ANULADA'].includes(normalized ?? '')) return 'cancelada';

    return 'programada';
  }

  private normalizeFichaEstado(estado?: string): FichaUpsertPayload['estado'] {
    const normalized = estado?.trim().toUpperCase();

    if (normalized === 'CERRADA') return 'COMPLETED';
    if (normalized === 'ANULADA') return 'ARCHIVED';

    return 'DRAFT';
  }

  private normalizeAlertaPrioridad(
    prioridad?: string,
  ): AlertaUpsertPayload['prioridad'] {
    const normalized = prioridad?.trim().toUpperCase();

    if (normalized === 'BAJA') return 'LOW';
    if (normalized === 'MEDIA') return 'MEDIUM';
    if (normalized === 'ALTA') return 'HIGH';
    if (normalized === 'CRITICA') return 'CRITICAL';

    return 'MEDIUM';
  }

  private normalizeAlertaEstado(
    estado?: string,
  ): AlertaUpsertPayload['estado'] {
    const normalized = estado?.trim().toUpperCase();

    if (normalized === 'EN_REVISION') return 'IN_PROGRESS';
    if (['RESUELTA', 'CERRADA', 'CANCELADA'].includes(normalized ?? ''))
      return 'CLOSED';

    return 'OPEN';
  }

  // =========================================================
  // Helpers de formato de fecha/hora
  // =========================================================

  private formatDateOnly(value?: Date | string | null): string | null {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);

    const trimmed = String(value).trim();
    const dateOnlyMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
    if (dateOnlyMatch) return dateOnlyMatch[1];

    const date = new Date(trimmed);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10);
  }

  private formatTimeOnly(value?: Date | string | null): string | null {
    if (!value) return null;

    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) return null;
      return value.toISOString().slice(11, 19);
    }

    const trimmed = String(value).trim();
    const timeMatch = trimmed.match(/^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?/);
    if (timeMatch) return `${timeMatch[1]}:${timeMatch[2]}:${timeMatch[3] ?? '00'}`;

    const date = new Date(trimmed);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().slice(11, 19);
  }

  private formatDateTime(value?: Date | string | null): string | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  }

  private normalizeEventsPath(path: string): string {
    const trimmed = path.trim() || '/events';
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  }
}
