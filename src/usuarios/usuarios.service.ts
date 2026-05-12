import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { Usuario } from './entities/usuario.entity';

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuariosRepository: Repository<Usuario>,
  ) {}

  async findAll(): Promise<Usuario[]> {
    return this.usuariosRepository.find({
      where: { deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Usuario> {
    const usuario = await this.usuariosRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return usuario;
  }

  async create(dto: CreateUsuarioDto): Promise<Usuario> {
    const usuario = this.usuariosRepository.create({
      ...dto,
      activo: dto.activo ?? true,
    });

    return this.usuariosRepository.save(usuario);
  }

  async update(id: string, dto: UpdateUsuarioDto): Promise<Usuario> {
    const usuario = await this.findOne(id);
    Object.assign(usuario, dto);
    return this.usuariosRepository.save(usuario);
  }

  async remove(id: string): Promise<Usuario> {
    const usuario = await this.findOne(id);
    usuario.deletedAt = new Date();
    return this.usuariosRepository.save(usuario);
  }
}
