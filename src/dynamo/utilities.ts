import {
  DynamoItemType,
  ExpressionOperationType,
  IndexProjectionType,
  QuerySelectType,
  SortOrder,
} from './models/enum.models';
import {
  ContainsAnyFilter,
  ContainsFilter,
  DynamoKey,
  EqualFilter,
  ExpressionOperation,
  FilterExpression,
  FilterExpressionOutput,
  IncludeFilter,
  QueryIndexFilter,
  QueryOutput,
  ScanFilter,
  ScanOutput,
} from './models';
import { DynamoDB } from 'aws-sdk';
import { chunkArray } from '../shared/utilities';
import { DynamoDBRecord, DynamoDBStreamEvent } from 'aws-lambda';
import { ILogger } from '../shared/models';
import type {
  ExpressionAttributeNameMap,
  ExpressionAttributeValueMap,
} from 'aws-sdk/clients/dynamodb';

export const buildQuery = (
  {
    tableName,
    keyFilter,
    indexFilter,
    expressionFilter,
    querySelect,
    limit,
    startKey,
  }: QueryIndexFilter,
  logger?: ILogger,
): DynamoDB.DocumentClient.QueryInput => {
  if (!keyFilter && !indexFilter) {
    throw new Error('Key filter nor index filter was provided.');
  }

  if (keyFilter && indexFilter) {
    throw new Error('Both Key filter and index filter were provided. Use one.');
  }

  let indexMainPart = undefined;
  let expression = '#key = :keyValue';
  let expAttrNames: ExpressionAttributeNameMap = {
    '#key': keyFilter?.hashKey || indexFilter?.indexKey || '',
  };
  let expAttrValues: ExpressionAttributeValueMap = {
    ':keyValue': DynamoDB.Converter.input(
      keyFilter?.hashKeyValue || indexFilter?.indexValue,
    ),
  };

  if (keyFilter?.rangeKeyFilter) {
    const { key, operation } = keyFilter.rangeKeyFilter;

    expression += buildExpression(key, operation, expAttrNames, expAttrValues);
  } else if (indexFilter) {
    indexMainPart = indexFilter.indexKey;

    if (indexFilter.rangeKeyFilter) {
      const { key, operation } = indexFilter.rangeKeyFilter;
      indexMainPart += `-${key}`;

      expression += buildExpression(
        key,
        operation,
        expAttrNames,
        expAttrValues,
      );
    }

    if (indexFilter.projectionType === IndexProjectionType.KEYS_ONLY) {
      indexMainPart += '-keys';
    }
  }

  const filterExpression = buildFilterExpression(expressionFilter);

  if (filterExpression.filter) {
    expAttrNames = { ...expAttrNames, ...filterExpression.attributeNames };
    expAttrValues = { ...expAttrValues, ...filterExpression.attributeValues };
  }

  const sortOrder =
    keyFilter?.rangeKeyFilter?.sortOrder ||
    indexFilter?.rangeKeyFilter?.sortOrder ||
    SortOrder.ASC;

  const query: DynamoDB.DocumentClient.QueryInput = {
    TableName: tableName,
    IndexName: indexFilter && `${indexMainPart}-index`,
    KeyConditionExpression: expression,
    ExpressionAttributeNames: expAttrNames,
    ExpressionAttributeValues: expAttrValues,
    FilterExpression: filterExpression.filter,
    Select: querySelect?.type || QuerySelectType.all,
    ProjectionExpression:
      (querySelect?.type === QuerySelectType.specific &&
        querySelect.names?.join(',')) ||
      undefined,
    Limit: limit,
    ExclusiveStartKey: startKey,
    ScanIndexForward: sortOrder == SortOrder.DESC ? false : true,
  };

  logger?.debug(`[aws utils] [buildQuery]`, query);

  return query;
};

