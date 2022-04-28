import { DynamoDB } from 'aws-sdk';
import { buildQuery, executeQuery, executeScan } from './utilities';
import { chunkArray } from '../shared/utilities';
import { QueryOutput, RepoQueryFilter } from './models';

export interface Repository<T> {
  getItem: (key: string, value: string) => Promise<T>;
  putItem: (item: T) => Promise<void>;
  getAllItems: () => Promise<T[]>;
  getItemsBy: (filter: RepoQueryFilter) => Promise<QueryOutput<T>>;
  updateRangeAsync: (items: Array<T>) => Promise<boolean>;
  removeItem: (key: string, value: string) => Promise<void>;
}

export default function dynamoRepository<T>(tableName: string): Repository<T> {
  const getItem = async (key: string, value: string): Promise<T> => {
    if (!key || !value) {
      throw new Error('Invalid key data');
    }

    const client = new DynamoDB.DocumentClient();
    const dbData = await client
      .get({
        TableName: tableName,
        Key: { [key]: value },
        ConsistentRead: true,
      })
      .promise();

    const item = dbData.Item;

    return <T>item;
  };

  const putItem = async (item: T): Promise<void> => {
    if (!item) {
      throw new Error('Invalid item');
    }

    const client = new DynamoDB.DocumentClient();
    await client
      .put({
        TableName: tableName,
        Item: item,
      })
      .promise();
  };

  const removeItem = async (key: string, value: string): Promise<void> => {
    if (!key || !value) {
      throw new Error('Invalid key data');
    }

    const client = new DynamoDB.DocumentClient();
    await client
      .delete({
        TableName: tableName,
        Key: { [key]: value },
      })
      .promise();
  };

  const getAllItems = async (): Promise<T[]> => {
    const res = await executeScan(tableName);

    return (res.items || []) as unknown as T[];
  };

  const getItemsBy = async (
    filter: RepoQueryFilter,
  ): Promise<QueryOutput<T>> => {
    const query = buildQuery({
      ...filter,
      tableName: tableName,
    });

    const items = await executeQuery<T>(query);

    return items;
  };

  // NOTE: item should contain all fields, if not the will be emptied as it is Put request
  const updateRangeAsync = async (items: Array<T>): Promise<boolean> => {
    try {
      const client = new DynamoDB.DocumentClient();

      const maxAllowedItemCountInBatch = 25; // AWS Restriction
      const chunks = chunkArray(
        items.map((x) => <unknown>{ PutRequest: { Item: x } }),
        maxAllowedItemCountInBatch,
      );

      const result = [];
      for (const chunk of chunks) {
        const resultOutput = await client
          .batchWrite({
            RequestItems: {
              [tableName]: chunk as DynamoDB.WriteRequest[],
            },
          })
          .promise();
        result.push(resultOutput);
      }

      return true;
    } catch (error) {
      console.error(`[aws utils] [updateRangeAsync]`, error);

      return false;
    }
  };

  return {
    getItem,
    putItem,
    getItemsBy,
    getAllItems,
    updateRangeAsync,
    removeItem,
  };
}
