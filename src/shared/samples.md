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