export const executeQuery = async <T>(
  inputQuery: DynamoDB.DocumentClient.QueryInput,
  client?: DynamoDB.DocumentClient,
  countTotal = false,
  logger?: ILogger,
): Promise<QueryOutput<T>> => {
  let items: any[] = [];
  let itemsCount = 0;
  let totalCount: number | undefined = undefined;
  const errors: Array<AWS.AWSError> = [];
  let lastEvaluatedKey = inputQuery.ExclusiveStartKey;

  try {
    client = client || new DynamoDB.DocumentClient();
    const resultOutput = await client.query(inputQuery).promise();

    //console.log('[aws utils] QUERY OUTPUT:', JSON.stringify(resultOutput));

    items = items.concat(resultOutput.Items || []);
    itemsCount += resultOutput.Count || 0;

    lastEvaluatedKey = resultOutput.LastEvaluatedKey;

    if (!inputQuery.Limit || itemsCount < inputQuery.Limit) {
      while (lastEvaluatedKey) {
        inputQuery.ExclusiveStartKey = lastEvaluatedKey;
        const intemediateResult = await client.query(inputQuery).promise();
        //console.log('[aws utils] Intermediate Output received: ', intemediateResult);
        lastEvaluatedKey = intemediateResult.LastEvaluatedKey;

        if (intemediateResult.$response?.error) {
          errors.push(intemediateResult.$response.error);
          break;
        }

        items = items.concat(intemediateResult.Items || []);
        itemsCount += resultOutput.Count || 0;
      }
    }

    if (resultOutput.$response?.error) {
      errors.push(resultOutput.$response.error);
    }
  } catch (e) {
    errors.push(e as any);
  }

  if (countTotal && lastEvaluatedKey) {
    const tableDesc = await new DynamoDB()
      .describeTable({ TableName: inputQuery.TableName })
      .promise();

    totalCount = tableDesc.Table?.ItemCount || 0;
  } else {
    totalCount = itemsCount;
  }

  if (lastEvaluatedKey) {
    logger?.info(
      '[aws utils] [executeQuery] lastEvaluatedKey: ',
      lastEvaluatedKey,
    );
  }

  if (errors.length) {
    logger?.error('[aws utils] [executeQuery]', JSON.stringify(errors));
  }

  return {
    items: items as T[],
    itemsCount,
    totalCount,
    errors: errors.length > 0 ? errors : undefined,
    lastEvaluatedKey,
  };
};

export const executeScan = async (
  tableId: string,
  filter?: ScanFilter,
  logger?: ILogger,
): Promise<ScanOutput> => {
  let items: DynamoDB.ItemList = [];
  let itemsCount = 0;
  const errors: Array<AWS.AWSError> = [];
  const filterExpression = buildFilterExpression(filter?.expressionFilter);

  try {
    const client = new DynamoDB.DocumentClient();
    const scanInput: DynamoDB.ScanInput = {
      TableName: tableId,
      FilterExpression: filterExpression.filter,
      ExpressionAttributeNames: filterExpression.attributeNames,
      ExpressionAttributeValues: filterExpression.attributeValues,
      Select: filter?.querySelect?.type || QuerySelectType.all,
      ProjectionExpression:
        (filter?.querySelect?.type === QuerySelectType.specific &&
          filter?.querySelect.names?.join(',')) ||
        undefined,
    };

    logger?.debug('[aws utils] [executeScan] Input', scanInput);

    const resultOutput = await client.scan(scanInput).promise();

    items = items.concat(resultOutput.Items || []);
    itemsCount += resultOutput.Count || 0;

    let lastEvaluatedKey = resultOutput.LastEvaluatedKey;

    while (lastEvaluatedKey) {
      scanInput.ExclusiveStartKey = lastEvaluatedKey;
      const intemediateResult = await client.scan(scanInput).promise();
      lastEvaluatedKey = intemediateResult.LastEvaluatedKey;

      if (intemediateResult.$response?.error) {
        errors.push(intemediateResult.$response.error);
        break;
      }

      items = items.concat(resultOutput.Items || []);
      itemsCount += resultOutput.Count || 0;
    }

    if (resultOutput.$response?.error) {
      errors.push(resultOutput.$response.error);
    }
  } catch (e) {
    console.error('[aws utils] [executeScan]', e);
    errors.push(e as any);
  }

  return {
    items,
    itemsCount,
    errors: errors.length > 0 ? errors : undefined,
  };
};

