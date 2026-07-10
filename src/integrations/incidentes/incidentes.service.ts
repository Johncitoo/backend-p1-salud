import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { IncidenteSalud } from '../../incidentes-salud/entities/incidente-salud.entity';

// =====================================================================
// Contrato con Grupo 11 (Incidentes operacionales - MochiCode).
// La API central envuelve NUESTRO evento en { sistema_id, creado_en, payload }.
//
// Requisitos DUROS de su contrato oficial:
//  1) El payload DEBE incluir titulo, descripcion y prioridad (critica/alta/
//     media/baja): son los que su Dashboard usa para mostrar la alerta y asignar
//     el SLA. Todo lo demás lo guardan como auditoría (no lo borran).
//  2) Zero Trust: header x-api-key OBLIGATORIO y debe COINCIDIR con sistema_id,
//     si no responden 401. Nosotros: x-api-key = auth_p01_secret.
//
// Además incluimos nuestros campos propios (eventType, severity, etc.) que ellos
// ya mapearon a partir de la propuesta que les enviamos.
// =====================================================================

type Prioridad = 'critica' | 'alta' | 'media' | 'baja';
type Severity = 'low' | 'medium' | 'high' | 'critical';
type EventStatus =
  | 'pending'
  | 'in_progress'
  | 'resolved'
  | 'closed'
  | 'cancelled';

export interface IncidenteOperacionalEvent {
  // --- Obligatorios del contrato oficial (Dashboard + SLA) ---
  titulo: string;
  descripcion: string;
  prioridad: Prioridad;
  // --- Extras de nuestro DTO (mapeados por Grupo 11 + auditoría) ---
  eventId: string;
  source: 'salud-domiciliaria';
  eventType: string;
  occurredAt: string;
  severity: Severity;
  status: EventStatus;
  patientId?: string | null;
  visitId?: string;
  professionalId?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateIncidenteOperacionalPayload {
  sistema_id: string;
  creado_en: string;
  payload: IncidenteOperacionalEvent;
}

// Mapa tipo interno -> eventType del catálogo acordado con Grupo 11.
// FUNCIONA COMO FILTRO: si un incidente no tiene entrada aquí, NO se envía
// (los de IoT clínicos/técnicos quedan fuera; ellos solo gestionan eventos
// operacionales de visitas y sin datos clínicos). ÚNICA excepción: los tickets
// MANUALES de CRM se envían "forzados" (ver enviarIncidente + EVENT_TYPE_FALLBACK).
// Catálogo completo de Grupo 11 (para mapear a futuro): visit_not_registered,
// visit_cancelled_late, professional_no_show, patient_no_response,
// follow_up_required, offline_sync_failed, care_record_incomplete.
const EVENT_TYPE_MAP: Record<string, string> = {
  VISITA_NO_REGISTRADA: 'visit_not_registered',
  VISITA_CANCELADA_TARDIA: 'visit_cancelled_late',
};

@Injectable()
export class IncidentesService {
  private readonly logger = new Logger(IncidentesService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly sistemaId: string;

  // Reintentos con backoff: Grupo 11 corre en Render free tier y puede tardar
  // ~30-50s en "despertar" (cold start). Sin reintentos, el primer fallo perdía
  // el incidente para siempre (solo quedaba un log). Mismo patrón que Analytics.
  private static readonly MAX_ATTEMPTS = 3;
  private static readonly ATTEMPT_TIMEOUT_MS = 20_000;
  private static readonly RETRY_BACKOFF_MS = [3_000, 8_000];
  // eventType genérico del catálogo para tickets MANUALES de CRM cuyo tipo no
  // corresponde a un evento operacional del catálogo. Se usa solo cuando se
  // fuerza el envío (forzar: true); el tipo real se conserva en metadata.
  private static readonly EVENT_TYPE_FALLBACK = 'follow_up_required';

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiUrl =
      this.configService.get<string>('INCIDENTES_API_URL') ||
      'https://proyecto11-mochicode.onrender.com/api/v1/alertas';
    this.apiKey =
      this.configService.get<string>('INCIDENTES_API_KEY') || 'auth_p01_secret';
    // Configurable: debe coincidir con la api-key o Grupo 11 responde 401.
    this.sistemaId =
      this.configService.get<string>('INCIDENTES_SISTEMA_ID') || 'P1';
  }

