import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Paciente } from '../../pacientes/entities/paciente.entity';
import { Visita } from '../../pacientes/entities/visita.entity';

// =========================================================
// Integración con Grupo 6 (Plataforma de notificaciones multicanal)
// Enviamos SOLICITUDES de envío; ellos hacen el envío real (email/SMS/push).
// Como el Grupo 6 aún no publica su API, el módulo arranca en modo mock.
// =========================================================

type Canal = 'email' | 'sms' | 'push';
type Prioridad = 'alta' | 'normal' | 'baja';

type Destinatario = {
  nombre: string;
  email: string | null;
  telefono: string | null;
};

// Contrato de la solicitud (basado en la arquitectura propuesta del Grupo 6:
// plantilla + canal + prioridad + destinatario + variables dinámicas).
type SolicitudNotificacion = {
  source: 'salud';
  evento: string;
  canal: Canal;
  prioridad: Prioridad;
  destinatario: Destinatario;
  plantilla: string;
  variables: Record<string, unknown>;
};

// Forma estructural mínima del usuario del profesional (para no acoplar al service de usuarios).
type ContactoUsuario = {
  nombres: string;
  apellidos: string;
  email?: string | null;
  telefono?: string | null;
};

@Injectable()
export class NotificacionesService {
  private readonly logger = new Logger(NotificacionesService.name);

  constructor(private readonly configService: ConfigService) {}

  // =========================================================
  // Envío genérico (HTTP POST). No bloqueante: errores se loguean, nunca se lanzan.
  // =========================================================

  private async enviar(solicitud: SolicitudNotificacion): Promise<void> {
    const enabled = this.configService.get<string>('NOTIFICATIONS_ENABLED') === 'true';
    const baseUrl = (this.configService.get<string>('NOTIFICATIONS_URL') ?? '').trim();
    const path = this.configService.get<string>('NOTIFICATIONS_PATH') ?? '/notifications';

    if (!enabled) {
      this.logger.log(`[Notificaciones mock] ${solicitud.evento} → ${solicitud.destinatario.email ?? solicitud.destinatario.telefono ?? 's/contacto'}:\n${JSON.stringify(solicitud, null, 2)}`);
      return;
    }

    if (!baseUrl) {
      this.logger.warn(`NOTIFICATIONS_ENABLED=true pero NOTIFICATIONS_URL está vacío. Solicitud no enviada:\n${JSON.stringify(solicitud, null, 2)}`);
      return;
    }

    const endpoint = `${baseUrl}${this.normalizePath(path)}`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(solicitud),
      });

      if (!response.ok) {
        this.logger.error(`No se pudo enviar notificación ${solicitud.evento} al Grupo 6: HTTP ${response.status}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`No se pudo enviar notificación ${solicitud.evento} al Grupo 6: ${message}`);
    }
  }

  // =========================================================
  // Notificaciones de creación de entidades
  // =========================================================

  async notificarPacienteCreado(paciente: Paciente): Promise<void> {
    await this.enviar({
      source: 'salud',
      evento: 'paciente_creado',
      canal: 'email',
      prioridad: 'normal',
      destinatario: {
        nombre: `${paciente.nombres} ${paciente.apellidos}`.trim(),
        email: paciente.email ?? null,
        telefono: paciente.telefono ?? null,
      },
      plantilla: 'paciente_creado',
      variables: {
        nombres: paciente.nombres,
        apellidos: paciente.apellidos,
      },
    });
  }

  async notificarProfesionalCreado(usuario: ContactoUsuario): Promise<void> {
    await this.enviar({
      source: 'salud',
      evento: 'profesional_creado',
      canal: 'email',
      prioridad: 'normal',
      destinatario: {
        nombre: `${usuario.nombres} ${usuario.apellidos}`.trim(),
        email: usuario.email ?? null,
        telefono: usuario.telefono ?? null,
      },
      plantilla: 'profesional_creado',
      variables: {
        nombres: usuario.nombres,
        apellidos: usuario.apellidos,
      },
    });
  }

  // =========================================================
  // Notificaciones de visitas (a paciente Y profesional)
  // =========================================================

  async notificarVisitaAgendada(visita: Visita, paciente: Paciente | null, profesionalUsuario: ContactoUsuario | null): Promise<void> {
    await this.notificarEventoVisita('visita_agendada', visita, paciente, profesionalUsuario);
  }

  async notificarVisitaCancelada(visita: Visita, paciente: Paciente | null, profesionalUsuario: ContactoUsuario | null): Promise<void> {
    await this.notificarEventoVisita('visita_cancelada', visita, paciente, profesionalUsuario, 'alta');
  }

  async notificarVisitaReprogramada(visita: Visita, paciente: Paciente | null, profesionalUsuario: ContactoUsuario | null): Promise<void> {
    await this.notificarEventoVisita('visita_reprogramada', visita, paciente, profesionalUsuario, 'alta');
  }

  // Arma y envía una notificación al paciente y otra al profesional para un evento de visita.
  private async notificarEventoVisita(
    evento: string,
    visita: Visita,
    paciente: Paciente | null,
    profesionalUsuario: ContactoUsuario | null,
    prioridad: Prioridad = 'normal',
  ): Promise<void> {
    const nombrePaciente = paciente ? `${paciente.nombres} ${paciente.apellidos}`.trim() : '';
    const nombreProfesional = profesionalUsuario ? `${profesionalUsuario.nombres} ${profesionalUsuario.apellidos}`.trim() : '';

    const variables = {
      visita_id: visita.id,
      paciente: nombrePaciente,
      profesional: nombreProfesional,
      fecha: this.formatDateOnly(visita.fechaProgramada),
      hora: this.formatTimeOnly(visita.horaProgramada),
    };

    if (paciente) {
      await this.enviar({
        source: 'salud',
        evento,
        canal: 'email',
        prioridad,
        destinatario: {
          nombre: nombrePaciente,
          email: paciente.email ?? null,
          telefono: paciente.telefono ?? null,
        },
        plantilla: `${evento}_paciente`,
        variables,
      });
    }

    if (profesionalUsuario) {
      await this.enviar({
        source: 'salud',
        evento,
        canal: 'email',
        prioridad,
        destinatario: {
          nombre: nombreProfesional,
          email: profesionalUsuario.email ?? null,
          telefono: profesionalUsuario.telefono ?? null,
        },
        plantilla: `${evento}_profesional`,
        variables,
      });
    }
  }

  // =========================================================
  // Helpers de formato (mismo estilo que AnalyticsService)
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

    return null;
  }

  private normalizePath(path: string): string {
    const trimmed = path.trim() || '/notifications';
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  }
}
