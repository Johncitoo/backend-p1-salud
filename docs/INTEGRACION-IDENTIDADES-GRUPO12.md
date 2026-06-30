# Integración con Grupo 12 (Identidades y Accesos)

Documentación de la integración entre el sistema de salud domiciliaria (Proyecto 1)
y la plataforma de identidades y accesos del Grupo 12 (Proyecto 12), que administra
un Keycloak centralizado compartido por todos los proyectos.

## Resumen

El Grupo 12 gestiona un **Keycloak centralizado** que autentica a los usuarios de todos
los proyectos. Nuestro sistema se conecta como cliente `p1` de ese Keycloak. La autenticación
funciona así:

1. El usuario abre el frontend → se redirige al Keycloak del Grupo 12 para login
2. Keycloak autentica y devuelve un JWT con roles
3. El frontend envía el JWT en cada petición al backend (`Authorization: Bearer <token>`)
4. El backend valida la firma del JWT contra las claves JWKS del Keycloak del Grupo 12
5. El backend busca/linkea al usuario local por `sub` o email

## Keycloak del Grupo 12

- **URL**: `https://underarm-those-stardust.ngrok-free.dev` (túnel ngrok, puede cambiar)
- **Realm**: `sistema-centralizado`
- **Client ID**: `p1` (cliente público creado por el Grupo 12 para nuestro proyecto)
- **Contacto**: Yamira (Blopa)

> **IMPORTANTE**: La URL de ngrok es temporal. Si cambia, hay que actualizar las variables
> de entorno en `docker-compose.yml` y reconstruir las imágenes.

## Estructura del token JWT

```json
{
  "sub": "8076a1a6-7b14-477c-bebe-4daf03eebdef",
  "iss": "https://underarm-those-stardust.ngrok-free.dev/realms/sistema-centralizado",
  "aud": ["p1", "account"],
  "realm_access": {
    "roles": ["default-roles-sistema-centralizado", "offline_access", "p1-access", "uma_authorization"]
  },
  "resource_access": {
    "p1": {
      "roles": ["admin"]
    }
  },
  "email": "p1.admin.01@test.local",
  "preferred_username": "p1.admin.01@test.local"
}
```

### Roles en el token

| Ubicación | Propósito | Ejemplo |
|-----------|-----------|---------|
| `realm_access.roles` | Acceso general a la aplicación | `p1-access` = tiene permiso para entrar a nuestro frontend |
| `resource_access.p1.roles` | Rol específico dentro de nuestra app | `admin`, `supervisor`, `profesional`, `coordinador` |

### Flujo de verificación (frontend)

1. Verificar que `realm_access.roles` incluye `p1-access` → si no, mostrar "Acceso denegado"
2. Leer `resource_access.p1.roles` para determinar qué vistas mostrar (admin/supervisor/etc)

## Configuración

### Frontend (`docker-compose.yml` build args o `.env`)

```env
VITE_KEYCLOAK_URL=https://underarm-those-stardust.ngrok-free.dev
VITE_KEYCLOAK_REALM=sistema-centralizado
VITE_KEYCLOAK_CLIENT_ID=p1
VITE_KEYCLOAK_ACCESS_ROLE=p1-access
```

### Backend (`docker-compose.yml` environment o `.env`)

```env
AUTH_MODE=keycloak
KEYCLOAK_REALM=sistema-centralizado
KEYCLOAK_ISSUER=https://underarm-those-stardust.ngrok-free.dev/realms/sistema-centralizado
KEYCLOAK_JWKS_URI=https://underarm-those-stardust.ngrok-free.dev/realms/sistema-centralizado/protocol/openid-connect/certs
KEYCLOAK_AUDIENCE=p1
KEYCLOAK_VALIDATE_AUDIENCE=false
```

### Para volver al Keycloak local (desarrollo sin Grupo 12)

Frontend:
```env
VITE_KEYCLOAK_URL=http://localhost:8080
VITE_KEYCLOAK_CLIENT_ID=proyecto-test
VITE_KEYCLOAK_ACCESS_ROLE=
```

