import { DynamoDB } from 'aws-sdk';
import { buildQuery, executeQuery, executeScan } from './utilities';
import { QueryOutput, RepoQueryFilter } from './models';
import { batchPutAsync, updateAsync } from './utilities';

export interface Repository<T> {
  getItem: (key: string, value: string) => Promise<T>;
  putItem: (item: T) => Promise<void>;
  getAllItems: () => Promise<T[]>;
  getItemsBy: (filter: RepoQueryFilter) => Promise<QueryOutput<T>>;
  update: (
    keyName: string,
    updateKeys: Record<string, any>,
  ) => Promise<boolean>;
  batchPut: (items: Array<T>) => Promise<boolean>;
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

  const update = async (
    keyName: string,
    updateKeys: Record<string, any>,
  ): Promise<boolean> => {
    const client = new DynamoDB.DocumentClient();
    const result = await updateAsync(tableName, updateKeys, keyName, client);
    return result !== null && !result.$response.error;
  };

  // NOTE: item should contain all fields, if not the will be emptied as it is Put request
  const batchPut = async (items: Array<T>): Promise<boolean> => {
    if (!items?.length) return true;

    const client = new DynamoDB.DocumentClient();
    const result = await batchPutAsync(tableName, items, client);
    return result !== null && !result.some((r) => r.$response.error);
  };

  return {
    getItem,
    putItem,
    getItemsBy,
    getAllItems,
    update,
    batchPut,
    removeItem,
  };
}
