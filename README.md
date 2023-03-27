# aws-utils
Utilities for serverless development with AWS

# Usage

- [dynamo](#dynamo-utils)
- [etl](#etl-utils)
- [lambda](#lambda-utils)
- [s3](#s3-utils)
- [sns](#sns-utils)
- [shared](#shared-utils)

### dynamo utils

> Create dynamo repository

```typescript
import { dynamoRepository } from '@golovchuk/aws-utils/dynamo';
import { Order } from './tables';
import { logger } from '../../shared/services';

export const orderRepository = dynamoRepository<Order>('ordersTable', logger);

```
> Use dynamo repository for advanced querying

```typescript
import type {
  AuditableEntity,
  ExpressionOperationType,
  IndexFilter,
  IndexProjectionType,
  QuerySelectType,
} from '@golovchuk/aws-utils/dynamo';
import { 
    connectionTypeRepository,
    connectionRepository,
    contentRepository 
} from '../storage';
const single = await connectionRepository.getItem('id', id);

const items = await connectionTypeRepository.getAllItems({
    expressionFilter: {
      equalFilter: {
        visible: true,
      },
    },
  });

const indexFilter: IndexFilter = {
    indexKey: 'userID',
    indexValue: userID,
    rangeKeyFilter:
      (typeID && {
        key: 'typeID',
        operation: {
          type: ExpressionOperationType.EQUAL_TO,
          values: { value: typeID },
        },
      }) ||
      undefined,
  };

const response = await connectionRepository.getItemsBy({
    indexFilter,
});

const { items } = await connectionRepository.getItemsBy({
    indexFilter: {
      indexKey: 'status',
      indexValue: status,
      projectionType: IndexProjectionType.KEYS_ONLY,
    },
    querySelect: { type: QuerySelectType.onlyProjected },
});

const response = await contentRepository.getItemsBy({
    indexFilter: {
      indexKey: 'userID',
      indexValue: userID,
      rangeKeyFilter:
        (uploadStatus && {
          key: 'uploadStatus',
          operation: {
            type: ExpressionOperationType.EQUAL_TO,
            values: { value: uploadStatus },
          },
        }) ||
        undefined,
    },
    expressionFilter: {
      containsArrayFilter:
        tags?.length && {
          items: [
            tags?.length && {
              attributeName: 'userTags',
              filterValues: tags,
              filterOperation: FilterOperation.AND,
            }
          ] as ContainsArrayFilterItem[],
          filterOperation: FilterOperation.AND,
        } ||
        undefined,
    },
    startKey,
    limit,
});
```
> Add/Update objects

```typescript
    const dbItem: Order = {
    id: model.id,
    amount: 100,
    currency: model.currency,
    status: OrderStatus.PENDING,
    createdAt: new Date().toISOString(),
    createdBy: createdBy,
  };

  await orderRepository.putItem(dbItem);

  await orderRepository.batchPut([item])
```

> Remove objects

```typescript
  const itemKeys: DynamoKey[] = items.map((x) => ({
    hashKey: { name: 'connectionID', value: x.connectionID },
    rangeKey: { name: 'externalID', value: x.externalID },
  }));

  await Promise.all(
    itemKeys.map((x) => contentRepository.removeItem(x)),
  );
    const dbItem: Order = {
    id: model.id || nanoid(),
    amount: amount,
    currency: model.currency,
    status: OrderStatus.PENDING,
    createdAt: new Date().toISOString(),
    createdBy: createdBy,
    items: model.items,
  };

  await orderRepository.putItem(dbItem);
```

> Inheritance of Auditable entity

```typescript
import type { AuditableEntity } from '@golovchuk/aws-utils/dynamo';

//   Allows to inherit the fields:
//   createdBy?: string;
//   createdAt?: string;
//   updatedBy?: string;
//   updatedAt?: string;

export interface Customer extends AuditableEntity {
  id: string;
  email?: string;
  name?: string;
  isActive: boolean;
}
```

### etl utils

> Create dynamo table trigger for transfering data into AWS Athena

```typescript
import {
  createDynamoAthenaTableTriggerHandler,
  getAthenaResourceName,
  DynamoAthenaTransferConfig,
} from '@golovchuk/aws-utils/etl';
import { athenaBucketName } from '../../../../shared/app.config';
import { ordersTableName } from '../../index';

const config: DynamoAthenaTransferConfig = {
  athenaConfig: {
    bucket: athenaBucketName,
    key: 'id',
    tableName: getAthenaResourceName(ordersTableName),
    pathItems: ['createdBy', 'currency'],
  },
};

export const handler = createDynamoAthenaTableTriggerHandler(config);
```
> Create lambda handler for syncing dynamo table data into AWS Athena

```typescript
import {
  createDynamoAthenaHistorySyncHandler,
  getAthenaResourceName,
  DynamoAthenaTransferConfig,
} from '@golovchuk/aws-utils/etl';
import { athenaBucketName } from '../../../../shared/app.config';
import { ordersTableName } from '../../index';

const config: DynamoAthenaTransferConfig = {
  athenaConfig: {
    bucket: athenaBucketName,
    key: 'id',
    tableName: getAthenaResourceName(ordersTableName),
  },
};

export const handler = createDynamoAthenaHistorySyncHandler(config);
```

### lambda utils
> Placeholer

```typescript

```
>  Placeholer

```typescript

```
>  Placeholer

```typescript

```
>  Placeholer

```typescript

```
>  Placeholer

```typescript

```
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
### sns utils
> Create SNS publisher and publish message

```typescript
import { publisherClient } from '@golovchuk/aws-utils/sns';
import { accountId, stage } from '../../shared/app.config';
import { StartSyncEventMessage } from './models';

export const startSyncPublisher = publisherClient<StartSyncEventMessage>(
  `cloud-sync-${stage}`,
  accountId,
  true,
);

await startSyncPublisher.publish({ id: '123' });

```
> Get Topic ARN

```typescript
import { getTopicArn } from '../utilities';

const topicArn = getTopicArn(topicName, awsAccountId, region);
```

### shared utils
> Array utilities

```typescript
import { chunkArray } from '@golovchuk/aws-utils/shared';

const maxAllowedItemCountInBatch = 25; // AWS Restriction
const chunks = chunkArray(
    items.map((x) => <unknown>{ PutRequest: { Item: x } }),
    maxAllowedItemCountInBatch,
);
```

> Buffer utilities

```typescript
import { chunkBuffer, getBuffer } from '@golovchuk/aws-utils/shared';
  const mediaBuffer = getBuffer(content);
  const chunks = chunkBuffer(mediaBuffer, Math.pow(1024, 2) * chunkSizeInMb);
  const uploadId = '12345';
  const parts = await Promise.all(
    chunks.map((chunk, index) =>
      uploadPart(s3Key, uploadId!, chunk, index + 1, bucketName, logger),
    ),
  );


```

> File utilities

```typescript
import { FileUtils } from '@golovchuk/aws-utils/shared';

const fileSize = FileUtils.sizeInMb(mediaBuffer.byteLength);

const fileNameData = FileUtils.decompose(item.filename);
const s3Path = `${connection.userID}/${connection.id}/${fileNameData.name}`;
```

> Guard utilities

```typescript
import { Guard } from '@golovchuk/aws-utils/shared';

Guard.throwIfEmpty(key);
Guard.throwIfUndefined(userID);
Guard.throwIf(items.length !== 1, 'Found duplicate');
```

> Parsing utilities

```typescript
import { 
  isNumber,
  isString,
  isUint8Array,
  isBoolean,
  isBlob,
} from '@golovchuk/aws-utils/shared';

let throwError = false;

switch (true) {
  case isString(value):
    throwError = !value || (value as unknown) === '';
    break;
  case isNumber(value):
    throwError = !value;
    break;
  case isBoolean(value):
    throwError = value;
    break;
}

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
```
