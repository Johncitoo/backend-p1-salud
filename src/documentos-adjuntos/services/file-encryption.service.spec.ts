import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { FileEncryptionService } from './file-encryption.service';

const key = Buffer.from('0123456789abcdef0123456789abcdef').toString('base64');

describe('FileEncryptionService', () => {
  it('encrypts and decrypts with AES-256-GCM', () => {
    const service = new FileEncryptionService({
      get: jest.fn((name: string) => (name === 'FILES_ENCRYPTION_KEY' ? key : 'test-key')),
    } as unknown as ConfigService);
    const plaintext = Buffer.from('contenido clinico sensible');

    const encrypted = service.encrypt(plaintext);
    const decrypted = service.decrypt(encrypted.encryptedBuffer, encrypted.iv, encrypted.tag);

    expect(encrypted.alg).toBe('AES-256-GCM');
    expect(encrypted.encryptedBuffer.equals(plaintext)).toBe(false);
    expect(decrypted.equals(plaintext)).toBe(true);
  });

  it('requires a 32-byte base64 key', () => {
    const service = new FileEncryptionService({
      get: jest.fn(() => Buffer.from('short').toString('base64')),
    } as unknown as ConfigService);

    expect(() => service.encrypt(Buffer.from('x'))).toThrow(ServiceUnavailableException);
  });
});
