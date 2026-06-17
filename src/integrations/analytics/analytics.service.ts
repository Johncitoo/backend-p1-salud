import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Visita } from '../../pacientes/entities/visita.entity';

type AnalyticsVisitPayload = {
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
};

type AnalyticsVisitEvent = {
  source: 'salud';
  event_type: 'visita_upsert';
  payload: AnalyticsVisitPayload;
};

type VisitAnalyticsOptions = {
  puntual?: boolean | null;
};

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly configService: ConfigService) {}

  async sendVisitUpsertEvent(visita: Visita, options: VisitAnalyticsOptions = {}): Promise<void> {
    const event = this.buildVisitUpsertEvent(visita, options);
    const enabled = this.configService.get<string>('ANALYTICS_ENABLED') === 'true';
    const baseUrl = (this.configService.get<string>('ANALYTICS_URL') ?? '').trim();
    const eventsPath = this.configService.get<string>('ANALYTICS_EVENTS_PATH') ?? '/events';

    if (!enabled) {
      this.logger.log(`[Analytics mock] Evento visita_upsert:\n${JSON.stringify(event, null, 2)}`);
      return;
    }

    if (!baseUrl) {
      this.logger.warn(`ANALYTICS_ENABLED=true pero ANALYTICS_URL está vacío. Evento no enviado:\n${JSON.stringify(event, null, 2)}`);
      return;
    }

    const endpoint = `${baseUrl}${this.normalizeEventsPath(eventsPath)}`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      });

      if (!response.ok) {
        this.logger.error(`No se pudo enviar evento a Analítica: HTTP ${response.status}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`No se pudo enviar evento a Analítica: ${message}`);
    }
  }

  private buildVisitUpsertEvent(visita: Visita, options: VisitAnalyticsOptions): AnalyticsVisitEvent {
    const estado = this.normalizeEstado(visita.estado);

    return {
      source: 'salud',
      event_type: 'visita_upsert',
      payload: {
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
      },
    };
  }

  private normalizeEstado(estado?: string): AnalyticsVisitPayload['estado'] {
    const normalized = estado?.trim().toUpperCase().replace(/\s+/g, '_');

    if (['REALIZADA', 'FINALIZADA', 'TERMINADA', 'COMPLETADA'].includes(normalized ?? '')) return 'completada';
    if (['EN_ATENCION', 'EN_CAMINO', 'INICIADA', 'EN_CURSO'].includes(normalized ?? '')) return 'en_proceso';
    if (['CANCELADA', 'NO_REALIZADA', 'ANULADA'].includes(normalized ?? '')) return 'cancelada';

    return 'programada';
  }

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