export const updateAsync = async (
  tableName: string,
  item: any,
  key: DynamoKey,
  client?: DynamoDB.DocumentClient,
  logger?: ILogger,
) => {
  if (!client) {
    client = new DynamoDB.DocumentClient();
  }

  try {
    const params: any = {
      TableName: tableName,
      Key: {
        [key.hashKey.name]: key.hashKey.value || item[key.hashKey.name],
      },
      ExpressionAttributeValues: {},
      ExpressionAttributeNames: {},
      UpdateExpression: '',
      ReturnValues: 'UPDATED_NEW',
    };

    if (key.rangeKey) {
      params['Key'][key.rangeKey.name] =
        key.rangeKey.value || item[key.rangeKey.name];
    }

    let prefix = 'set ';
    const attributes = Object.keys(item);
    for (let i = 0; i < attributes.length; i++) {
      const attribute = attributes[i];
      if (attribute !== key.hashKey.name && attribute !== key.rangeKey?.name) {
        params['UpdateExpression'] +=
          prefix + '#' + attribute + ' = :' + attribute;
        params['ExpressionAttributeValues'][':' + attribute] = item[attribute];
        params['ExpressionAttributeNames']['#' + attribute] = attribute;
        prefix = ', ';
      }
    }

    logger?.debug(`[aws-utils] [updateAsync]`, params);
    const resultOutput = await client.update(params).promise();

    return resultOutput;
  } catch (error) {
    console.error(`[aws-utils] [updateAsync]`, error);

    return null;
  }
};

// NOTE: item should contain all fields, if not the will be emptied as it is Put request
export const batchPutAsync = async (
  tableName: string,
  items: Array<any>,
  client?: DynamoDB.DocumentClient,
) => {
  if (!client) {
    client = new DynamoDB.DocumentClient();
  }

  try {
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

    return result;
  } catch (error) {
    console.error(`[aws-utils] [batchPutAsync]`, error);

    return null;
  }
};

export const getTableName = (event: DynamoDBStreamEvent): string | undefined =>
  new RegExp(/(?<=table\/).*?(?=\/stream)/gm).exec(
    event.Records?.[0].eventSourceARN || '',
  )?.[0];

export const toItem = <T>(
  record: DynamoDBRecord,
  type: DynamoItemType = DynamoItemType.ANY,
): T => {
  const dynamoRecord = record.dynamodb;
  let item;

  switch (type) {
    case DynamoItemType.ANY:
      item = dynamoRecord?.NewImage || dynamoRecord?.OldImage;
      break;
    case DynamoItemType.NEW:
      item = dynamoRecord?.NewImage;
      break;
    case DynamoItemType.OLD:
      item = dynamoRecord?.OldImage;
      break;
  }

  return (item && DynamoDB.Converter.unmarshall(item)) as T;
};

const buildFilterExpression = (
  filter?: FilterExpression,
): FilterExpressionOutput => {
  if (!filter) return {};
  const { includeFilter, containsFilter, containsAnyFilter, equalFilter } =
    filter;
  const expAttrNames: ExpressionAttributeNameMap = {};
  const expAttrValues: ExpressionAttributeValueMap = {};
  let filterExpression = '';

  const useIncludeFilter =
    includeFilter &&
    includeFilter.attributeName &&
    includeFilter.filterValues?.length;

  if (useIncludeFilter) {
    filterExpression += buildIncludeFilter(
      includeFilter!,
      expAttrNames,
      expAttrValues,
    );
  }

  const useContainsFilter =
    containsFilter &&
    containsFilter.filterValue &&
    containsFilter.attributeNames?.length;

  if (useContainsFilter) {
    filterExpression += filterExpression ? ' AND ' : '';
    filterExpression += buildContainsFilter(
      containsFilter!,
      expAttrNames,
      expAttrValues,
    );
  }

  const useContainsAnyFilter =
    containsAnyFilter &&
    containsAnyFilter.attributeName &&
    containsAnyFilter.filterValues?.length;

  if (useContainsAnyFilter) {
    filterExpression += filterExpression ? ' AND ' : '';
    filterExpression += buildContainsAnyFilter(
      containsAnyFilter!,
      expAttrNames,
      expAttrValues,
    );
  }

  if (equalFilter) {
    filterExpression += filterExpression ? ' AND ' : '';
    filterExpression += buildEqualFilter(
      equalFilter!,
      expAttrNames,
      expAttrValues,
    );
  }

  const fiterResult =
    filterExpression && filterExpression !== '' ? filterExpression : undefined;

  const result = {
    filter: fiterResult,
    attributeNames: (fiterResult && expAttrNames) || undefined,
    attributeValues: (fiterResult && expAttrValues) || undefined,
  };

  return result;
};

