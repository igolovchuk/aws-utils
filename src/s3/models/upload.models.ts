import type { PassThrough } from 'stream';

export type S3UploadResult = {
  key: string;
  isSuccess: boolean;
  statusMessage?: string;
};

export type S3UploadPart = {
  partNumber: number;
  uploadId: string;
  s3Key: string;
  content: string | Buffer | Uint8Array | PassThrough;
  eTag?: string;
  checksumCRC32?: string;
  checksumCRC32C?: string;
  checksumSHA1?: string;
  checksumSHA256?: string;
  isSuccess: boolean;
};
