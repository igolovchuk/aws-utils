import { S3 } from 'aws-sdk';
import { FileDocument } from './models';
import { Buffer } from 'buffer';

const urlTTL = 120; // 2 mins

export interface BucketRepository {
  getItem: (key: string) => Promise<FileDocument>;
  getObjectsInFolder: (path: string) => Promise<string[]>;
  getSignedDownloadUrl: (path: string) => string;
  getSignedUploadUrl: (path: string) => string;
  removeObject: (path: string) => Promise<void>;
  removeObjects: (folderPath: string) => Promise<void>;
  putItem: (item: FileDocument) => Promise<void>;
}

export default function bucketRepository(bucketName: string): BucketRepository {
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
      binContent: file.Body as Buffer,
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
    if (!item || (!item.streamContent && !item.stringContent)) {
      throw new Error('Invalid item');
    }

    const s3 = new S3();

    if (item.streamContent) {
      await s3
        .upload({
          Bucket: bucketName,
          Key: item.name,
          Body: item.streamContent,
        })
        .promise();
    } else if (item.stringContent) {
      await s3
        .putObject({
          Bucket: bucketName,
          Key: item.name,
          Body: item.stringContent,
        })
        .promise();
    }
  };

  return {
    getItem,
    getObjectsInFolder,
    getSignedDownloadUrl,
    getSignedUploadUrl,
    removeObject,
    removeObjects,
    putItem,
  };
}
