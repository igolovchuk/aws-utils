import { DynamoDB } from 'aws-sdk';
import { buildQuery, executeQuery, executeScan } from './utilities';
import { DynamoKey, QueryOutput, RepoQueryFilter } from './models';
import { batchPutAsync, updateAsync } from './utilities';
import type { ILogger } from '../shared/models';
import { Guard, isString } from '../shared/utilities';
import type { Key } from 'aws-sdk/clients/dynamodb';

export interface Repository<T> {
  /**
   * @param {DynamoKey | string} key - Key property name
   * @param {string} value - Key property value
   * @returns {T} Item object.
   */
  getItem: (key: DynamoKey | string, value?: string) => Promise<T>;

  /**
   * @param {T} item - Key property name
   */
  putItem: (item: T) => Promise<void>;

  /**
   * Scans the table and reads everything until the end.
   * @returns {T[]} Items array
   */
  getAllItems: () => Promise<T[]>;

  /**
   * @param  {RepoQueryFilter} filter
   * @returns {boolean} Query output result.
   */
  getItemsBy: (filter: RepoQueryFilter) => Promise<QueryOutput<T>>;

  /**
   * Partial update of object properties.
   * @param  {DynamoKey | string} key Key property name
   * @param  {Partial<T>} updateProps Item properties to update
   * @returns {boolean} True if success, otherwise - False.
   */
  update: (
    key: DynamoKey | string,
    updateProps: Partial<T>,
  ) => Promise<boolean>;

  /**
   * @param {Array<T>} items - Each Item should contain all fields, if not the will be emptied as it is Put request
   * @returns {boolean} True if success, otherwise - False.
   */
  batchPut: (items: Array<T>) => Promise<boolean>;

  /**
   * @param {DynamoKey | string} key - Key property name
   * @param {string} value - Key property value
   */
  removeItem: (key: DynamoKey | string, value?: string) => Promise<void>;
}

export default function dynamoRepository<T>(
  tableName: string,
  logger?: ILogger,
): Repository<T> {
  const getItem = async (
    key: DynamoKey | string,
    value?: string,
  ): Promise<T> => {
    const dbKey = getDbKey(key, value);
    const client = new DynamoDB.DocumentClient();
    const dbData = await client
      .get({
        TableName: tableName,
        Key: dbKey,
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

  const removeItem = async (
    key: DynamoKey | string,
    value?: string,
  ): Promise<void> => {
    const dbKey = getDbKey(key, value);
    const client = new DynamoDB.DocumentClient();
    await client
      .delete({
        TableName: tableName,
        Key: dbKey,
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
    const query = buildQuery(
      {
        ...filter,
        tableName: tableName,
      },
      logger,
    );

    const items = await executeQuery<T>(query);

    return items;
  };

  const update = async (
    key: DynamoKey | string,
    updateProps: Partial<T>,
  ): Promise<boolean> => {
    const client = new DynamoDB.DocumentClient();
    const dbKey = isString(key) ? { hashKey: { name: key } } : key;
    const result = await updateAsync(
      tableName,
      updateProps,
      dbKey as DynamoKey,
      client,
      logger,
    );

    return result !== null && !result.$response.error;
  };

  // NOTE: item should contain all fields, if not the will be emptied as it is Put request
  const batchPut = async (items: Array<T>): Promise<boolean> => {
    if (!items?.length) return true;

    const client = new DynamoDB.DocumentClient();
    const result = await batchPutAsync(tableName, items, client);
    return result !== null && !result.some((r) => r.$response.error);
  };

  const getDbKey = (key: DynamoKey | string, value?: string): Key => {
    const isSimpleKey = isString(key);

    Guard.throwIfUndefined(key, 'Key is required.');
    Guard.throwIf(isSimpleKey && !value, 'Value is required.');

    const keyData = key as any;
    const dbKey = isSimpleKey
      ? { [keyData]: value }
      : { [keyData.hashKey.name]: keyData.hashKey.value };

    if (keyData.rangeKey) {
      dbKey[keyData.rangeKey.name] = keyData.rangeKey.value;
    }

    return dbKey;
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
