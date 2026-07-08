import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { dirname, join, resolve } from 'path';
import { StorageService } from './storage.interface';

// Alternativa a R2 para desarrollo/pruebas locales: guarda el mismo buffer ya
// cifrado (AES-256-GCM, ver FileEncryptionService) como archivo en disco, en vez
// de subirlo a Cloudflare R2. No requiere credenciales externas.
@Injectable()
export class LocalStorageService implements StorageService {
  readonly providerName = 'LOCAL';

  constructor(private readonly configService: ConfigService) {}

  getBucket(): string {
    return 'local-disk';
  }

  async putEncryptedObject(objectKey: string, encryptedBuffer: Buffer): Promise<void> {
    const filePath = this.resolvePath(objectKey);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, encryptedBuffer);
  }

  async getEncryptedObject(objectKey: string): Promise<Buffer> {
    return readFile(this.resolvePath(objectKey));
  }

  async deleteObject(objectKey: string): Promise<void> {
    await rm(this.resolvePath(objectKey), { force: true });
  }

  private resolvePath(objectKey: string): string {
    return join(this.getRoot(), objectKey);
  }

  private getRoot(): string {
    const configured = this.configService.get<string>('LOCAL_STORAGE_DIR');
    return configured ? resolve(configured) : resolve(process.cwd(), 'storage');
  }
}
