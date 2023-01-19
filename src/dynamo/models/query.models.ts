import {
  ExpressionOperationType,
  FilterOperation,
  IndexProjectionType,
  QuerySelectType,
  SortOrder,
} from './enum.models';
import { DynamoDB } from 'aws-sdk';

export interface RangeKeyFilter {
  key: string;
  sortOrder?: SortOrder;
  operation?: ExpressionOperation;
}

export interface ExpressionOperation {
  type: ExpressionOperationType;
  values: Record<string, any>;
}

export interface EqualFilter {
  [attributeName: string]: any;
}

export interface IncludeFilter {
  attributeName: string;
  filterValues: any[];
}

export interface ContainsFilter {
  attributeNames: string[];
  filterValue: any;
}

export interface ContainsArrayFilter {
  items: ContainsArrayFilterItem[];
  filterOperation?: FilterOperation;
}

export interface ContainsArrayFilterItem {
  attributeName: string;
  filterValues: any[];
  filterOperation?: FilterOperation;
}

export interface IndexFilter {
  /**
   * Indexed property name, the index generation pattern should follow
   * this rul <property>-<anotherProperty(optional)>-index.
   */
  indexKey: string;
  /**
   * Indexed property value
   */
  indexValue: string;
  /**
   * Default is ALL, if you set KEYS_ONLY it will add -keys suffix to index name,
   * so please ensure you have index named <property>-keys-index.
   */
  projectionType?: IndexProjectionType;
  rangeKeyFilter?: RangeKeyFilter;
}

export interface KeyFilter {
  hashKey: string;
  hashKeyValue: string;
  rangeKeyFilter?: RangeKeyFilter;
}

export type RepoQueryFilter = Omit<QueryIndexFilter, 'tableName'>;

export interface QueryIndexFilter {
  tableName: string;
  querySelect?: QuerySelect;
  keyFilter?: KeyFilter;
  indexFilter?: IndexFilter;
  expressionFilter?: FilterExpression;
  limit?: number;
  startKey?: Record<string, any>;
}

export interface ScanFilter {
  querySelect?: QuerySelect;
  expressionFilter?: FilterExpression;
}

export interface FilterExpression {
  /**
   * Filters attribute by multiple values with OR operation
   * Ex. get all items where status any of the values [ACTIVE, PENDING]
   */
  includeFilter?: IncludeFilter;
  /**
   * Filters multiple attribute names by the same value
   * Ex. get item where isDeleted and isAdmin = false;
   */
  containsFilter?: ContainsFilter;
  /**
   * Filters array fields of the table by [AND, OR] comparison
   * Supports multiple filters at a time, operations between multiple filters - ['AND', 'OR]
   * Ex. get all items where userTags contains ['nature' AND/OR 'forest'] AND autoTags contains ['trees']
   */
  containsArrayFilter?: ContainsArrayFilter;
  /**
   * Filters attributes by the its values with AND operation
   * Ex. get all items where status = ACTIVE and isDeleted = false
   */
  equalFilter?: EqualFilter;
}

export interface FilterExpressionOutput {
  filter?: string;
  attributeNames?: Record<string, string>;
  attributeValues?: Record<string, any>;
}

export interface QuerySelect {
  /**
   * Default is ALL_ATTRIBUTES, you can specify other type depending on the need.
   */
  type: QuerySelectType;
  /**
   * Used only for QuerySelectType.specific, sample of names:
   * Description, RelatedItems[0], ProductReviews.FiveStar.
   */
  names?: string[];
}

export interface QueryOutput<T> {
  items: T[];
  itemsCount: number;
  errors?: AWS.AWSError[];
  totalCount?: number;
  lastEvaluatedKey?: Record<string, any>;
}

export interface ScanOutput {
  items?: DynamoDB.ItemList;
  itemsCount: number;
  errors?: AWS.AWSError[];
}
