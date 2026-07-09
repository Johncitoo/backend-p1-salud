import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, randomUUID } from 'crypto';
import { IsNull, Repository } from 'typeorm';
import { AuditoriasService } from '../auditorias/auditorias.service';
import { safeEqual } from '../lib/safe-compare.util';
import { ProfesionalSalud } from '../profesionales/entities/profesional-salud.entity';
import type { UsuarioPerfil } from '../usuarios/usuarios.service';
import { ProfesionalGoogleCalendarConnection } from './entities/profesional-google-calendar-connection.entity';
import { GoogleCalendarClientService, GoogleTokenResponse } from './services/google-calendar-client.service';
import { GoogleTokenEncryptionService } from './services/google-token-encryption.service';

type CalendarStatePayload = {
  usuarioId: string;
  profesionalSaludId: string;
  nonce: string;
  createdAt: number;
};

@Injectable()
export class GoogleCalendarService {
  constructor(
    @InjectRepository(ProfesionalGoogleCalendarConnection)
    private readonly connectionsRepo: Repository<ProfesionalGoogleCalendarConnection>,
    @InjectRepository(ProfesionalSalud)
    private readonly profesionalesRepo: Repository<ProfesionalSalud>,
    private readonly googleClient: GoogleCalendarClientService,
    private readonly tokenEncryption: GoogleTokenEncryptionService,
    private readonly configService: ConfigService,
    private readonly auditoriasService: AuditoriasService,
  ) {}

  async getConnectUrl(user: UsuarioPerfil): Promise<{ authorizationUrl: string }> {
    const profesional = await this.findProfesionalForUser(user);
    const state = this.signState({
      usuarioId: user.id,
      profesionalSaludId: profesional.id,
      nonce: randomUUID(),
      createdAt: Date.now(),
    });

    return { authorizationUrl: this.googleClient.getAuthorizationUrl(state) };
  }

