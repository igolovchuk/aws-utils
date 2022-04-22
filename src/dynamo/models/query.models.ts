import {
  ExpressionOperationType,
  QuerySelectType,
  SortOrder,
} from './enum.models';
import { DynamoDB } from 'aws-sdk';

export interface SortKeyFilter {
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
  indexKey: string;
  indexValue: string;
  sortKeyFilter?: SortKeyFilter;
}

export interface KeyFilter {
  hashKey: string;
  hashKeyValue: string;
  sortKeyFilter?: SortKeyFilter;
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
