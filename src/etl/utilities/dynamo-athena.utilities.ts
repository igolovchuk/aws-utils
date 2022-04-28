import { DynamoAthenaTransferConfig } from '../models';
import { S3, DynamoDB } from 'aws-sdk';
import { Region } from '../../shared/models';
import { executeScan } from '../../dynamo/utilities';

export const createDynamoAthenaHistorySyncHandler =
  (config: DynamoAthenaTransferConfig) => async () => {
    if (!config.dynamoConfig?.tableName) {
      throw new Error('Invalid config. Dynamo table name is required.');
    }

    const res = await executeScan(config.dynamoConfig.tableName!);
    if (res.errors || !res.itemsCount) {
      console.error(
        '[aws utils] Scan has errors or zero items. Stopping...',
        JSON.stringify(res),
      );
      return;
    }

    await syncTableRecords(res.items || [], config);
  };

export const createDynamoAthenaTableTriggerHandler =
  (config: DynamoAthenaTransferConfig) => async (event: any) =>
    await syncTableRecords(event.Records, config, true);

export const getAthenaResourceName = (resourceName: string): string =>
  resourceName.replace(/-/g, '_').toLowerCase();

const syncTableRecords = async (
  records: DynamoDB.ItemList,
  config: DynamoAthenaTransferConfig,
  tableTrigger?: boolean,
): Promise<void> => {
  console.info('[aws utils] Records Received: ', records.length);
  const { dynamoConfig, athenaConfig, debugMode } = config;

  if (!athenaConfig.bucket) {
    console.error(
      '[aws utils] Reporting bucket wasn not configured, skipping put to Athena.',
    );
    return;
  }

  const s3 = new S3({
    region: athenaConfig.region || Region.Frankfurt,
  });
  let syncedCount = 0;
  for (const record of records) {
    try {
      const isDeleted = record?.eventName === 'REMOVE';
      const itemData: any = tableTrigger ? getTriggerRecord(record) : record;
      if (debugMode) {
        console.debug(`[aws utils] Dynamo record:`, JSON.stringify(record));
      }

      for (const [key, value] of Object.entries(itemData)) {
        if (athenaConfig.excludedColums?.includes(key)) {
          continue;
        }

        itemData[key] = value;
      }

      let path = athenaConfig.tableName;

      if (athenaConfig.pathItems) {
        const pathValues = athenaConfig.pathItems
          .map((x) => itemData[x])
          .filter((x) => x !== undefined && x !== '');

        if (pathValues?.length) {
          path += `/${pathValues.join('/')}`;
        }
      }

      path += `/${itemData[athenaConfig.key]}.json`;

      if (debugMode) {
        console.debug(`[aws utils] Item data:`, JSON.stringify(itemData));
      }

      await s3
        .putObject({
          Bucket: athenaConfig.bucket,
          Key: path,
          Body: JSON.stringify({
            ...itemData,
            isDeleted,
            region: dynamoConfig?.region || Region.Frankfurt,
          }),
        })
        .promise();

      syncedCount++;
    } catch (error) {
      console.error('[aws utils] Could not put data to Athena s3', error);
    }
  }

  console.info(`[aws utils] Sync result: ${syncedCount}/${records.length}`);
};

const getTriggerRecord = (
  record: DynamoDB.AttributeMap,
): Record<string, any> => {
  const dynamoRecord = (record as Record<string, any>)?.dynamodb;
  const item = dynamoRecord?.NewImage || dynamoRecord?.OldImage || {};
  return DynamoDB.Converter.unmarshall(item);
};
