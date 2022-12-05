import type { ILogger } from '../../shared/models';
import { chunkBuffer, FileUtils, Guard } from '../../shared/utilities';
import { S3 } from 'aws-sdk';
import { S3UploadPart, S3UploadResult } from '../models';
import type { PassThrough } from 'stream';

export const uploadToS3FromUrl = async (
  s3Key: string,
  downloadUrl: string,
  bucketName: string,
  chunkSizeInMb?: number,
  logger?: ILogger,
  maxRetries = 3,
): Promise<S3UploadResult> => {
  const mediaBuffer = await getMediaBuffer(downloadUrl);
  return uploadToS3(
    s3Key,
    mediaBuffer,
    bucketName,
    chunkSizeInMb,
    logger,
    maxRetries,
  );
};

export const uploadToS3 = async (
  s3Key: string,
  mediaBuffer: Buffer,
  bucketName: string,
  chunkSizeInMb?: number,
  logger?: ILogger,
  maxRetries = 3,
): Promise<S3UploadResult> => {
  const fileSize = FileUtils.sizeInMb(mediaBuffer.byteLength);
  const needPartialUpload = !!chunkSizeInMb && fileSize > chunkSizeInMb;

  logger?.debug('[aws utils] [uploadToS3] File to upload: ', {
    size: fileSize,
    path: s3Key,
    needPartialUpload,
    chunkSizeInMb: chunkSizeInMb || 0,
  });

  if (!needPartialUpload) {
    return await uploadSimple(s3Key, mediaBuffer, bucketName, logger);
  }

  const chunks = chunkBuffer(mediaBuffer, Math.pow(1024, 2) * chunkSizeInMb);
  const uploadId = await startUpload(s3Key, bucketName, logger);
  logger?.debug('[aws utils] [uploadToS3] uploadId received:', uploadId);

  const parts = await Promise.all(
    chunks.map((chunk, index) =>
      uploadPart(s3Key, uploadId!, chunk, index + 1, bucketName, logger),
    ),
  );

  logger?.debug(
    '[aws utils] [uploadParts] - %j',
    parts.map((x) => ({ partNumber: x.partNumber, isSuccess: x.isSuccess })),
  );
  let failedParts = parts.filter((x) => !x.isSuccess);

  if (failedParts.length) {
    failedParts = await retryUpload(
      failedParts,
      bucketName,
      logger,
      maxRetries,
    );
  }

  if (!failedParts.length) {
    await completeUpload(
      s3Key,
      uploadId!,
      parts.sort((a, b) => a.partNumber - b.partNumber),
      bucketName,
      logger,
    );
  } else {
    await abortUpload(s3Key, uploadId, bucketName, logger);
  }

  return {
    key: s3Key,
    isSuccess: !failedParts.length,
    statusMessage:
      (failedParts.length && `Failed to upload ${failedParts.length} parts`) ||
      undefined,
  };
};

const getMediaBuffer = async (
  url: string,
  logger?: ILogger,
): Promise<Buffer> => {
  logger?.info('[aws utils] [getMediaBuffer] Getting media buffer for', url);
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'aws-lambda', // this is required
    },
  }).then((x) => x.arrayBuffer());

  return Buffer.from(response);
};

const startUpload = async (
  key: string,
  bucketName: string,
  logger?: ILogger,
): Promise<string> => {
  Guard.throwIfEmpty(key);
  logger?.info('[aws utils] [startUpload] for', { key });

  const s3 = new S3();
  const result = await s3
    .createMultipartUpload({
      Bucket: bucketName,
      Key: key,
    })
    .promise();

  return result.UploadId!;
};

const completeUpload = async (
  key: string,
  uploadId: string,
  parts: S3UploadPart[],
  bucketName: string,
  logger?: ILogger,
): Promise<void> => {
  Guard.throwIfEmpty(key);
  Guard.throwIfEmpty(uploadId);

  logger?.info('[aws utils] [completeUpload] for', { key, uploadId });

  const s3 = new S3();
  await s3
    .completeMultipartUpload({
      Bucket: bucketName,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts.map((x) => ({
          ETag: x.eTag,
          PartNumber: x.partNumber,
          ChecksumCRC32: x.checksumCRC32,
          ChecksumCRC32C: x.checksumCRC32C,
          ChecksumSHA1: x.checksumSHA1,
          ChecksumSHA256: x.checksumSHA256,
        })),
      },
    })
    .promise();
};

const abortUpload = async (
  key: string,
  uploadId: string,
  bucketName: string,
  logger?: ILogger,
): Promise<void> => {
  Guard.throwIfEmpty(key);
  Guard.throwIfEmpty(uploadId);

  logger?.info('[aws utils] [abortUpload] for', { key, uploadId });

  const s3 = new S3();
  await s3
    .abortMultipartUpload({
      Bucket: bucketName,
      Key: key,
      UploadId: uploadId,
    })
    .promise();
};

const uploadPart = async (
  key: string,
  uploadId: string,
  content: string | Buffer | Uint8Array | PassThrough,
  partNumber: number,
  bucketName: string,
  logger?: ILogger,
): Promise<S3UploadPart> => {
  try {
    const s3 = new S3();
    const result = await s3
      .uploadPart({
        Bucket: bucketName,
        Body: content,
        Key: key,
        PartNumber: partNumber,
        UploadId: uploadId,
      })
      .promise();

    const error = result.$response.error as AWS.AWSError;
    if (error) {
      logger?.error('[aws utils] [uploadPart] Failed to load part', {
        uploadId,
        error,
      });
    }

    return {
      partNumber,
      s3Key: key,
      eTag: result.ETag,
      uploadId,
      content,
      checksumCRC32: result.ChecksumCRC32,
      checksumCRC32C: result.ChecksumCRC32C,
      checksumSHA1: result.ChecksumSHA1,
      checksumSHA256: result.ChecksumSHA256,
      isSuccess: !error,
    };
  } catch (error) {
    logger?.error(
      '[aws utils] [uploadPart] Unexpected error while loading part',
      {
        uploadId,
        error,
      },
    );

    return {
      partNumber,
      s3Key: key,
      uploadId,
      content,
      isSuccess: false,
    };
  }
};

const retryUpload = async (
  parts: S3UploadPart[],
  bucketName: string,
  logger?: ILogger,
  maxRetries = 3,
): Promise<S3UploadPart[]> => {
  let partsForRetry = parts;
  logger?.info(
    '[aws utils] [retryUpload] There are some parts for retry',
    parts,
  );

  for (let i = 0; i < maxRetries; i++) {
    partsForRetry = await Promise.all(
      partsForRetry.map((x) =>
        uploadPart(
          x.s3Key,
          x.uploadId,
          x.content,
          x.partNumber,
          bucketName,
          logger,
        ),
      ),
    );

    if (!partsForRetry.length) {
      break;
    }
  }

  return partsForRetry;
};

const uploadSimple = async (
  key: string,
  content: string | Buffer | Uint8Array | PassThrough,
  bucketName: string,
  logger?: ILogger,
): Promise<S3UploadResult> => {
  try {
    const s3 = new S3();
    await s3
      .upload({
        Bucket: bucketName,
        Body: content,
        Key: key,
      })
      .promise();

    logger?.info(`[uploadSimple] Completed for ${key}`);

    return {
      key,
      isSuccess: true,
    };
  } catch (error) {
    logger?.error(`[aws utils] [uploadSmallFile] Error for ${key}`, error);

    return {
      key,
      isSuccess: false,
      statusMessage: (error as any).message,
    };
  }
};
