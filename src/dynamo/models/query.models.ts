import {
  ExpressionOperationType,
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
  [attributeName: string]: string;
}

export interface IncludeFilter {
  attributeName: string;
  filterValues: string[];
}

export interface ContainsFilter {
  attributeNames: string[];
  filterValue: string;
}

export interface ContainsAnyFilter {
  attributeName: string;
  filterValues: string[];
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
  querySelectType?: QuerySelectType;
  keyFilter?: KeyFilter;
  indexFilter?: IndexFilter;
  includeFilter?: IncludeFilter;
  containsFilter?: ContainsFilter;
  containsAnyFilter?: ContainsAnyFilter;
  equalFilter?: EqualFilter;
  limit?: number;
  startKey?: Record<string, any>;
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
