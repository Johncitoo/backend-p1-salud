# Integración con Proyecto 3 (Gestión de Pedidos)

Documentación de la integración entre el sistema de salud domiciliaria (`salud`) y el sistema
de Gestión de Pedidos del Proyecto 3, para el envío automático de kits clínicos domiciliarios
prescritos durante una visita.

Contrato original compartido por Proyecto 3: ver `CONTRATO_API_PRESCRIPCIONES.md` (raíz del
repo).

## Resumen

Cuando una visita pasa a estado **REALIZADA** y quedaron medicamentos registrados en ella, le
armamos un "pedido" con esos medicamentos y se lo mandamos a Proyecto 3 vía HTTP `POST`, para
que gestionen el envío físico del kit al domicilio del paciente.

**No enviamos el pedido nosotros** — solo le pasamos los datos a Proyecto 3 (cliente, dirección
de envío, ítems). El envío es **no bloqueante**: si Proyecto 3 rechaza o está caído, se loguea
el error pero completar la visita nunca se interrumpe (mismo patrón que la integración con CRM
y con Notificaciones).

## Estado actual: pendiente de token real

El código ya está implementado, pero corre en **modo mock** (`PEDIDOS_ENABLED=false`) hasta
tener el token compartido (`Authorization: Bearer <token>`) que tiene que coordinar el equipo
con Proyecto 3. En mock, el payload que se habría mandado solo se imprime en los logs con el
prefijo `[Pedidos mock]`.

## Configuración (variables de entorno)

En `backend-p1-salud/.env`:

```env
PEDIDOS_ENABLED=false
PEDIDOS_API_URL=https://agil-escalado.vercel.app/api/webhooks/prescriptions
PEDIDOS_API_TOKEN=
```

Para activar en real: conseguir el token de Proyecto 3, ponerlo en `PEDIDOS_API_TOKEN` y
cambiar `PEDIDOS_ENABLED=true` (tanto local como en Railway).

## Reglas de negocio (decididas 2026-07-08)

- **Disparador**: `VisitasService.completar()` — cuando una visita pasa a `REALIZADA`.
- **Agrupamiento**: un pedido por visita. Nunca se mezclan medicamentos de dos visitas
  distintas en un mismo pedido.
- **Sin medicamentos → sin pedido**: si la visita no tiene ningún `Medicamento` registrado, no
  se envía nada (no tiene sentido un pedido vacío).
- **Email obligatorio**: Proyecto 3 usa `cliente.email` como CustomerID de su lado. Si el
  paciente no tiene email cargado, **el pedido se omite** — pero la visita se completa igual,
  sin bloquear el flujo clínico. Queda solo un `logger.warn` para que Coordinación lo note
  después y complete el dato del paciente.
- **`items[].sku`**: no mandamos un código SKU real de Proyecto 5 (no lo tenemos mapeado) —
  mandamos el nombre completo del medicamento, incluyendo presentación si está disponible en el
  catálogo (ej. `"Paracetamol 500 mg comprimidos"`). **Riesgo conocido**: el contrato de
  Proyecto 3 dice que `sku` debe ser "código identificador del producto en el Inventario
  (Proyecto 5)" — si su sistema espera códigos reales y no reconoce nombres libres, esto puede
  rebotar con 400/409 del lado de ellos. Pendiente confirmar con Proyecto 3 si aceptan nombre
  libre o si hay que armar un mapeo nombre→SKU más adelante.
- **Prioridad**: se mapea 1 a 1 desde `visita.prioridad`, salvo `NORMAL` que no existe en el
  contrato de Proyecto 3 y se traduce a `media`:

  | Nuestra visita | Payload Proyecto 3 |
  |---|---|
  | `BAJA` | `baja` |
  | `NORMAL` | `media` |
  | `ALTA` | `alta` |
  | `URGENTE` | `urgente` |

- **Dirección de envío**: sale de `DireccionPaciente` (la dirección asociada a la visita vía
  `visita.direccionPacienteId`). No tenemos `código_postal` en nuestro modelo, se manda vacío.
  `comuna` mapea a `ciudad` (no tenemos un campo "ciudad" separado).

## Formato del payload

