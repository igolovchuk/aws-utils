import { Buffer } from 'buffer';
import type { PassThrough } from 'stream';

export interface FileDocument {
  name: string;
  stringContent?: string;
  streamContent?: ReadableStream | PassThrough;
  binContent?: Buffer | Uint8Array;
}
