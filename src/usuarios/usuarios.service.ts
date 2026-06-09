import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AuditoriasService } from '../auditorias/auditorias.service';
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
  identityUserId: string;
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

  async create(dto: CreateUsuarioDto): Promise<UsuarioResponse> {
    await this.ensureRoleExists(dto.rolId);

    const usuario = this.usuariosRepository.create({
      ...dto,
      activo: dto.activo ?? true,
    });

    const saved = await this.usuariosRepository.save(usuario);
    const result = await this.findOne(saved.id);

    this.auditoriasService.registrar({
      entidad: 'usuarios',
      entidadId: result.id,
      accion: 'CREAR',
      detalle: `Usuario ${result.nombres} ${result.apellidos} (${result.email}) creado con rol ${result.rol}`,
    });

    return result;
  }

  async update(id: string, dto: UpdateUsuarioDto): Promise<UsuarioResponse> {
    if (dto.rolId) await this.ensureRoleExists(dto.rolId);

    const usuario = await this.findUsuarioEntity(id);
    const oldValues = { nombres: usuario.nombres, apellidos: usuario.apellidos, email: usuario.email, rolId: usuario.rolId };
    Object.assign(usuario, dto);
    const saved = await this.usuariosRepository.save(usuario);
    const result = await this.findOne(saved.id);

    this.auditoriasService.registrar({
      entidad: 'usuarios',
      entidadId: result.id,
      accion: 'ACTUALIZAR',
      detalle: `Usuario ${result.nombres} ${result.apellidos} actualizado`,
      oldValues,
      newValues: { nombres: result.nombres, apellidos: result.apellidos, email: result.email, rolId: result.rolId },
    });

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
      identityUserId: usuario.identityUserId,
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
