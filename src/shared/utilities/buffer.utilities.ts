import { Buffer } from 'buffer';
import { isBlob, isString, isUint8Array } from './parsing.utilities';

export const chunkBuffer = (
  buffer: Buffer,
  chunkSizeInBytes: number,
): Buffer[] => {
  let index = 0;
  const arrayLength = buffer.length;
  const result = [];

  while (index < arrayLength) {
    result.push(buffer.slice(index, (index += chunkSizeInBytes)));
  }

  return result;
};

export const getBuffer = async (
  content: string | Buffer | Uint8Array | Blob,
): Promise<Buffer | undefined> => {
  switch (true) {
    case Buffer.isBuffer(content):
      return content as Buffer;
    case isString(content):
      return Buffer.from(content as string);
    case isUint8Array(content):
      return Buffer.from((content as Uint8Array).buffer);
    case isBlob(content):
      return Buffer.from(await (content as Blob).arrayBuffer());
  }

  return undefined;
};
