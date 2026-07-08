export interface StorageService {
  readonly providerName: string;
  getBucket(): string;
  putEncryptedObject(objectKey: string, encryptedBuffer: Buffer): Promise<void>;
  getEncryptedObject(objectKey: string): Promise<Buffer>;
  deleteObject(objectKey: string): Promise<void>;
}

export const STORAGE_SERVICE = Symbol('STORAGE_SERVICE');
