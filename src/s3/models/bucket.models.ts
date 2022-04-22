import { Buffer } from 'buffer';

export interface FileDocument {
  name: string;
  stringContent?: string;
  streamContent?: ReadableStream;
  binContent?: Buffer;
}
