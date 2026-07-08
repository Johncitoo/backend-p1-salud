import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Paciente } from '../../pacientes/entities/paciente.entity';
import { Visita } from '../../pacientes/entities/visita.entity';
import { NotificacionEnviada } from './entities/notificacion-enviada.entity';

// =========================================================
// Integración con Grupo 6 (Plataforma de notificaciones multicanal).
// Enviamos SOLICITUDES de envío; ellos hacen el envío real (email/SMS).
// Contrato real confirmado (ver docs/INTEGRACION-NOTIFICACIONES-GRUPO6.md):
// POST {NOTIFICATIONS_URL}/notifications/send, header x-api-key.
// =========================================================

type Canal = 'email' | 'sms';

type Destinatario = {
  email?: string | null;
  telefono?: string | null;
};

// Contrato real de la solicitud del Grupo 6: a diferencia del diseño anterior
// (plantilla + variables, especulativo mientras no publicaban su API), acá
// nosotros armamos el asunto y el contenido final (HTML/texto), no un id de
// plantilla.
type SolicitudNotificacion = {
  channel: Canal;
  recipient: { email?: string; telefono?: string };
  subject?: string;
  body: { email?: string; sms?: string };
};

// Datos para asociar el registro de tracking local a la entidad de origen.
type NotificacionContexto = {
  visitaId?: string | null;
  pacienteId?: string | null;
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

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(NotificacionEnviada)
    private readonly enviadasRepo: Repository<NotificacionEnviada>,
  ) {}

  // =========================================================
  // Envío genérico (HTTP POST). No bloqueante: errores se loguean, nunca se lanzan.
  // =========================================================

  private async enviar(
    evento: string,
    destinatario: Destinatario,
    solicitud: SolicitudNotificacion,
    contexto: NotificacionContexto = {},
  ): Promise<void> {
    if (!destinatario.email && !destinatario.telefono) return;

    const enabled = this.configService.get<string>('NOTIFICATIONS_ENABLED') === 'true';
    const baseUrl = (this.configService.get<string>('NOTIFICATIONS_URL') ?? '').trim();
    const path = this.configService.get<string>('NOTIFICATIONS_PATH') ?? '/notifications/send';
    const apiKey = this.configService.get<string>('NOTIFICATIONS_API_KEY') ?? '';

    if (!enabled) {
      this.logger.log(`[Notificaciones mock] ${evento} → ${destinatario.email ?? destinatario.telefono ?? 's/contacto'}:\n${JSON.stringify(solicitud, null, 2)}`);
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
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'x-api-key': apiKey } : {}),
        },
        body: JSON.stringify(solicitud),
      });

      if (!response.ok) {
        this.logger.error(`No se pudo enviar notificación ${evento} al Grupo 6: HTTP ${response.status}`);
        return;
      }

      const data = (await response.json().catch(() => null)) as { notificationId?: string; jobId?: string } | null;
      if (data?.notificationId) {
        await this.enviadasRepo.save(
          this.enviadasRepo.create({
            evento,
            visitaId: contexto.visitaId ?? null,
            pacienteId: contexto.pacienteId ?? null,
            destinatarioEmail: destinatario.email ?? null,
            destinatarioTelefono: destinatario.telefono ?? null,
            notificationId: data.notificationId,
            jobId: data.jobId ?? null,
            estado: 'enviado',
          }),
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`No se pudo enviar notificación ${evento} al Grupo 6: ${message}`);
    }
  }

  // Arma channel/recipient/body a partir de un destinatario que puede tener email
  // y/o teléfono. Con ambos, el canal principal es email con fallback a sms (ver
  // ejemplo de "Email con fallback a SMS" en la doc del Grupo 6).
  private async enviarEmail(
    evento: string,
    destinatario: Destinatario,
    subject: string,
    htmlBody: string,
    smsBody?: string,
    contexto: NotificacionContexto = {},
  ): Promise<void> {
    await this.enviar(
      evento,
      destinatario,
      {
        channel: 'email',
        recipient: {
          ...(destinatario.email ? { email: destinatario.email } : {}),
          ...(destinatario.telefono ? { telefono: destinatario.telefono } : {}),
        },
        subject,
        body: {
          email: htmlBody,
          ...(smsBody ? { sms: smsBody } : {}),
        },
      },
      contexto,
    );
  }

  // =========================================================
  // Plantilla de email (HTML final que recibe el Grupo 6 en body.email).
  // Estilos inline porque los clientes de correo no cargan hojas de estilo
  // externas ni respetan <style> de forma confiable. Colores tomados del
  // theme de la app (yaleBlue/stormyTeal/danger) para que se vea consistente
  // con el resto del producto.
  // =========================================================

  private renderEmailTemplate(saludo: string, contenidoHtml: string): string {
    return `<!doctype html>
<html>
  <body style="margin:0;padding:24px 12px;background-color:#F5F7FA;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background-color:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(40,75,99,0.12);">
            <tr>
              <td style="background-color:#284B63;padding:20px 28px;">
                <span style="color:#FFFFFF;font-size:17px;font-weight:bold;">🏥 Salud Domiciliaria</span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;color:#353535;font-size:15px;line-height:1.6;">
                <p style="margin:0 0 12px;">Hola ${saludo},</p>
                ${contenidoHtml}
              </td>
            </tr>
            <tr>
              <td style="background-color:#F5F7FA;padding:14px 28px;color:#7A7A7A;font-size:11.5px;border-top:1px solid #EAEAEA;">
                Mensaje automático de tu sistema de atención domiciliaria. No respondas a este correo.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  }

  // Tarjeta destacada con fecha/hora — reutilizada en todos los eventos de visita.
  private renderFechaHoraBox(fecha: string | null, hora: string | null): string {
    if (!fecha && !hora) return '';
    return `<div style="background-color:#EEF3F2;border-left:4px solid #3C6E71;border-radius:6px;padding:12px 16px;margin:4px 0 16px;">
      <span style="color:#284B63;font-size:16px;font-weight:bold;">${fecha ?? ''}${fecha && hora ? ' · ' : ''}${hora ?? ''}</span>
    </div>`;
  }

  private renderMotivoBox(motivo?: string | null): string {
    if (!motivo) return '';
    return `<div style="background-color:#FDECEC;border-radius:6px;padding:10px 14px;margin-top:4px;color:#B71C1C;font-size:13.5px;">
      <strong>Motivo:</strong> ${motivo}
    </div>`;
  }

  // =========================================================
  // Notificaciones de creación de entidades
  // =========================================================

  async notificarPacienteCreado(paciente: Paciente): Promise<void> {
    const nombre = `${paciente.nombres} ${paciente.apellidos}`.trim();
    await this.enviarEmail(
      'paciente_creado',
      { email: paciente.email, telefono: paciente.telefono },
      'Bienvenido/a a Salud Domiciliaria',
      this.renderEmailTemplate(
        nombre,
        `<p style="margin:0;">Tu ficha como paciente fue creada correctamente en nuestro sistema de atención domiciliaria.</p>`,
      ),
      undefined,
      { pacienteId: paciente.id },
    );
  }

  async notificarProfesionalCreado(usuario: ContactoUsuario): Promise<void> {
    const nombre = `${usuario.nombres} ${usuario.apellidos}`.trim();
    await this.enviarEmail(
      'profesional_creado',
      { email: usuario.email, telefono: usuario.telefono },
      'Bienvenido/a a Salud Domiciliaria',
      this.renderEmailTemplate(
        nombre,
        `<p style="margin:0;">Tu cuenta de profesional fue creada correctamente en nuestro sistema de atención domiciliaria.</p>`,
      ),
    );
  }

  // =========================================================
  // Notificaciones de visitas
  // =========================================================

  async notificarVisitaAgendada(visita: Visita, paciente: Paciente | null, profesionalUsuario: ContactoUsuario | null): Promise<void> {
    const fecha = this.formatDateOnly(visita.fechaProgramada);
    const hora = this.formatTimeOnly(visita.horaProgramada);
    const nombrePaciente = paciente ? `${paciente.nombres} ${paciente.apellidos}`.trim() : '';
    const nombreProfesional = profesionalUsuario ? `${profesionalUsuario.nombres} ${profesionalUsuario.apellidos}`.trim() : '';

    if (paciente) {
      await this.enviarEmail(
        'visita_agendada',
        { email: paciente.email, telefono: paciente.telefono },
        'Confirmación de tu hora de atención domiciliaria',
        this.renderEmailTemplate(
          nombrePaciente,
          `<p style="margin:0 0 4px;">Se agendó tu atención domiciliaria${nombreProfesional ? ` con <b>${nombreProfesional}</b>` : ''}:</p>` +
          this.renderFechaHoraBox(fecha, hora),
        ),
        undefined,
        { visitaId: visita.id, pacienteId: paciente.id },
      );
    }

    if (profesionalUsuario) {
      await this.enviarEmail(
        'visita_agendada',
        { email: profesionalUsuario.email, telefono: profesionalUsuario.telefono },
        'Nueva visita agendada',
        this.renderEmailTemplate(
          nombreProfesional,
          `<p style="margin:0 0 4px;">Tienes una nueva visita agendada${nombrePaciente ? ` con el paciente <b>${nombrePaciente}</b>` : ''}:</p>` +
          this.renderFechaHoraBox(fecha, hora),
        ),
        undefined,
        { visitaId: visita.id },
      );
    }
  }

  async notificarVisitaCancelada(
    visita: Visita,
    paciente: Paciente | null,
    profesionalUsuario: ContactoUsuario | null,
    motivo?: string | null,
  ): Promise<void> {
    const fecha = this.formatDateOnly(visita.fechaProgramada);
    const hora = this.formatTimeOnly(visita.horaProgramada);
    const motivoSms = motivo ? ` Motivo: ${motivo}.` : '';

    if (paciente) {
      const nombre = `${paciente.nombres} ${paciente.apellidos}`.trim();
      await this.enviarEmail(
        'visita_cancelada',
        { email: paciente.email, telefono: paciente.telefono },
        'Tu atención domiciliaria fue cancelada',
        this.renderEmailTemplate(
          nombre,
          `<p style="margin:0 0 4px;">Tu atención domiciliaria fue <b style="color:#B71C1C;">cancelada</b>:</p>` +
          this.renderFechaHoraBox(fecha, hora) +
          this.renderMotivoBox(motivo),
        ),
        `Tu atención del ${fecha} ${hora} fue cancelada.${motivoSms}`,
        { visitaId: visita.id, pacienteId: paciente.id },
      );
    }

    if (profesionalUsuario) {
      const nombre = `${profesionalUsuario.nombres} ${profesionalUsuario.apellidos}`.trim();
      await this.enviarEmail(
        'visita_cancelada',
        { email: profesionalUsuario.email, telefono: profesionalUsuario.telefono },
        'Visita cancelada',
        this.renderEmailTemplate(
          nombre,
          `<p style="margin:0 0 4px;">La siguiente visita fue <b style="color:#B71C1C;">cancelada</b>:</p>` +
          this.renderFechaHoraBox(fecha, hora) +
          this.renderMotivoBox(motivo),
        ),
        undefined,
        { visitaId: visita.id },
      );
    }
  }

  async notificarVisitaReprogramada(
    visita: Visita,
    paciente: Paciente | null,
    profesionalUsuario: ContactoUsuario | null,
    motivo?: string | null,
  ): Promise<void> {
    const fecha = this.formatDateOnly(visita.fechaProgramada);
    const hora = this.formatTimeOnly(visita.horaProgramada);
    const motivoSms = motivo ? ` Motivo: ${motivo}.` : '';

    if (paciente) {
      const nombre = `${paciente.nombres} ${paciente.apellidos}`.trim();
      await this.enviarEmail(
        'visita_reprogramada',
        { email: paciente.email, telefono: paciente.telefono },
        'Tu atención domiciliaria fue reprogramada',
        this.renderEmailTemplate(
          nombre,
          `<p style="margin:0 0 4px;">Tu atención domiciliaria fue <b style="color:#F9A825;">reprogramada</b> para:</p>` +
          this.renderFechaHoraBox(fecha, hora) +
          this.renderMotivoBox(motivo),
        ),
        `Tu atención fue reprogramada para el ${fecha} ${hora}.${motivoSms}`,
        { visitaId: visita.id, pacienteId: paciente.id },
      );
    }

    if (profesionalUsuario) {
      const nombre = `${profesionalUsuario.nombres} ${profesionalUsuario.apellidos}`.trim();
      await this.enviarEmail(
        'visita_reprogramada',
        { email: profesionalUsuario.email, telefono: profesionalUsuario.telefono },
        'Visita reprogramada',
        this.renderEmailTemplate(
          nombre,
          `<p style="margin:0 0 4px;">La siguiente visita fue <b style="color:#F9A825;">reprogramada</b> para:</p>` +
          this.renderFechaHoraBox(fecha, hora) +
          this.renderMotivoBox(motivo),
        ),
        undefined,
        { visitaId: visita.id },
      );
    }
  }

  // Se dispara cuando el profesional marca "en camino" (VisitasService.cambiarEstado
  // con estado EN_CAMINO). Solo se notifica al paciente: es quien necesita saber que
  // el profesional está en tránsito hacia su domicilio.
  async notificarProfesionalEnCamino(visita: Visita, paciente: Paciente | null, profesionalUsuario: ContactoUsuario | null): Promise<void> {
    if (!paciente) return;

    const nombrePaciente = `${paciente.nombres} ${paciente.apellidos}`.trim();
    const nombreProfesional = profesionalUsuario ? `${profesionalUsuario.nombres} ${profesionalUsuario.apellidos}`.trim() : 'tu profesional';
    const hora = this.formatTimeOnly(visita.horaProgramada);

    await this.enviarEmail(
      'profesional_en_camino',
      { email: paciente.email, telefono: paciente.telefono },
      'Tu profesional va en camino',
      this.renderEmailTemplate(
        nombrePaciente,
        `<p style="margin:0 0 4px;">🚗 <b>${nombreProfesional}</b> va en camino hacia tu domicilio para tu atención de las:</p>` +
        this.renderFechaHoraBox(null, hora),
      ),
      `${nombreProfesional} va en camino a tu domicilio.`,
      { visitaId: visita.id, pacienteId: paciente.id },
    );
  }

  // Recordatorio "un día antes" de la cita (disparado por VisitasService vía @Cron
  // diario). Notifica a paciente y profesional.
  async notificarRecordatorioVisita(visita: Visita, paciente: Paciente | null, profesionalUsuario: ContactoUsuario | null): Promise<void> {
    const fecha = this.formatDateOnly(visita.fechaProgramada);
    const hora = this.formatTimeOnly(visita.horaProgramada);

    if (paciente) {
      const nombre = `${paciente.nombres} ${paciente.apellidos}`.trim();
      await this.enviarEmail(
        'recordatorio_visita',
        { email: paciente.email, telefono: paciente.telefono },
        'Recordatorio: tu atención domiciliaria es mañana',
        this.renderEmailTemplate(
          nombre,
          `<p style="margin:0 0 4px;">🔔 Te recordamos tu atención domiciliaria de mañana:</p>` +
          this.renderFechaHoraBox(fecha, hora),
        ),
        `Recordatorio: tu atención domiciliaria es mañana ${fecha} a las ${hora}.`,
        { visitaId: visita.id, pacienteId: paciente.id },
      );
    }

    if (profesionalUsuario) {
      const nombre = `${profesionalUsuario.nombres} ${profesionalUsuario.apellidos}`.trim();
      await this.enviarEmail(
        'recordatorio_visita',
        { email: profesionalUsuario.email, telefono: profesionalUsuario.telefono },
        'Recordatorio: tienes una visita mañana',
        this.renderEmailTemplate(
          nombre,
          `<p style="margin:0 0 4px;">🔔 Tienes una visita domiciliaria agendada para mañana:</p>` +
          this.renderFechaHoraBox(fecha, hora),
        ),
        undefined,
        { visitaId: visita.id },
      );
    }
  }

  // =========================================================
  // Consulta de notificaciones enviadas / tracking (fase 2)
  // =========================================================

  async findEnviadas(filtros: { visitaId?: string; pacienteId?: string }): Promise<NotificacionEnviada[]> {
    const where: Record<string, unknown> = {};
    if (filtros.visitaId) where.visitaId = filtros.visitaId;
    if (filtros.pacienteId) where.pacienteId = filtros.pacienteId;

    return this.enviadasRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  // Refresca el estado local consultando GET /tracking/:notificationId del Grupo 6.
  async refrescarTracking(id: string): Promise<NotificacionEnviada & { trackingRaw?: unknown }> {
    const registro = await this.enviadasRepo.findOne({ where: { id } });
    if (!registro) throw new NotFoundException('Notificación no encontrada');

    const baseUrl = (this.configService.get<string>('NOTIFICATIONS_URL') ?? '').trim();
    const apiKey = this.configService.get<string>('NOTIFICATIONS_API_KEY') ?? '';
    if (!baseUrl) return registro;

    try {
      const response = await fetch(`${baseUrl}/tracking/${registro.notificationId}`, {
        headers: { ...(apiKey ? { 'x-api-key': apiKey } : {}) },
      });
      if (!response.ok) {
        this.logger.error(`No se pudo consultar tracking de ${registro.notificationId}: HTTP ${response.status}`);
        return registro;
      }

      const data = (await response.json()) as { status?: string };
      if (data.status) {
        registro.estado = data.status;
        await this.enviadasRepo.save(registro);
      }

      return { ...registro, trackingRaw: data };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`No se pudo consultar tracking de ${registro.notificationId}: ${message}`);
      return registro;
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
    const trimmed = path.trim() || '/notifications/send';
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  }
}
