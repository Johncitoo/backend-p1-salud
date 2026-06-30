import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, QueryFailedError, Repository } from 'typeorm';
import { AuditoriasService } from '../auditorias/auditorias.service';
import { AnalyticsService } from '../integrations/analytics/analytics.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { Rol } from './entities/rol.entity';
import { Usuario } from './entities/usuario.entity';

export interface UsuarioPerfil {
  id: string;
  identityUserId: string;
  nombres: string;
  apellidos: string;
  email: string;
  rol: string;
  activo: boolean;
}

export interface UsuarioResponse {
  id: string;
  identityUserId: string | null;
  rolId: string;
  rol: string | null;
  rut: string;
  nombres: string;
  apellidos: string;
  email: string;
  telefono: string | null;
  activo: boolean;
  ultimoAccesoAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuariosRepository: Repository<Usuario>,
    @InjectRepository(Rol)
    private readonly rolesRepository: Repository<Rol>,
    private readonly auditoriasService: AuditoriasService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  async findRoles(): Promise<Rol[]> {
    return this.rolesRepository.find({
      where: { deletedAt: IsNull() },
      order: { nombre: 'ASC' },
    });
  }

  async findAll(): Promise<UsuarioResponse[]> {
    return this.createUsuarioResponseQuery()
      .orderBy('usuario.created_at', 'DESC')
      .getRawMany<UsuarioResponse>();
  }

  async findOne(id: string): Promise<UsuarioResponse> {
    const usuario = await this.createUsuarioResponseQuery()
      .andWhere('usuario.id = :id', { id })
      .getRawOne<UsuarioResponse>();

    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    return usuario;
  }

  async findProfileByIdentityUserId(
    identityUserId: string,
  ): Promise<UsuarioPerfil | null> {
    const row = await this.usuariosRepository
      .createQueryBuilder('usuario')
      .innerJoin('roles', 'rol', 'rol.id = usuario.rol_id')
      .select([
        'usuario.id AS "id"',
        'usuario.identity_user_id AS "identityUserId"',
        'usuario.nombres AS "nombres"',
        'usuario.apellidos AS "apellidos"',
        'usuario.email AS "email"',
        'rol.nombre AS "rol"',
        'usuario.activo AS "activo"',
      ])
      .where('usuario.identity_user_id = :identityUserId', { identityUserId })
      .andWhere('usuario.activo = TRUE')
      .andWhere('usuario.deleted_at IS NULL')
      .andWhere('rol.deleted_at IS NULL')
      .getRawOne<UsuarioPerfil>();

    return row ?? null;
  }

  async findProfileByEmail(email: string): Promise<UsuarioPerfil | null> {
    const row = await this.usuariosRepository
      .createQueryBuilder('usuario')
      .innerJoin('roles', 'rol', 'rol.id = usuario.rol_id')
      .select([
        'usuario.id AS "id"',
        'usuario.identity_user_id AS "identityUserId"',
        'usuario.nombres AS "nombres"',
        'usuario.apellidos AS "apellidos"',
        'usuario.email AS "email"',
        'rol.nombre AS "rol"',
        'usuario.activo AS "activo"',
      ])
      .where('LOWER(usuario.email) = LOWER(:email)', { email })
      .andWhere('usuario.activo = TRUE')
      .andWhere('usuario.deleted_at IS NULL')
      .andWhere('rol.deleted_at IS NULL')
      .getRawOne<UsuarioPerfil>();

    return row ?? null;
  }

  async linkIdentityUserIdByEmail(
    email: string,
    identityUserId: string,
  ): Promise<UsuarioPerfil | null> {
    const existingIdentity = await this.findProfileByIdentityUserId(identityUserId);
    if (existingIdentity) return existingIdentity;

    const userByEmail = await this.usuariosRepository.findOne({
      where: { email, deletedAt: IsNull() },
    });

    if (!userByEmail || !userByEmail.activo) return null;

    if (
      userByEmail.identityUserId &&
      userByEmail.identityUserId !== identityUserId
    ) {
      throw new ConflictException(
        'El correo ya esta vinculado a otra identidad externa',
      );
    }

    userByEmail.identityUserId = identityUserId;
    await this.usuariosRepository.save(userByEmail);

    this.auditoriasService.registrar({
      entidad: 'usuarios',
      entidadId: userByEmail.id,
      accion: 'VINCULAR_IDENTIDAD',
      detalle: `Usuario ${userByEmail.email} vinculado con identidad externa ${identityUserId}`,
    });

    return this.findProfileByIdentityUserId(identityUserId);
  }

