import { S3 } from 'aws-sdk';
import { FileDocument, S3UploadResult } from './models';
import type { ILogger } from '../shared/models';
import { Guard, isString } from '../shared';
import { uploadToS3, uploadToS3FromUrl } from './utilities';

const urlTTL = 3600; // 60 mins
const maxUploadRetries = 3;

export interface BucketRepository {
  getItem: (key: string) => Promise<FileDocument>;
  getObjectsInFolder: (path: string) => Promise<string[]>;
  getSignedDownloadUrl: (path: string, urlTtl?: number) => string;
  getSignedUploadUrl: (path: string, urlTtl?: number) => string;
  removeObject: (path: string) => Promise<void>;
  removeObjects: (folderPath: string) => Promise<void>;
  putItem: (item: FileDocument) => Promise<void>;
  /**
   * @param  {string} path s3Key to the file
   * @param  {string} downloadUrl? url for file downloading, requied if content is empty
   * @param  {Buffer} content? buffer content, requied if downloadUrl is empty
   * @param  {number} chunkSizeInMb? size of the one chunk for large files optimized upload
   * @param  {number} maxRetries? max retries for partial upload, default - 3
   */
  uploadItem: (
    path: string,
    downloadUrl?: string,
    content?: Buffer,
    chunkSizeInMb?: number,
    maxRetries?: number,
  ) => Promise<S3UploadResult>;
}

export default function bucketRepository(
  bucketName: string,
  logger?: ILogger,
): BucketRepository {
  const getItem = async (key: string): Promise<FileDocument> => {
    if (!key) {
      throw new Error('Invalid key');
    }

    const s3 = new S3();
    const file = await s3.getObject({ Bucket: bucketName, Key: key }).promise();
    const content = Buffer.isBuffer(file.Body)
      ? file.Body.toString('utf-8')
      : file?.Body?.toString();

    return {
      name: key,
      stringContent: content,
      binContent:
        (Buffer.isBuffer(file.Body) && (file.Body as Buffer)) || undefined,
    };
  };

  const getObjectsInFolder = async (path: string): Promise<string[]> => {
    const s3 = new S3();
    const res = await s3
      .listObjects({
        Bucket: bucketName,
        Prefix: path,
      })
      .promise();
    return res.Contents?.map((c) => c.Key || '') || [];
  };

  const getSignedDownloadUrl = (path: string, urlTtl = urlTTL): string => {
    const s3 = new S3({ signatureVersion: 'v4' });
    return s3.getSignedUrl('getObject', {
      Bucket: bucketName,
      Key: path,
      Expires: urlTtl,
    });
  };

  const getSignedUploadUrl = (path: string, urlTtl = urlTTL): string => {
    const s3 = new S3({ signatureVersion: 'v4' });
    return s3.getSignedUrl('putObject', {
      Bucket: bucketName,
      Key: path,
      Expires: urlTtl,
    });
  };

  const removeObject = async (path: string): Promise<void> => {
    const s3 = new S3();
    await s3
      .deleteObject({
        Bucket: bucketName,
        Key: path,
      })
      .promise();
  };

  const removeObjects = async (folderPath: string): Promise<void> => {
    const fileNames = await getObjectsInFolder(folderPath);
    const fileKeys = fileNames
      ?.filter((f) => f !== folderPath)
      ?.map((key) => ({ Key: key }));

    if (fileKeys?.length) {
      const s3 = new S3();
      await s3
        .deleteObjects({
          Bucket: bucketName,
          Delete: {
            Objects: fileKeys,
          },
        })
        .promise();
    }
  };

  const putItem = async (item: FileDocument): Promise<void> => {
    if (!item?.stringContent && !item?.streamContent && !item?.binContent) {
      throw new Error('Invalid item');
    }

    const s3 = new S3();

    if (isString(item.stringContent)) {
      await s3
        .putObject({
          Bucket: bucketName,
          Key: item.name,
          Body: item.stringContent,
        })
        .promise();
    } else {
      await s3
        .upload({
          Bucket: bucketName,
          Key: item.name,
          Body: item.streamContent || item.binContent,
        })
        .promise();
    }
  };

  const uploadItem = async (
    path: string,
    downloadUrl?: string,
    content?: Buffer,
    chunkSizeInMb?: number,
    maxRetries = maxUploadRetries,
  ): Promise<S3UploadResult> => {
    Guard.throwIfEmpty(path);
    Guard.throwIf(
      (!downloadUrl && !content) || (!!downloadUrl && !!content),
      'Please ptovide url or content, not both',
    );

    if (downloadUrl) {
      return uploadToS3FromUrl(
        path,
        downloadUrl!,
        bucketName,
        chunkSizeInMb,
        logger,
        maxRetries,
      );
    }

    return uploadToS3(
      path,
      content!,
      bucketName,
      chunkSizeInMb,
      logger,
      maxRetries,
    );
  };

  return {
    getItem,
    getObjectsInFolder,
    getSignedDownloadUrl,
    getSignedUploadUrl,
    removeObject,
    removeObjects,
    putItem,
    uploadItem,
  };
}
