export type DynamoAthenaTransferConfig = {
  dynamoConfig?: {
    region?: string;
    tableName?: string;
  };
  athenaConfig: {
    bucket: string;
    region?: string;
    key: string;
    tableName: string;
    pathItems?: string[];
    excludedColums?: string[];
  };
  debugMode?: boolean;
};