  /**
   * Envía un incidente operacional al Proyecto 11. Por defecto solo se envían los
   * tipos que mapean a un eventType del catálogo acordado; el resto se omite (log)
   * para no mandarles eventos fuera de su alcance (IoT, etc.).
   *
   * Con `opciones.forzar = true` se envía aunque el tipo no esté mapeado: es el
   * caso de los tickets MANUALES de CRM, que queremos registrar también en Grupo 11
   * (usan un eventType genérico y conservan su tipo real en metadata).
   *
   * No bloquea el flujo principal: cualquier error se loguea, nunca se lanza.
   */
  async enviarIncidente(
    incidente: IncidenteSalud,
    opciones?: { forzar?: boolean },
  ): Promise<void> {
    const evento = this.buildEventFromIncidente(incidente, opciones);

    if (!evento) {
      this.logger.log(
        `Incidente ${incidente.id} (tipo ${incidente.tipo}) no mapea a un eventType de Grupo 11; no se envía.`,
      );
      return;
    }

    const body: CreateIncidenteOperacionalPayload = {
      sistema_id: this.sistemaId,
      creado_en: evento.occurredAt,
      payload: evento,
    };

    for (
      let attempt = 1;
      attempt <= IncidentesService.MAX_ATTEMPTS;
      attempt++
    ) {
      try {
        this.logger.log(
          `Enviando incidente operacional (Ref: ${incidente.id}, eventType: ${evento.eventType}) al Proyecto 11 (intento ${attempt}/${IncidentesService.MAX_ATTEMPTS})...`,
        );

        await firstValueFrom(
          this.httpService.post(this.apiUrl, body, {
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': this.apiKey,
            },
            timeout: IncidentesService.ATTEMPT_TIMEOUT_MS,
          }),
        );

        this.logger.log(
          `Incidente operacional enviado exitosamente al Proyecto 11 (Ref: ${incidente.id})`,
        );
        return;
      } catch (error: any) {
        this.logger.error(
          `Error al enviar incidente al Proyecto 11 (Ref: ${incidente.id}, intento ${attempt}/${IncidentesService.MAX_ATTEMPTS}): ${error.message}`,
          error.response?.data,
        );
      }

      const backoff = IncidentesService.RETRY_BACKOFF_MS[attempt - 1];
      if (backoff) await this.delay(backoff);
    }

    // No lanzamos el error para no interrumpir el flujo principal de Salud.
    this.logger.error(
      `Incidente ${incidente.id} descartado tras ${IncidentesService.MAX_ATTEMPTS} intentos fallidos hacia Grupo 11.`,
    );
  }

  // Construye el evento en el formato de Grupo 11. Devuelve null si el tipo del
  // incidente no está en el catálogo (señal para NO enviarlo), SALVO que se fuerce
  // (opciones.forzar): en ese caso usamos un eventType genérico del catálogo y
  // guardamos el tipo real en metadata.tipoInterno (caso: tickets manuales de CRM).
  private buildEventFromIncidente(
    incidente: IncidenteSalud,
    opciones?: { forzar?: boolean },
  ): IncidenteOperacionalEvent | null {
    const mapped = EVENT_TYPE_MAP[incidente.tipo];
    const eventType =
      mapped ??
      (opciones?.forzar ? IncidentesService.EVENT_TYPE_FALLBACK : undefined);
    if (!eventType) return null;

    const occurredAt = incidente.createdAt
      ? new Date(incidente.createdAt).toISOString()
      : new Date().toISOString();

    const titulo =
      incidente.titulo || `Incidente operacional: ${incidente.tipo}`;
    const descripcion = incidente.descripcion || titulo;

    const evento: IncidenteOperacionalEvent = {
      // Obligatorios oficiales
      titulo,
      descripcion,
      prioridad: this.mapPrioridad(incidente.severidad),
      // Extras (mapeados por ellos + auditoría)
      eventId: incidente.id,
      source: 'salud-domiciliaria',
      eventType,
      occurredAt,
      severity: this.mapSeverity(incidente.severidad),
      status: this.mapStatus(incidente.estado),
      // patientId: nuestro UUID es opaco (sin PII), cumple el "anonimizado" que piden.
      patientId: incidente.pacienteId ?? null,
    };

    // Campos opcionales: solo se incluyen si el incidente ya los trae (sin lookups).
    if (incidente.visitaId) evento.visitId = incidente.visitaId;
    if (incidente.profesionalSaludId)
      evento.professionalId = incidente.profesionalSaludId;

    // Metadata: partimos de la del incidente. Si estamos forzando un tipo NO
    // mapeado (ticket manual de CRM), añadimos su tipo interno real para que
    // Grupo 11 conserve la categoría original bajo el eventType genérico.
    const metadata: Record<string, unknown> = { ...(incidente.metadata ?? {}) };
    if (!mapped && opciones?.forzar) {
      metadata.tipoInterno = incidente.tipo;
      metadata.origenTicket = 'crm';
    }
    if (Object.keys(metadata).length > 0) evento.metadata = metadata;

    return evento;
  }

  private mapPrioridad(severidad?: string): Prioridad {
    const map: Record<string, Prioridad> = {
      BAJA: 'baja',
      MEDIA: 'media',
      ALTA: 'alta',
      CRITICA: 'critica',
    };
    return map[(severidad ?? '').toUpperCase()] ?? 'media';
  }

  private mapSeverity(severidad?: string): Severity {
    const map: Record<string, Severity> = {
      BAJA: 'low',
      MEDIA: 'medium',
      ALTA: 'high',
      CRITICA: 'critical',
    };
    return map[(severidad ?? '').toUpperCase()] ?? 'medium';
  }

  private mapStatus(estado?: string): EventStatus {
    const map: Record<string, EventStatus> = {
      ABIERTO: 'pending',
      EN_REVISION: 'in_progress',
      RESUELTO: 'resolved',
      CERRADO: 'closed',
      CANCELADO: 'cancelled',
    };
    return map[(estado ?? '').toUpperCase()] ?? 'pending';
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
