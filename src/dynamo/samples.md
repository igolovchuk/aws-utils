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
