export enum QuerySelectType {
  all = 'ALL_ATTRIBUTES',
  onlyProjected = 'ALL_PROJECTED_ATTRIBUTES',
  specific = 'SPECIFIC_ATTRIBUTES',
  count = 'COUNT',
}

export enum SortOrder {
  ASC = 'Asc',
  DESC = 'Desc',
}

export enum ExpressionOperationType {
  BETWEEN = 'BETWEEN',
  EQUAL_TO = 'EQUAL_TO',
}

export enum DynamoItemType {
  ANY = 'ANY',
  NEW = 'NEW',
  OLD = 'OLD',
}