Backend:
```env
AUTH_MODE=mock
KEYCLOAK_ISSUER=http://localhost/realms/sistema-centralizado
KEYCLOAK_JWKS_URI=http://localhost/realms/sistema-centralizado/protocol/openid-connect/certs
```

## Usuarios de prueba del Grupo 12

Usuarios creados por Yamira (Grupo 12) en su Keycloak, con usuarios locales correspondientes
en nuestra base de datos PostgreSQL:

### Administradores

| Email | Clave | Rol en BD | identity_user_id |
|-------|-------|-----------|------------------|
| `p1.admin.01@test.local` | `12345` | ADMIN | `8076a1a6-7b14-477c-bebe-4daf03eebdef` |
| `p1.admin.02@test.local` | `Admin#2026_02` | ADMIN | Se linkea en primer login |

### Coordinadores

| Email | Clave | Rol en BD | identity_user_id |
|-------|-------|-----------|------------------|
| `p1.coordinator.01@test.local` | `Coord#2026_01` | COORDINADOR | Se linkea en primer login |
| `p1.coordinator.02@test.local` | `Coord#2026_02` | COORDINADOR | Se linkea en primer login |

### Profesionales

| Email | Clave | Rol en BD | identity_user_id |
|-------|-------|-----------|------------------|
| `p1.professional.01@test.local` | `Prof#2026_01` | PROFESIONAL | Se linkea en primer login |
| `p1.professional.02@test.local` | `Prof#2026_02` | PROFESIONAL | Se linkea en primer login |

### Supervisores

| Email | Clave | Rol en BD | identity_user_id |
|-------|-------|-----------|------------------|
| `p1.supervisor.01@test.local` | `Sup#2026_01` | SUPERVISOR | Se linkea en primer login |
| `p1.supervisor.02@test.local` | `Sup#2026_02` | SUPERVISOR | Se linkea en primer login |

> **Nota sobre "Se linkea en primer login"**: Estos usuarios fueron creados en la BD local
> sin `identity_user_id`. Cuando el usuario hace login por primera vez con el Keycloak del
> Grupo 12, el backend busca por email, encuentra al usuario, y guarda automáticamente el
> `sub` del token como `identity_user_id`. En logins posteriores se busca directo por `sub`.

## Cambios realizados en el código

### Frontend (`frontend-p1-salud`)

| Archivo | Cambio |
|---------|--------|
| `src/features/auth/keycloak.ts` | Agregadas funciones `getKeycloakAppRoles()` y `getKeycloakAppRole()` para leer `resource_access.p1.roles` |
| `Dockerfile` | Agregado ARG `VITE_KEYCLOAK_ACCESS_ROLE` para el build |

### Backend (`backend-p1-salud`)

No se requirieron cambios de código. El backend ya soportaba `AUTH_MODE=keycloak` con
validación JWKS vía `DevAuthGuard`. Solo se cambiaron variables de entorno.

### Configuración (`docker-compose.yml`)

| Sección | Cambio |
|---------|--------|
| Backend environment | `KEYCLOAK_ISSUER`, `KEYCLOAK_JWKS_URI` y `KEYCLOAK_AUDIENCE` apuntan al Keycloak del Grupo 12 |
| Frontend build args | `VITE_KEYCLOAK_URL`, `VITE_KEYCLOAK_CLIENT_ID` y `VITE_KEYCLOAK_ACCESS_ROLE` configurados para el cliente `p1` |

### Base de datos

8 usuarios insertados en la tabla `usuarios` con los emails del Grupo 12 y los roles
correspondientes. El SQL para recrearlos:

