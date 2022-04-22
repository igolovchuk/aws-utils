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
        'Scan has errors or zero items. Stopping...',
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
  resourceName.replace(/-/g, '_');

const syncTableRecords = async (
  records: DynamoDB.ItemList,
  config: DynamoAthenaTransferConfig,
  tableTrigger?: boolean,
): Promise<void> => {
  const { dynamoConfig, athenaConfig } = config;

  if (!athenaConfig.bucket) {
    console.error(
      'Reporting bucket wasn not configured, skipping put to Athena.',
    );
    return;
  }

  const s3 = new S3({
    region: athenaConfig.region || Region.Frankfurt,
  });
  let syncedCount = 0;
  for (const record of records) {
    try {
      let isDeleted = false;
      const itemData: any = tableTrigger ? {} : record;

      if (tableTrigger) {
        const dynamoRecord = (record as Record<string, any>)?.dynamodb;
        const data: Record<string, any> =
          dynamoRecord?.NewImage || dynamoRecord?.OldImage || {};
        isDeleted = record.eventName === 'REMOVE';

        for (const [key, value] of Object.entries(data)) {
          if (athenaConfig.excludedColums?.includes(key)) {
            continue;
          }

          itemData[key] =
            value['S'] ||
            value['N'] ||
            (value['L'] &&
              value['L'].map((x: any) => x['S'] || x['N'] || x['BOOL'])) ||
            (value['M'] && JSON.stringify(value['M'])) ||
            (value['BOOL'] !== undefined && value['BOOL']);
        }
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
      console.error('ERROR: could not put data to Athena', error);
    }
  }

  console.info(`(syncedCount/records): ${syncedCount}/${records.length}`);
};
