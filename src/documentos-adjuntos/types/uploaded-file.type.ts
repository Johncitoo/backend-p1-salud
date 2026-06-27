export type UploadedClinicalFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

export type ValidatedClinicalFile = {
  safeOriginalName: string;
  baseName: string;
  extension: 'jpg' | 'jpeg' | 'png' | 'webp' | 'pdf';
  kind: 'IMAGE' | 'PDF';
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';
  maxBytes: number;
};

export type ProcessedClinicalFile = {
  buffer: Buffer;
  mimeType: 'image/webp' | 'application/pdf';
  extension: 'webp' | 'pdf';
  wasOptimized: boolean;
  originalWidth?: number | null;
  originalHeight?: number | null;
  storedWidth?: number | null;
  storedHeight?: number | null;
};