```sql
-- Admin 01 (ya linkeado con sub del Grupo 12)
INSERT INTO usuarios (identity_user_id, rol_id, rut, nombres, apellidos, email, telefono, activo)
VALUES ('8076a1a6-7b14-477c-bebe-4daf03eebdef',
  (SELECT id FROM roles WHERE nombre='ADMIN' LIMIT 1),
  '99.999.999-9', 'Admin', 'Grupo12', 'p1.admin.01@test.local', '+56900000000', TRUE)
ON CONFLICT (email) DO NOTHING;

-- Resto de usuarios (identity_user_id se linkea en primer login)
INSERT INTO usuarios (identity_user_id, rol_id, rut, nombres, apellidos, email, telefono, activo) VALUES
(NULL, (SELECT id FROM roles WHERE nombre='ADMIN' LIMIT 1), '22.222.221-1', 'Admin 02', 'Grupo12', 'p1.admin.02@test.local', '+56900000007', TRUE),
(NULL, (SELECT id FROM roles WHERE nombre='COORDINADOR' LIMIT 1), '88.888.888-8', 'Coordinador 01', 'Grupo12', 'p1.coordinator.01@test.local', '+56900000001', TRUE),
(NULL, (SELECT id FROM roles WHERE nombre='COORDINADOR' LIMIT 1), '77.777.771-1', 'Coordinador 02', 'Grupo12', 'p1.coordinator.02@test.local', '+56900000002', TRUE),
(NULL, (SELECT id FROM roles WHERE nombre='PROFESIONAL' LIMIT 1), '66.666.661-1', 'Profesional 01', 'Grupo12', 'p1.professional.01@test.local', '+56900000003', TRUE),
(NULL, (SELECT id FROM roles WHERE nombre='PROFESIONAL' LIMIT 1), '55.555.551-1', 'Profesional 02', 'Grupo12', 'p1.professional.02@test.local', '+56900000004', TRUE),
(NULL, (SELECT id FROM roles WHERE nombre='SUPERVISOR' LIMIT 1), '44.444.441-1', 'Supervisor 01', 'Grupo12', 'p1.supervisor.01@test.local', '+56900000005', TRUE),
(NULL, (SELECT id FROM roles WHERE nombre='SUPERVISOR' LIMIT 1), '33.333.331-1', 'Supervisor 02', 'Grupo12', 'p1.supervisor.02@test.local', '+56900000006', TRUE)
ON CONFLICT (email) DO NOTHING;
```

## Credenciales de otros grupos

### Grupo 9 (Analítica)

| Plataforma | URL | Email | Clave |
|------------|-----|-------|-------|
| Frontend | `https://analisis-proyecto-ti-p7j8.onrender.com/` | `johndoe@example.com` | `johndoe123` |
| Backend | `https://analisis-proyecto-ti.onrender.com/` | — | — |
| Eventos | `https://analisis-proyecto-ti.onrender.com/v1/events` | — | — |

## Requisitos del Grupo 12 (Yamira)

Para que la integración funcione, Yamira debe registrar en el cliente `p1` de su Keycloak:

- **Valid Redirect URIs**: `http://localhost:5173/*`, `https://proyecto1.piek.cl/*`
- **Valid Post Logout Redirect URIs**: `http://localhost:5173`, `https://proyecto1.piek.cl`
- **Web Origins**: `http://localhost:5173`, `https://proyecto1.piek.cl`

> El post-logout redirect URI es necesario para que el botón "Cerrar sesión" redirija
> correctamente al frontend después del logout en Keycloak.

## Problemas conocidos

1. **URL de ngrok temporal**: Si Yamira reinicia su túnel, la URL cambia y hay que actualizar
   las variables de entorno y reconstruir las imágenes Docker.

2. **Post-logout redirect_uri**: El logout muestra "La URI de redirección no es correcta"
   si Yamira no registró `http://localhost:5173` como post-logout URI en el cliente `p1`.
   Mientras se resuelve, el usuario puede limpiar sesión manualmente con: consola del browser →
   `localStorage.clear(); sessionStorage.clear(); location.reload();`

3. **Error jQuery en Keycloak**: `patternfly.min.js: jQuery is not defined` — es un problema
   cosmético del tema visual del Keycloak de Yamira, no afecta la funcionalidad.

## Cómo probar

1. Asegurar que el Keycloak del Grupo 12 esté activo (URL de ngrok accesible)
2. Tener las variables de entorno configuradas (ver sección Configuración)
3. Reconstruir si es necesario: `docker compose up -d --build backend frontend`
4. Abrir `http://localhost:5173` → redirige al Keycloak del Grupo 12
5. Iniciar sesión con cualquiera de los usuarios de prueba
6. Verificar que el dashboard carga con las vistas correspondientes al rol
