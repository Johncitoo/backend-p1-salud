import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

export type EncryptedGoogleToken = {
  ciphertext: string;
  alg: 'AES-256-GCM';
  iv: string;
  tag: string;
  keyId: string;
};

@Injectable()
export class GoogleTokenEncryptionService {
  constructor(private readonly configService: ConfigService) {}

  encrypt(plaintext: string): EncryptedGoogleToken {
    const key = this.getKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    return {
      ciphertext: encrypted.toString('base64'),
      alg: 'AES-256-GCM',
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      keyId:
        this.configService.get<string>(
          'GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY_ID',
        ) ?? 'default',
    };
  }

  decrypt(ciphertext: string, iv: string, tag: string): string {
    const key = this.getKey();

    try {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        key,
        Buffer.from(iv, 'base64'),
      );
      decipher.setAuthTag(Buffer.from(tag, 'base64'));
      return Buffer.concat([
        decipher.update(Buffer.from(ciphertext, 'base64')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new BadRequestException(
        'No fue posible descifrar el token de Google Calendar.',
      );
    }
  }

  private getKey(): Buffer {
    const encoded =
      this.configService.get<string>('GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY') ??
      this.configService.get<string>('FILES_ENCRYPTION_KEY');

    if (!encoded) {
      throw new ServiceUnavailableException(
        'GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY no esta configurada.',
      );
    }

    const key = Buffer.from(encoded, 'base64');
    if (key.length !== 32) {
      throw new ServiceUnavailableException(
        'GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY debe ser base64 de 32 bytes.',
      );
    }

    return key;
  }
}
