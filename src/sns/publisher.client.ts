import { SNS } from 'aws-sdk';
import { Region } from '../shared/models';
import { getTopicArn } from './utilities';

export interface PublisherClient<T> {
  publish: (item: T) => Promise<void>;
}

export default function publisherClient<T>(
  topicName: string,
  awsAccountId: string,
  logsEnabled = false,
  region = Region.NVirginia,
): PublisherClient<T> {
  if (!topicName || !awsAccountId) {
    throw new Error('Invalid publisher params. Failed to init publisher.');
  }

  const topicArn = getTopicArn(topicName, awsAccountId, region);

  const publish = async (item: T): Promise<void> => {
    if (!item) {
      throw new Error('Invalid item');
    }

    const sns = new SNS({ region: region });

    const request: SNS.PublishInput = {
      TopicArn: topicArn,
      Message: JSON.stringify(item),
    };

    if (logsEnabled) {
      console.debug('[aws utils] Publish request: ', request);
    }

    const pub = await sns.publish(request).promise();

    if (logsEnabled) {
      console.debug('[aws utils] Publish result: ', pub);
    }
  };

  return {
    publish,
  };
}