  async findOrCreateFromKeycloak(data: {
    sub: string;
    email: string | null;
    preferredUsername: string | null;
    rol: string | null;
  }): Promise<UsuarioPerfil | null> {
    // 1. Buscar por identity_user_id (sub del JWT)
    const byIdentity = await this.findProfileByIdentityUserId(data.sub);
    if (byIdentity) return byIdentity;

    // 2. Buscar por email y linkear
    if (data.email) {
      try {
        const linked = await this.linkIdentityUserIdByEmail(data.email, data.sub);
        if (linked) return linked;
      } catch {
        // ConflictException si el email ya está vinculado a otra identidad
      }
    }

    // 3. Auto-crear usuario con datos del token
    if (!data.email) return null;

    const rolNombre = data.rol ?? 'PROFESIONAL';
    const rol = await this.rolesRepository.findOne({
      where: { nombre: rolNombre, deletedAt: IsNull() },
    });

    if (!rol) return null;

    const nombres = this.extractNombresFromUsername(data.preferredUsername ?? data.email);
    const usuario = this.usuariosRepository.create({
      identityUserId: data.sub,
      rolId: rol.id,
      rut: `KC-${data.sub.slice(0, 8)}`,
      nombres: nombres.nombres,
      apellidos: nombres.apellidos,
      email: data.email,
      activo: true,
    });

    const saved = await this.usuariosRepository.save(usuario);

    this.auditoriasService.registrar({
      entidad: 'usuarios',
      entidadId: saved.id,
      accion: 'AUTO_CREAR_KEYCLOAK',
      detalle: `Usuario ${saved.email} creado automáticamente desde Keycloak (rol: ${rolNombre})`,
    });

    await this.analyticsService.sendUsuarioUpsertEvent({
      id: saved.id,
      nombres: saved.nombres,
      apellidos: saved.apellidos,
      rut: saved.rut,
      email: saved.email,
      telefono: saved.telefono,
      activo: saved.activo,
    });

    return {
      id: saved.id,
      identityUserId: data.sub,
      nombres: saved.nombres,
      apellidos: saved.apellidos,
      email: saved.email,
      rol: rolNombre,
      activo: true,
    };
  }

