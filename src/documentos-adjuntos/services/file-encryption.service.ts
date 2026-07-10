import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

export type EncryptedFilePayload = {
  encryptedBuffer: Buffer;
  alg: 'AES-256-GCM';
  iv: string;
  tag: string;
  keyId: string;
};

@Injectable()
export class FileEncryptionService {
  constructor(private readonly configService: ConfigService) {}

  encrypt(buffer: Buffer): EncryptedFilePayload {
    const key = this.getKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encryptedBuffer = Buffer.concat([
      cipher.update(buffer),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return {
      encryptedBuffer,
      alg: 'AES-256-GCM',
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      keyId:
        this.configService.get<string>('FILES_ENCRYPTION_KEY_ID') ?? 'default',
    };
  }

  decrypt(encryptedBuffer: Buffer, iv: string, tag: string): Buffer {
    const key = this.getKey();

    try {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        key,
        Buffer.from(iv, 'base64'),
      );
      decipher.setAuthTag(Buffer.from(tag, 'base64'));
      return Buffer.concat([
        decipher.update(encryptedBuffer),
        decipher.final(),
      ]);
    } catch {
      throw new BadRequestException(
        'No fue posible descifrar el archivo solicitado.',
      );
    }
  }

  private getKey(): Buffer {
    const encoded = this.configService.get<string>('FILES_ENCRYPTION_KEY');
    if (!encoded) {
      throw new ServiceUnavailableException(
        'FILES_ENCRYPTION_KEY no esta configurada.',
      );
    }

    const key = Buffer.from(encoded, 'base64');
    if (key.length !== 32) {
      throw new ServiceUnavailableException(
        'FILES_ENCRYPTION_KEY debe ser base64 de 32 bytes.',
      );
    }

    return key;
  }
}
