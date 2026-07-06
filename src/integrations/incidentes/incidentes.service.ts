import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { IncidenteSalud } from '../../incidentes-salud/entities/incidente-salud.entity';

export interface CreateIncidenteOperacionalPayload {
  sistema_id: string;
  creado_en: string;
  payload: {
    titulo: string;
    descripcion: string;
    prioridad: 'critica' | 'alta' | 'media' | 'baja';
    // Extras (para auditoría)
    incidente_interno_id?: string;
    paciente_id?: string | null;
    estado?: string;
    tipo?: string;
  };
}

@Injectable()
export class IncidentesService {
  private readonly logger = new Logger(IncidentesService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly sistemaId = 'P01';

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiUrl = this.configService.get<string>('INCIDENTES_API_URL') || 'https://proyecto11-mochicode.onrender.com/api/v1/alertas';
    this.apiKey = this.configService.get<string>('INCIDENTES_API_KEY') || 'auth_p01_secret';
  }

  /**
   * Envía una alerta de incidente operacional al Proyecto 11
   */
  async enviarIncidente(incidente: IncidenteSalud): Promise<void> {
    try {
      const payload = this.buildPayloadFromIncidente(incidente);
      
      this.logger.log(`Enviando incidente operacional (Ref: ${incidente.id}) al Proyecto 11...`);
      
      await firstValueFrom(
        this.httpService.post(this.apiUrl, payload, {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
          },
        }),
      );
      
      this.logger.log(`Incidente operacional enviado exitosamente al Proyecto 11 (Ref: ${incidente.id})`);
    } catch (error: any) {
      this.logger.error(
        `Error al enviar incidente operacional al Proyecto 11: ${error.message}`,
        error.response?.data,
      );
      // No lanzamos el error para no interrumpir el flujo principal de Salud
    }
  }

  private buildPayloadFromIncidente(incidente: IncidenteSalud): CreateIncidenteOperacionalPayload {
    // Mapeo de severidades
    const prioridadMap: Record<string, 'critica' | 'alta' | 'media' | 'baja'> = {
      'BAJA': 'baja',
      'MEDIA': 'media',
      'ALTA': 'alta',
      'CRITICA': 'critica',
    };

    const prioridad = prioridadMap[incidente.severidad] || 'media';

    return {
      sistema_id: this.sistemaId,
      creado_en: new Date().toISOString(),
      payload: {
        titulo: incidente.titulo || `Incidente de Salud: ${incidente.tipo}`,
        descripcion: incidente.descripcion || 'Incidente generado desde Salud Domiciliaria',
        prioridad,
        incidente_interno_id: incidente.id,
        paciente_id: incidente.pacienteId,
        estado: incidente.estado,
        tipo: incidente.tipo,
      },
    };
  }
}
