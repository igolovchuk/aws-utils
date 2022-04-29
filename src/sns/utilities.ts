import { Region } from '../shared/models';

export const getTopicArn = (
  name: string,
  awsAccountId: string,
  region = Region.NVirginia,
): string => `arn:aws:sns:${region}:${awsAccountId}:${name}`;

export const getSubscriptionName = (
  topicName: string,
  projectName: string,
): string => `${topicName}-${projectName}-sub`;
