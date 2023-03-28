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
