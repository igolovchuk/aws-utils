/**
 * @param {string} name - Key name
 * @param {string} value - Value of the key, if not provided it  supposed to be present in the item object, like for update operation.
 */
export interface DynamoKey {
  hashKey: {
    name: string;
    value?: string;
  };
  rangeKey?: {
    name: string;
    value?: string;
  };
}
