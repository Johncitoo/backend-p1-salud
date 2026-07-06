# Cambio: Roles de usuario desde JWT del Grupo 12

## Contexto

Anteriormente, el rol del usuario se leía de la **base de datos local** (tabla `usuarios` → `rol_id` → tabla `roles`). Esto requería crear manualmente cada usuario en la BD con su rol antes de que pudiera acceder al sistema.

El Grupo 12 (Identidades y Accesos) administra un Keycloak centralizado que incluye los roles de cada usuario dentro del JWT. El cambio hace que el backend lea el rol directamente del **token JWT**, eliminando la dependencia de la BD para la autorización.

## Qué cambió

### 1. El rol ahora viene del JWT (`resource_access.p1.roles`)

Antes:
```
JWT → backend busca usuario en BD → lee rol_id → JOIN tabla roles → usa ese rol
```

Ahora:
```
JWT → backend lee resource_access.p1.roles → mapea al rol del sistema → usa ese rol
```

### 2. Mapeo de roles JWT → sistema

| Rol en JWT (Grupo 12) | Rol en nuestro sistema |
|---|---|
| `admin` | `ADMIN` |
| `coordinator` | `COORDINADOR` |
| `professional` | `PROFESIONAL` |
| `supervisor` | `SUPERVISOR` |

Si el JWT no trae rol de aplicación, se asigna `PROFESIONAL` por defecto.

### 3. Auto-creación de usuarios

Si un usuario se autentica con un JWT válido pero **no existe en nuestra BD**, el sistema lo crea automáticamente:
- Extrae `email`, `preferred_username` y `sub` del token
- Genera un nombre a partir del username (`p1.admin.01@test.local` → "Admin 01")
- Asigna el rol del JWT
- Registra auditoría con acción `AUTO_CREAR_KEYCLOAK`
- Envía evento `usuario_upsert` al Grupo 9

Esto elimina la necesidad de crear usuarios manualmente en la BD antes de que puedan acceder.

### 4. El rol del JWT tiene prioridad sobre el de la BD

Si un usuario ya existe en la BD con rol `PROFESIONAL`, pero su token JWT dice `admin`, el sistema usa `ADMIN`. Esto permite al Grupo 12 controlar los roles centralizadamente sin tocar nuestra BD.

## Flujo completo de autenticación (AUTH_MODE=keycloak)

```
1. Frontend redirige al Keycloak del Grupo 12
2. Usuario se autentica → recibe JWT
3. Frontend envía JWT en cada request (Authorization: Bearer <token>)
4. Backend (DevAuthGuard):
   a. Extrae el Bearer token
   b. Verifica firma con JWKS del Keycloak del Grupo 12
   c. Lee resource_access.p1.roles → mapea a ADMIN/COORDINADOR/PROFESIONAL/SUPERVISOR
   d. Llama findOrCreateFromKeycloak():
      - Busca por sub (identity_user_id) → si existe, retorna
      - Busca por email → si existe, linkea el sub y retorna
      - Si no existe → crea el usuario automáticamente
   e. Sobreescribe el rol del perfil con el del JWT
5. RolesGuard verifica que request.user.rol tiene permisos para el endpoint
```

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `src/auth/guards/dev-auth.guard.ts` | `getKeycloakUser()` ahora extrae rol del JWT y llama `findOrCreateFromKeycloak()`. Nuevos métodos: `extractAppRoleFromPayload()`, `mapKeycloakRoleToAppRole()` |
| `src/usuarios/usuarios.service.ts` | Nuevo método `findOrCreateFromKeycloak()` que busca, linkea o crea usuario. Nuevo helper `extractNombresFromUsername()` |
| `src/auth/guards/dev-auth.guard.spec.ts` | Tests actualizados para verificar `findOrCreateFromKeycloak` y mapeo de roles JWT |

## Impacto en la BD

- **La tabla `roles` y el campo `rol_id` se mantienen** — no se eliminan. Si en algún momento se vuelve al modo local, todo sigue funcionando.
- **El `rol_id` se usa al auto-crear usuarios** — para que la BD quede consistente, el sistema busca el rol en la tabla `roles` y lo asigna. Pero para la autorización, se usa el rol del JWT.
- **Los usuarios existentes siguen funcionando** — si ya tienen `identity_user_id`, el guard los encuentra y les sobreescribe el rol con el del JWT.

## Configuración

No requiere variables de entorno nuevas. Usa las mismas:

```env
AUTH_MODE=keycloak
KEYCLOAK_AUDIENCE=p1    # ← este es el clientId que se usa para buscar en resource_access
```

## Cómo probar

1. Asegurar que el Keycloak del Grupo 12 esté activo
2. Iniciar sesión con cualquier usuario de prueba (ej: `p1.admin.01@test.local`)
3. El backend acepta el token, extrae el rol `admin` → mapea a `ADMIN`
4. Si es un usuario nuevo que no existía en la BD, se crea automáticamente
5. El usuario puede acceder a los endpoints según su rol

## Modo mock (AUTH_MODE=mock)

El modo mock **no se ve afectado**. Sigue funcionando igual con headers `x-identity-user-id` o `x-mock-role`. Los cambios solo aplican cuando `AUTH_MODE=keycloak`.