  private extractNombresFromUsername(username: string): { nombres: string; apellidos: string } {
    // p1.admin.01@test.local → "Admin 01"
    const localPart = username.split('@')[0] ?? username;
    const parts = localPart.replace(/^p1\./, '').split('.');
    const nombres = parts[0] ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1) : 'Usuario';
    const apellidos = parts.slice(1).join(' ') || 'Keycloak';
    return { nombres, apellidos };
  }

  async create(dto: CreateUsuarioDto): Promise<UsuarioResponse> {
    await this.ensureRoleExists(dto.rolId);

    const usuario = this.usuariosRepository.create({
      ...dto,
      activo: dto.activo ?? true,
    });

    let saved: Usuario;
    try {
      saved = await this.usuariosRepository.save(usuario);
    } catch (error) {
      if (error instanceof QueryFailedError && (error as any).code === '23505') {
        const detail = (error as any).detail ?? '';
        if (detail.includes('uq_usuarios_rut')) {
          throw new ConflictException(`El RUT ${dto.rut} ya está registrado.`);
        }
        if (detail.includes('uq_usuarios_email')) {
          throw new ConflictException(`El email ${dto.email} ya está registrado.`);
        }
        throw new ConflictException('Ya existe un registro con esos datos.');
      }
      throw error;
    }

    const result = await this.findOne(saved.id);

    this.auditoriasService.registrar({
      entidad: 'usuarios',
      entidadId: result.id,
      accion: 'CREAR',
      detalle: `Usuario ${result.nombres} ${result.apellidos} (${result.email}) creado con rol ${result.rol}`,
    });

    await this.analyticsService.sendUsuarioUpsertEvent(result);

    return result;
  }

  async update(id: string, dto: UpdateUsuarioDto): Promise<UsuarioResponse> {
    if (dto.rolId) await this.ensureRoleExists(dto.rolId);

    const usuario = await this.findUsuarioEntity(id);
    const oldValues = { nombres: usuario.nombres, apellidos: usuario.apellidos, email: usuario.email, rolId: usuario.rolId, rut: usuario.rut };
    Object.assign(usuario, dto);

    let saved: Usuario;
    try {
      saved = await this.usuariosRepository.save(usuario);
    } catch (error) {
      if (error instanceof QueryFailedError && (error as any).code === '23505') {
        const detail = (error as any).detail ?? '';
        if (detail.includes('uq_usuarios_rut')) {
          throw new ConflictException(`El RUT ${dto.rut} ya está registrado por otro usuario.`);
        }
        if (detail.includes('uq_usuarios_email')) {
          throw new ConflictException(`El email ${dto.email} ya está registrado por otro usuario.`);
        }
        throw new ConflictException('Ya existe un registro con esos datos.');
      }
      throw error;
    }

    const result = await this.findOne(saved.id);

    this.auditoriasService.registrar({
      entidad: 'usuarios',
      entidadId: result.id,
      accion: 'ACTUALIZAR',
      detalle: `Usuario ${result.nombres} ${result.apellidos} actualizado`,
      oldValues,
      newValues: { nombres: result.nombres, apellidos: result.apellidos, email: result.email, rolId: result.rolId },
    });

    await this.analyticsService.sendUsuarioUpsertEvent(result);

    return result;
  }

  async remove(id: string): Promise<UsuarioResponse> {
    const usuario = await this.findUsuarioEntity(id);
    usuario.deletedAt = new Date();
    await this.usuariosRepository.save(usuario);

    this.auditoriasService.registrar({
      entidad: 'usuarios',
      entidadId: usuario.id,
      accion: 'ELIMINAR',
      detalle: `Usuario ${usuario.nombres} ${usuario.apellidos} eliminado (soft delete)`,
    });

    return {
      id: usuario.id,
      identityUserId: usuario.identityUserId ?? null,
      rolId: usuario.rolId,
      rol: null,
      rut: usuario.rut,
      nombres: usuario.nombres,
      apellidos: usuario.apellidos,
      email: usuario.email,
      telefono: usuario.telefono ?? null,
      activo: usuario.activo,
      ultimoAccesoAt: usuario.ultimoAccesoAt ?? null,
      createdAt: usuario.createdAt,
      updatedAt: usuario.updatedAt,
      deletedAt: usuario.deletedAt ?? null,
    };
  }

  private async findUsuarioEntity(id: string): Promise<Usuario> {
    const usuario = await this.usuariosRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });

    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    return usuario;
  }

  private async ensureRoleExists(rolId: string): Promise<void> {
    const exists = await this.rolesRepository.exist({
      where: { id: rolId, deletedAt: IsNull() },
    });

    if (!exists) throw new NotFoundException('Rol no encontrado');
  }

  private createUsuarioResponseQuery() {
    return this.usuariosRepository
      .createQueryBuilder('usuario')
      .leftJoin('roles', 'rol', 'rol.id = usuario.rol_id AND rol.deleted_at IS NULL')
      .select([
        'usuario.id AS "id"',
        'usuario.identity_user_id AS "identityUserId"',
        'usuario.rol_id AS "rolId"',
        'rol.nombre AS "rol"',
        'usuario.rut AS "rut"',
        'usuario.nombres AS "nombres"',
        'usuario.apellidos AS "apellidos"',
        'usuario.email AS "email"',
        'usuario.telefono AS "telefono"',
        'usuario.activo AS "activo"',
        'usuario.ultimo_acceso_at AS "ultimoAccesoAt"',
        'usuario.created_at AS "createdAt"',
        'usuario.updated_at AS "updatedAt"',
        'usuario.deleted_at AS "deletedAt"',
      ])
      .where('usuario.deleted_at IS NULL');
  }
}