```json
{
  "orderId": "PRSC-<visita.id>",
  "prioridad": "media",
  "cliente": {
    "nombre": "Mon Aramatt",
    "email": "mon.aramatt@email.com",
    "telefono": "+56946313247"
  },
  "direccion_envio": {
    "calle": "Pje. Su Santidad Papa",
    "numero": "",
    "ciudad": "Ovalle",
    "region": "Coquimbo",
    "codigo_postal": "",
    "pais": "Chile",
    "notas_adicionales": ""
  },
  "items": [
    {
      "sku": "Paracetamol 500 mg comprimidos",
      "cantidad": 2,
      "precio_unitario": 0,
      "descuento": 0
    }
  ]
}
```

`precio_unitario` y `descuento` siempre van en `0` (el contrato dice que la prescripción es un
servicio exento de cobro).

## Arquitectura

- **`PedidosService`** (`src/integrations/pedidos/pedidos.service.ts`):
  - `buildPayload(visita, paciente, direccion, items)` — arma el JSON según el contrato.
  - `enviarPedido(payload)` — hace el `POST`; en mock solo loguea, en real hace el request y
    captura cualquier error sin relanzarlo.
- **`PedidosModule`**: exporta `PedidosService`, se importa en `VisitasModule`.
- **`VisitasService.enviarPedidoKitSiCorresponde()`** (método privado, llamado al final de
  `completar()`): busca los `Medicamento` de la visita, resuelve `paciente` y `direccion`, hace
  join a `medicamentos_catalogo` para sacar la presentación de cada ítem, y llama a
  `PedidosService`.

### Archivos involucrados

| Archivo | Rol |
|---------|-----|
| `src/integrations/pedidos/pedidos.service.ts` | Cliente HTTP + armado del payload |
| `src/integrations/pedidos/pedidos.module.ts` | Módulo |
| `src/visitas/visitas.service.ts` | `completar()` dispara `enviarPedidoKitSiCorresponde()` |
| `src/medicamentos/entities/medicamento.entity.ts` | Medicamentos registrados por visita |
| `src/medicamentos/entities/medicamento-catalogo.entity.ts` | Catálogo (nombre + presentación) |
| `src/pacientes/entities/direccion-paciente.entity.ts` | Dirección de envío |

## Cómo probar

**Modo mock** (`PEDIDOS_ENABLED=false`, el actual):
1. Levantar el backend local.
2. Crear una visita, registrar al menos un medicamento (`POST /medicamentos`), y completarla
   (`PATCH /visitas/:id/completar`).
3. Verificar en los logs del backend:
   ```
   [Pedidos mock] PRSC-<uuid> → paciente@email.com:
   { "orderId": "...", "prioridad": "...", "cliente": {...}, "direccion_envio": {...}, "items": [...] }
   ```
4. Si el paciente no tiene email cargado, en cambio debería aparecer:
   ```
   No se envía pedido de kit a Proyecto 3 para visita <uuid>: paciente sin email.
   ```

**Modo real**: una vez que Proyecto 3 pase el token, poner `PEDIDOS_ENABLED=true` y
`PEDIDOS_API_TOKEN=<token>`, repetir la prueba de arriba y confirmar que llega un `201` con
`pedido_id` en la respuesta (se loguea completa).

## Pendiente

- **Token real** de Proyecto 3 (`PEDIDOS_API_TOKEN`) — sin esto no se puede probar en real.
- **Confirmar con Proyecto 3** si aceptan `sku` como nombre libre del medicamento o si hace
  falta un mapeo a códigos reales de inventario (Proyecto 5).
- **Sin tracking de estado**: a diferencia de Notificaciones (Grupo 6), este contrato no expone
  un endpoint de seguimiento post-pedido — solo la respuesta inicial del `POST`. Si Proyecto 3
  rechaza el pedido (400/409) o está caído, hoy eso solo queda en el log del backend; no hay una
  pantalla donde Coordinación pueda ver "este paciente se quedó sin su kit". Si esto importa,
  se podría agregar una tabla de tracking tipo `notificaciones_enviadas` más adelante.
- **Sin reintento automático** si el envío falla (misma limitación que Notificaciones).