const buildIncludeFilter = (
  includeFilter: IncludeFilter,
  expressionAttributeNames: ExpressionAttributeNameMap,
  expressionAttributeValues: ExpressionAttributeValueMap,
): string => {
  let filter = '';

  const { attributeName, filterValues } = includeFilter;
  expressionAttributeNames[`#includeFilter_${attributeName}`] = attributeName;

  filter += '(';
  for (let i = 0; i < filterValues.length; i++) {
    if (i > 0) {
      filter += ' OR ';
    }

    expressionAttributeValues[`:includeFilterValue${i}`] =
      DynamoDB.Converter.input(filterValues[i]);
    filter += `#includeFilter_${attributeName} = :includeFilterValue${i}`;
  }
  filter += ')';

  return filter;
};

const buildContainsFilter = (
  containsFilter: ContainsFilter,
  expressionAttributeNames: ExpressionAttributeNameMap,
  expressionAttributeValues: ExpressionAttributeValueMap,
): string => {
  let filter = '';

  const { attributeNames, filterValue } = containsFilter;
  expressionAttributeValues[`:containsFilterValue`] =
    DynamoDB.Converter.input(filterValue);

  filter += '(';
  for (let i = 0; i < attributeNames.length; i++) {
    if (i > 0) {
      filter += ' OR ';
    }

    expressionAttributeNames[`#containsFilter_${attributeNames[i]}`] =
      attributeNames[i];
    filter += `contains(#containsFilter_${attributeNames[i]}, :containsFilterValue)`;
  }
  filter += ')';

  return filter;
};

const buildContainsAnyFilter = (
  containsAnyFilter: ContainsAnyFilter,
  expressionAttributeNames: ExpressionAttributeNameMap,
  expressionAttributeValues: ExpressionAttributeValueMap,
): string => {
  let filter = '';

  const { attributeName, filterValues } = containsAnyFilter;
  expressionAttributeNames[`#containsAnyFilter`] = attributeName;

  filter += '(';

  for (let i = 0; i < filterValues.length; i++) {
    if (i > 0) {
      filter += ' OR ';
    }

    expressionAttributeValues[`:containsAnyFilterValue_${i}`] =
      DynamoDB.Converter.input(filterValues[i]);
    filter += `contains(#containsAnyFilter, :containsAnyFilterValue_${i})`;
  }

  filter += ')';

  return filter;
};

const buildEqualFilter = (
  equalFilter: EqualFilter,
  expressionAttributeNames: ExpressionAttributeNameMap,
  expressionAttributeValues: ExpressionAttributeValueMap,
): string => {
  let filter = '';
  const attributeNames = Object.keys(equalFilter);

  filter += '(';
  for (let i = 0; i < attributeNames.length; i++) {
    if (i > 0) {
      filter += ' AND ';
    }

    expressionAttributeNames[`#equalFilter_${i}`] = attributeNames[i];
    expressionAttributeValues[`:equalFilterValue_${i}`] =
      DynamoDB.Converter.input(equalFilter[attributeNames[i]]);
    filter += `#equalFilter_${i} = :equalFilterValue_${i}`;
  }
  filter += ')';

  return filter;
};

const buildExpression = (
  sortKey: string,
  operation: ExpressionOperation | undefined,
  expressionAttributeNames: ExpressionAttributeNameMap,
  expressionAttributeValues: ExpressionAttributeValueMap,
): string => {
  let expression = '';

  if (!operation) return expression;

  switch (operation.type) {
    case ExpressionOperationType.BETWEEN: {
      const { startValue, endValue } = operation.values;
      if (
        startValue &&
        endValue &&
        startValue !== 'undefined' &&
        endValue !== 'undefined'
      ) {
        expression += ` AND #${sortKey} BETWEEN :startValue AND :endValue`;
        expressionAttributeNames[`#${sortKey}`] = sortKey;
        expressionAttributeValues[`:startValue`] = startValue;
        expressionAttributeValues[`:endValue`] = endValue;
      }

      break;
    }
    case ExpressionOperationType.EQUAL_TO: {
      const { value } = operation.values;
      if (value && value !== 'undefined') {
        expression += ` AND #sortKeyName = :sortKeyValue`;
        expressionAttributeNames[`#sortKeyName`] = sortKey;
        expressionAttributeValues[`:sortKeyValue`] = value;
      }

      break;
    }

    default:
      break;
  }

  return expression;
};
