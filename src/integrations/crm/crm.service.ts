import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { Paciente } from '../../pacientes/entities/paciente.entity';
import { IncidenteSalud } from '../../incidentes-salud/entities/incidente-salud.entity';

export interface CreateCrmTicketPayload {
  asunto: string;
  descripcion?: string;
  prioridad: 'baja' | 'media' | 'alta' | 'critica';
  sistema_origen: 'salud';
  sistema_id: 'P01';
  cliente_nombre: string;
  cliente_email?: string;
  cliente_telefono?: string;
  salud_ref?: string;
  contexto?: string;
}

@Injectable()
export class CrmService {
  private readonly logger = new Logger(CrmService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiUrl = this.configService.get<string>('CRM_API_URL') || 'https://pgti-proyecto-crm-backend.vercel.app/api/v1/tickets/externo';
    this.apiKey = this.configService.get<string>('CRM_API_KEY') || 'salud_secret_p01';
  }

  async crearTicket(payload: CreateCrmTicketPayload): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(this.apiUrl, payload, {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
          },
        }),
      );
      this.logger.log(`Ticket de CRM creado exitosamente. Salud Ref: ${payload.salud_ref}`);
      return response.data;
    } catch (error: any) {
      this.logger.error(
        `Error al crear ticket en CRM: ${error.message}`,
        error.response?.data,
      );
      // No lanzamos error para no interrumpir el flujo principal de creación de incidente
      return null;
    }
  }

  async consultarEstadoTicket(ticketId: string): Promise<string | null> {
    try {
      const url = `${this.apiUrl}/${ticketId}?api_key=${this.apiKey}`;
      const response = await firstValueFrom(this.httpService.get(url));
      return response.data?.ticket?.estado || null;
    } catch (error: any) {
      this.logger.error(
        `Error al consultar estado del ticket en CRM: ${error.message}`,
      );
      return null;
    }
  }

  buildPayloadFromIncidente(incidente: IncidenteSalud, paciente: Paciente | null): CreateCrmTicketPayload {
    const prioridadMap: Record<string, 'baja' | 'media' | 'alta' | 'critica'> = {
      'BAJA': 'baja',
      'MEDIA': 'media',
      'ALTA': 'alta',
      'CRITICA': 'critica',
    };

    const prioridad = prioridadMap[incidente.severidad] || 'media';
    const nombreCliente = paciente ? `${paciente.nombres} ${paciente.apellidos}`.trim() : 'Paciente Desconocido';
    const emailCliente = paciente?.email || 'no-reply@salud.cl'; // Fallback ya que es obligatorio en CRM

    return {
      asunto: incidente.titulo || `Incidente de Salud: ${incidente.tipo}`,
      descripcion: incidente.descripcion || '',
      prioridad,
      sistema_origen: 'salud',
      sistema_id: 'P01',
      cliente_nombre: nombreCliente,
      cliente_email: emailCliente,
      cliente_telefono: paciente?.telefono || undefined,
      salud_ref: incidente.id,
      contexto: JSON.stringify({ origen: 'SISTEMA', modulo: 'Incidentes Salud' }),
    };
  }
}
