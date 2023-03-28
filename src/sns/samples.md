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
