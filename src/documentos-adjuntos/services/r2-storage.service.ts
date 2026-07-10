import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { StorageService } from './storage.interface';

@Injectable()
export class R2StorageService implements StorageService {
  readonly providerName = 'R2';
  private client?: S3Client;

  constructor(private readonly configService: ConfigService) {}

  getBucket(): string {
    const bucket = this.configService.get<string>('R2_BUCKET');
    if (!bucket)
      throw new ServiceUnavailableException('R2_BUCKET no esta configurado.');
    return bucket;
  }

  async putEncryptedObject(objectKey: string, encryptedBuffer: Buffer) {
    await this.getClient().send(
      new PutObjectCommand({
        Bucket: this.getBucket(),
        Key: objectKey,
        Body: encryptedBuffer,
        ContentType: 'application/octet-stream',
        Metadata: {
          encrypted: 'true',
          encryption_alg: 'AES-256-GCM',
        },
      }),
    );
  }

  async getEncryptedObject(objectKey: string): Promise<Buffer> {
    const response = await this.getClient().send(
      new GetObjectCommand({
        Bucket: this.getBucket(),
        Key: objectKey,
      }),
    );

    return this.streamToBuffer(response.Body);
  }

  async deleteObject(objectKey: string): Promise<void> {
    await this.getClient().send(
      new DeleteObjectCommand({
        Bucket: this.getBucket(),
        Key: objectKey,
      }),
    );
  }

  private getClient(): S3Client {
    if (this.client) return this.client;

    const endpoint = this.configService.get<string>('R2_ENDPOINT');
    const accessKeyId = this.configService.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'R2_SECRET_ACCESS_KEY',
    );
    const region = this.configService.get<string>('R2_REGION') ?? 'auto';

    if (!endpoint || !accessKeyId || !secretAccessKey) {
      throw new ServiceUnavailableException('Configuracion R2 incompleta.');
    }

    this.client = new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: true,
    });

    return this.client;
  }

  private async streamToBuffer(body: unknown): Promise<Buffer> {
    if (body instanceof Readable) {
      const chunks: Buffer[] = [];
      for await (const chunk of body) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    }

    if (
      body &&
      typeof (body as { transformToByteArray?: () => Promise<Uint8Array> })
        .transformToByteArray === 'function'
    ) {
      const bytes = await (
        body as { transformToByteArray: () => Promise<Uint8Array> }
      ).transformToByteArray();
      return Buffer.from(bytes);
    }

    throw new ServiceUnavailableException('Respuesta R2 invalida.');
  }
}
