import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { DireccionPaciente } from '../../pacientes/entities/direccion-paciente.entity';
import { Paciente } from '../../pacientes/entities/paciente.entity';
import { Visita } from '../../pacientes/entities/visita.entity';
import { InspeccionMantenimiento } from '../../mantenimiento/entities/inspeccion-mantenimiento.entity';

export type PrescripcionItem = {
  nombre: string;
  cantidad: number;
};

// Resultado del webhook de mantenimiento hacia Proyecto 3. No se lanza excepción:
// el caller (MantenimientoService) usa esto para persistir el estado del pedido.
export type ResultadoPedidoMantenimiento =
  | { ok: true; mock: boolean; pedidoId?: string; estado?: string }
  | { ok: false; error: string; tipo?: string };

export interface PrescripcionPedidoPayload {
  orderId: string;
  prioridad: 'baja' | 'media' | 'alta' | 'urgente';
  cliente: {
    nombre: string;
    email: string;
    telefono?: string;
  };
  direccion_envio: {
    calle: string;
    numero: string;
    ciudad: string;
    region: string;
    codigo_postal: string;
    pais: string;
    notas_adicionales: string;
  };
  items: Array<{
    sku: string;
    cantidad: number;
    precio_unitario: number;
    descuento: number;
  }>;
}

const PRIORIDAD_MAP: Record<string, PrescripcionPedidoPayload['prioridad']> = {
  BAJA: 'baja',
  NORMAL: 'media',
  ALTA: 'alta',
  URGENTE: 'urgente',
};

