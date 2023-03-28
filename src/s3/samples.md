### s3 utils
>  Create Bucket repository

```typescript
import { bucketRepository } from '@golovchuk/aws-utils/s3';

export const contentBucketRepository = bucketRepository(contentBucketName);

```
>  Get Objects

```typescript
import { contentBucketRepository } from '../storage';

const fileNames = await contentBucketRepository.getObjectsInFolder(folderPath);

const fileDocument = await contentBucketRepository.getItem(key);

const ttl = 300; // 5 min
const downloadUrl = await contentBucketRepository.getSignedDownloadUrl(key, ttl);
```

>  Upload Objects

```typescript
import { contentBucketRepository } from '../storage';

const uploadUrl = contentBucketRepository.getSignedUploadUrl(
  `${model.userID}/${model.connectionID}/${name}`,
);

const mediaBuffer = Buffer.from(event.body, 'base64')
await contentBucketRepository.putItem({
  name: name,
  binContent: mediaBuffer,
})

const text = 'some text'
await contentBucketRepository.putItem({
  name: name,
  stringContent: text,
})

// Can be used for partial upload of object, 
// generates uploadId for tracking the progress and splits the objects into parts for parallel upload.
const uploadResult = await contentBucketRepository.uploadItem(s3Key, externalDownloadUrl);

const largeObjectResult = await contentBucketRepository.uploadItem(
  s3Key,
  externalDownloadUrl,
  content: undefined,
  uploadContentChunkSizeMb);

const mediaBuffer = Buffer.from(event.body, 'base64')
const largeObjectResult = await contentBucketRepository.uploadItem(
  s3Key,
  downloadUrl: undefined,
  content: mediaBuffer,
  uploadContentChunkSizeMb);
```

>  Remove Objects

```typescript
import { contentBucketRepository } from '../storage';

await contentBucketRepository.removeObject(key);
await contentBucketRepository.removeObjects(bucketPath);
```
