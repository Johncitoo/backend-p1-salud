import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleTokenEncryptionService } from './google-token-encryption.service';

const key = Buffer.from('0123456789abcdef0123456789abcdef').toString('base64');

describe('GoogleTokenEncryptionService', () => {
  it('encrypts and decrypts a token bundle with AES-256-GCM', () => {
    const service = new GoogleTokenEncryptionService({
      get: jest.fn((name: string) => (name === 'GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY' ? key : 'calendar-key')),
    } as unknown as ConfigService);
    const plaintext = JSON.stringify({ accessToken: 'access', refreshToken: 'refresh' });

    const encrypted = service.encrypt(plaintext);
    const decrypted = service.decrypt(encrypted.ciphertext, encrypted.iv, encrypted.tag);

    expect(encrypted.alg).toBe('AES-256-GCM');
    expect(encrypted.ciphertext).not.toBe(Buffer.from(plaintext).toString('base64'));
    expect(decrypted).toBe(plaintext);
  });

  it('requires a 32-byte base64 key', () => {
    const service = new GoogleTokenEncryptionService({
      get: jest.fn(() => Buffer.from('short').toString('base64')),
    } as unknown as ConfigService);

    expect(() => service.encrypt('token')).toThrow(ServiceUnavailableException);
  });
});