  async handleCallback(code: string, state: string, user?: UsuarioPerfil) {
    if (!code || !state) throw new BadRequestException('Callback de Google Calendar incompleto.');

    const payload = this.verifyState(state);
    if (user?.id && user.id !== payload.usuarioId) {
      throw new ForbiddenException('El callback de Google Calendar no corresponde al usuario actual.');
    }

    const token = await this.googleClient.exchangeCode(code);
    const userInfo = await this.googleClient.getUserInfo(token.access_token);
    const encrypted = this.encryptTokenBundle(token);

    const existing = await this.connectionsRepo.findOne({
      where: { profesionalSaludId: payload.profesionalSaludId, deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });

    const connection = existing ?? this.connectionsRepo.create({
      profesionalSaludId: payload.profesionalSaludId,
      usuarioId: payload.usuarioId,
      calendarId: 'primary',
    });

    connection.usuarioId = payload.usuarioId;
    connection.googleAccountId = userInfo.id ?? null;
    connection.googleAccountEmail = userInfo.email ?? null;
    connection.calendarId = 'primary';
    connection.accessTokenCiphertext = encrypted.ciphertext;
    connection.refreshTokenCiphertext = null;
    connection.tokenEncryptionAlg = encrypted.alg;
    connection.tokenEncryptionIv = encrypted.iv;
    connection.tokenEncryptionTag = encrypted.tag;
    connection.tokenEncryptionKeyId = encrypted.keyId;
    connection.scopes = token.scope ?? null;
    connection.expiresAt = token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null;
    connection.syncEnabled = true;
    connection.lastSyncError = null;
    connection.deletedAt = null;

    const saved = await this.connectionsRepo.save(connection);
    this.auditoriasService.registrar({
      usuarioId: payload.usuarioId,
      entidad: 'profesional_google_calendar_connections',
      entidadId: saved.id,
      accion: existing ? 'ACTUALIZAR' : 'CREAR',
      detalle: `Google Calendar conectado para profesional ${payload.profesionalSaludId}`,
      newValues: {
        profesionalSaludId: saved.profesionalSaludId,
        googleAccountEmail: saved.googleAccountEmail,
        syncEnabled: saved.syncEnabled,
      },
    });

    return this.toStatus(saved);
  }

  async getStatus(user: UsuarioPerfil) {
    const profesional = await this.findProfesionalForUser(user);
    const connection = await this.connectionsRepo.findOne({
      where: { profesionalSaludId: profesional.id, deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });

    return this.toStatus(connection, profesional.id);
  }

  async disconnect(user: UsuarioPerfil) {
    const profesional = await this.findProfesionalForUser(user);
    const connection = await this.connectionsRepo.findOne({
      where: { profesionalSaludId: profesional.id, deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });

    if (!connection) return this.toStatus(null, profesional.id);

    connection.syncEnabled = false;
    connection.deletedAt = new Date();
    const saved = await this.connectionsRepo.save(connection);

    this.auditoriasService.registrar({
      usuarioId: user.id,
      entidad: 'profesional_google_calendar_connections',
      entidadId: saved.id,
      accion: 'DESCONECTAR',
      detalle: `Google Calendar desconectado para profesional ${profesional.id}`,
    });

    return this.toStatus(null, profesional.id);
  }

  private async findProfesionalForUser(user: UsuarioPerfil): Promise<ProfesionalSalud> {
    if (user.rol !== 'PROFESIONAL') {
      throw new ForbiddenException('Solo profesionales pueden conectar su Google Calendar.');
    }

    const profesional = await this.profesionalesRepo.findOne({ where: { usuarioId: user.id, deletedAt: IsNull() } });
    if (!profesional) throw new NotFoundException('Profesional de salud no encontrado para el usuario actual.');
    return profesional;
  }

  private encryptTokenBundle(token: GoogleTokenResponse) {
    return this.tokenEncryption.encrypt(JSON.stringify({
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? null,
    }));
  }

  private toStatus(connection: ProfesionalGoogleCalendarConnection | null, profesionalSaludId?: string) {
    return {
      connected: Boolean(connection),
      profesionalSaludId: connection?.profesionalSaludId ?? profesionalSaludId ?? null,
      googleAccountEmail: connection?.googleAccountEmail ?? null,
      calendarId: connection?.calendarId ?? null,
      syncEnabled: connection?.syncEnabled ?? false,
      lastSyncAt: connection?.lastSyncAt ?? null,
      lastSyncError: connection?.lastSyncError ?? null,
      expiresAt: connection?.expiresAt ?? null,
    };
  }

  private signState(payload: CalendarStatePayload): string {
    const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const signature = createHmac('sha256', this.getStateSecret()).update(encodedPayload).digest('base64url');
    return `${encodedPayload}.${signature}`;
  }

  private verifyState(state: string): CalendarStatePayload {
    const [encodedPayload, signature] = state.split('.');
    if (!encodedPayload || !signature) throw new BadRequestException('State de Google Calendar invalido.');

    const expected = createHmac('sha256', this.getStateSecret()).update(encodedPayload).digest('base64url');
    if (!safeEqual(signature, expected)) throw new BadRequestException('State de Google Calendar invalido.');

    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as CalendarStatePayload;
    if (Date.now() - payload.createdAt > 10 * 60 * 1000) {
      throw new BadRequestException('State de Google Calendar expirado.');
    }

    return payload;
  }

  private getStateSecret(): string {
    const secret =
      this.configService.get<string>('GOOGLE_CALENDAR_STATE_SECRET') ?? this.configService.get<string>('JWT_SECRET');

    // Nada de fallback a un valor hardcodeado: si nadie configuró un secreto, cualquiera
    // que lea este repo puede forjar un `state` válido y colarse en el callback OAuth.
    if (!secret) {
      throw new Error(
        'GOOGLE_CALENDAR_STATE_SECRET (o JWT_SECRET) debe estar configurado para firmar el state de Google Calendar.',
      );
    }

    return secret;
  }
}
