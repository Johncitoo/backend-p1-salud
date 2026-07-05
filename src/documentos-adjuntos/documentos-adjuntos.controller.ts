import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { DevAuthGuard } from '../auth/guards/dev-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { UsuarioPerfil } from '../usuarios/usuarios.service';
import { DocumentosAdjuntosService } from './documentos-adjuntos.service';
import { UploadDocumentoAdjuntoDto } from './dto/upload-documento-adjunto.dto';
import type { UploadedClinicalFile } from './types/uploaded-file.type';

const MAX_MULTIPART_BYTES = 15 * 1024 * 1024;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const uuidOrUndefined = (value?: string) => (value && UUID_RE.test(value) ? value : undefined);

@Controller('documentos-adjuntos')
@UseGuards(DevAuthGuard, RolesGuard)
export class DocumentosAdjuntosController {
  constructor(private readonly service: DocumentosAdjuntosService) {}

  @Post()
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_MULTIPART_BYTES } }))
  upload(
    @UploadedFile() file: UploadedClinicalFile,
    @Body() dto: UploadDocumentoAdjuntoDto,
    @CurrentUser() user?: UsuarioPerfil,
  ) {
    return this.service.upload(dto, file, uuidOrUndefined(user?.id));
  }

  @Get()
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  findAll(@Query('fichaClinicaId') fichaClinicaId?: string) {
    return this.service.findAll({ fichaClinicaId });
  }

  @Get(':id/download')
  @Roles('ADMIN', 'COORDINADOR', 'PROFESIONAL', 'SUPERVISOR')
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UsuarioPerfil | undefined,
    @Res() response: Response,
  ) {
    const file = await this.service.download(id, uuidOrUndefined(user?.id));
    response.setHeader('Content-Type', file.mimeType);
    response.setHeader('Content-Length', file.buffer.length);
    response.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.fileName)}"`);
    response.send(file.buffer);
  }

  @Delete(':id')
  @Roles('ADMIN', 'COORDINADOR')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user?: UsuarioPerfil) {
    return this.service.remove(id, uuidOrUndefined(user?.id));
  }
}