// Integración con Proyecto 3 (Gestión de Pedidos): cuando una visita con
// medicamentos registrados pasa a REALIZADA, se le arma un "pedido" de kit
// clínico domiciliario. Ver CONTRATO_API_PRESCRIPCIONES.md para el contrato
// completo. Sigue el mismo patrón que CrmService: si Proyecto 3 rechaza o está
// caído, no debe romper el flujo clínico de completar la visita — solo se
// loguea para revisión manual.
@Injectable()
export class PedidosService {
  private readonly logger = new Logger(PedidosService.name);
  private readonly apiUrl: string;
  private readonly mantenimientoUrl: string;
  private readonly apiToken?: string;
  private readonly enabled: boolean;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiUrl = this.configService.get<string>('PEDIDOS_API_URL')
      || 'https://agil-escalado.vercel.app/api/webhooks/prescriptions';
    this.mantenimientoUrl = this.configService.get<string>('PEDIDOS_MANTENIMIENTO_URL')
      || 'https://agil-escalado.vercel.app/api/webhooks/maintenance';
    this.apiToken = this.configService.get<string>('PEDIDOS_API_TOKEN');
    // Igual que NOTIFICATIONS_ENABLED: por defecto en modo mock (solo loguea)
    // hasta tener el token real coordinado con Proyecto 3.
    this.enabled = this.configService.get<string>('PEDIDOS_ENABLED') === 'true';
  }

  buildPayload(
    visita: Visita,
    paciente: Paciente,
    direccion: DireccionPaciente | null,
    items: PrescripcionItem[],
  ): PrescripcionPedidoPayload {
    return {
      orderId: `PRSC-${visita.id}`,
      prioridad: PRIORIDAD_MAP[visita.prioridad] ?? 'media',
      cliente: {
        nombre: `${paciente.nombres} ${paciente.apellidos}`.trim(),
        email: paciente.email!,
        telefono: paciente.telefono ?? undefined,
      },
      direccion_envio: {
        calle: direccion?.calle ?? '',
        numero: direccion?.numero ?? '',
        ciudad: direccion?.comuna ?? '',
        region: direccion?.region ?? '',
        codigo_postal: '',
        pais: 'Chile',
        notas_adicionales: direccion?.referencia ?? '',
      },
      items: items.map(item => ({
        sku: item.nombre,
        cantidad: item.cantidad,
        precio_unitario: 0,
        descuento: 0,
      })),
    };
  }

  async enviarPedido(payload: PrescripcionPedidoPayload): Promise<void> {
    if (!this.enabled) {
      this.logger.log(`[Pedidos mock] ${payload.orderId} → ${payload.cliente.email}:\n${JSON.stringify(payload, null, 2)}`);
      return;
    }

    if (!this.apiToken) {
      this.logger.warn(`PEDIDOS_ENABLED=true pero PEDIDOS_API_TOKEN está vacío. Pedido no enviado: ${payload.orderId}`);
      return;
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post(this.apiUrl, payload, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiToken}`,
          },
        }),
      );
      this.logger.log(`Pedido ${payload.orderId} enviado a Proyecto 3. Respuesta: ${JSON.stringify(response.data)}`);
    } catch (error: any) {
      this.logger.error(
        `No se pudo enviar el pedido ${payload.orderId} a Proyecto 3: ${error.message}`,
        error.response?.data,
      );
      // No se relanza: un fallo acá no debe impedir completar la visita clínica.
    }
  }

  // ===================================================================
  // Mantenimiento preventivo (webhook /maintenance). Proyecto 3 marca el pedido
  // como exento de pago y lo libera automáticamente. Ver contrato de Mantenimiento.
  // ===================================================================

  buildMantenimientoPayload(
    inspeccion: InspeccionMantenimiento,
    paciente: Paciente,
    direccion: DireccionPaciente | null,
  ): PrescripcionPedidoPayload {
    const prioridad = (['baja', 'media', 'alta', 'urgente'] as const).includes(
      inspeccion.prioridad as any,
    )
      ? (inspeccion.prioridad as PrescripcionPedidoPayload['prioridad'])
      : 'media';

    return {
      orderId: `MANT-${inspeccion.id}`,
      prioridad,
      cliente: {
        nombre: `${paciente.nombres} ${paciente.apellidos}`.trim(),
        email: paciente.email!,
        telefono: paciente.telefono ?? undefined,
      },
      direccion_envio: {
        calle: direccion?.calle ?? '',
        numero: direccion?.numero ?? '',
        ciudad: direccion?.comuna ?? '',
        region: direccion?.region ?? '',
        codigo_postal: '',
        pais: 'Chile',
        notas_adicionales: direccion?.referencia ?? '',
      },
      // precio_unitario 0: mantenimiento preventivo cubierto por contrato (exento).
      items: inspeccion.repuestos.map((r) => ({
        sku: r.sku,
        cantidad: r.cantidad,
        precio_unitario: 0,
        descuento: 0,
      })),
    };
  }

  // Envía el pedido de repuestos y DEVUELVE el resultado (no lanza) para que el
  // caller persista el estado: 201 → pedido_id; 400/409/red → error + tipo.
  async enviarPedidoMantenimiento(
    payload: PrescripcionPedidoPayload,
  ): Promise<ResultadoPedidoMantenimiento> {
    if (!this.enabled) {
      this.logger.log(`[Pedidos mantenimiento mock] ${payload.orderId} → ${payload.cliente.email}:\n${JSON.stringify(payload, null, 2)}`);
      return { ok: true, mock: true };
    }

    if (!this.apiToken) {
      this.logger.warn(`PEDIDOS_ENABLED=true pero PEDIDOS_API_TOKEN está vacío. Pedido no enviado: ${payload.orderId}`);
      return { ok: false, error: 'PEDIDOS_API_TOKEN no configurado' };
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post(this.mantenimientoUrl, payload, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiToken}`,
          },
          timeout: 20_000,
        }),
      );
      const data = response.data ?? {};
      this.logger.log(`Pedido de mantenimiento ${payload.orderId} enviado a Proyecto 3. Respuesta: ${JSON.stringify(data)}`);
      return { ok: true, mock: false, pedidoId: data.pedido_id, estado: data.estado };
    } catch (error: any) {
      const data = error.response?.data;
      const mensaje = data?.error || error.message || 'Error desconocido';
      this.logger.error(
        `No se pudo enviar el pedido de mantenimiento ${payload.orderId} a Proyecto 3: ${mensaje}`,
        data,
      );
      return { ok: false, error: mensaje, tipo: data?.tipo };
    }
  }
}
