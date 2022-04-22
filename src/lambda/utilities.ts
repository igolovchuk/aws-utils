import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { UserGroup } from './models';
import { Buffer } from 'buffer';
import { ApiError, ApiResponse, AuthData } from './models';
import { toPascalCase } from '../shared/utilities/parsing.utilities';

const requiredHeaders: any = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': '*',
  'Access-Control-Allow-Credentials': true,
};

export type Callback<E, R> = (
  event: E,
  context: any,
  callback: (error?: any, result?: R) => void,
) => Promise<R> | void;
export type APICallbackFunc = Callback<APIGatewayProxyEvent, any>;
export type APICallback = Callback<APIGatewayProxyEvent, APIGatewayProxyResult>;

export const withHeaders =
  (handler: APICallback): APICallback =>
  async (...args) => {
    // const [event] = args;
    // console.log('EVENT: ', event);

    const resp = await handler(...args);
    if (resp) {
      return {
        ...resp,
        headers: {
          ...resp.headers,
          ...requiredHeaders,
        },
      };
    }

    return {
      statusCode: 500,
      headers: {
        ...requiredHeaders,
      },
      body: JSON.stringify({ message: 'Could not get any response.' }),
    };
  };

export const withAdminRights =
  (handler: APICallbackFunc): APICallbackFunc =>
  async (...args) => {
    const [event] = args;
    const { userGroups } = getAuthData(event?.headers?.Authorization);

    if (!userGroups.length || !userGroups.includes(UserGroup.Admin)) {
      throw new ApiError('Admin rights required.', 401);
    }

    return handler(...args);
  };

export const withRights =
  (allowedGroups: UserGroup[], handler: APICallbackFunc): APICallbackFunc =>
  async (...args) => {
    const [event] = args;
    const { userGroups } = getAuthData(event?.headers?.Authorization);

    if (
      !userGroups.length ||
      !allowedGroups.some((x) => userGroups.includes(x))
    ) {
      throw new ApiError('You do not have enough rigths.', 401);
    }

    return handler(...args);
  };

export const apiCallback =
  (handler: APICallbackFunc): APICallback =>
  async (...args) => {
    try {
      const resp: ApiResponse<any> = await handler(...args);

      return {
        statusCode: resp.code,
        body:
          resp.isBase64Encoded || !resp.stringify
            ? resp.content
            : JSON.stringify(resp.content),
        headers: resp.headers,
        isBase64Encoded: resp.isBase64Encoded,
      };
    } catch (e) {
      if (e instanceof ApiError) {
        console.error('[apiCallback] API ERROR', e);
        return {
          statusCode: e.code || 500,
          body: JSON.stringify({ message: e.message }),
        };
      } else {
        console.error('[apiCallback] UNEXPECTED ERROR', e);
        return {
          statusCode: 500,
          body: JSON.stringify({ message: (e as any)?.message }),
        };
      }
    }
  };

export const createHandler = (callbackFn: APICallbackFunc) =>
  withHeaders(apiCallback(callbackFn));

export const getAuthData = (token?: string): AuthData => {
  const jwtPayload = getJwtPayload(token);

  return {
    userName: jwtPayload?.['cognito:username'] || '',
    userGroups: jwtPayload?.['cognito:groups'] || [],
  };
};

export const isAdmin = (authData?: AuthData): boolean =>
  authData?.userGroups?.includes(UserGroup.Admin) || false;

export const getHeader = (
  name: string,
  event: APIGatewayProxyEvent,
  required = true,
): string => {
  const value = event.headers[name] || event.headers[toPascalCase(name)];

  if (!value && required) {
    throw new ApiError(`${name} required.`, 400);
  }

  return value as string;
};

export const getPathParam = (
  name: string,
  event: APIGatewayProxyEvent,
  required = true,
): string => getParam(name, event.pathParameters, required);

export const getQueryParam = (
  name: string,
  event: APIGatewayProxyEvent,
  required = true,
): string => getParam(name, event.queryStringParameters, required);

export const getArrayQueryParam = (
  name: string,
  event: APIGatewayProxyEvent,
  required = true,
): string[] => {
  const param = event.multiValueQueryStringParameters?.[name];

  if (!param && required) {
    throw new ApiError(`${name} required.`, 400);
  }

  return param as string[];
};

export const getBody = <T>(
  event: APIGatewayProxyEvent,
  urlEncoded = false,
): T => {
  const bodyContent = getBodyContent(event);

  return urlEncoded
    ? decodeUrlEncodedBody(bodyContent)
    : (jsonParseExtended(bodyContent) as T);
};

export const getApiBaseUrl = (
  event: APIGatewayProxyEvent,
  includeStage = true,
): string => {
  const domainName = event.requestContext.domainName || event.headers['Host'];
  const stage = includeStage ? `/${event.requestContext.stage}` : '';

  return `https://${domainName}${stage}`;
};

export const getCallerBaseUrl = (event: APIGatewayProxyEvent): string =>
  event.headers['origin'] || event.headers['Origin'] || '';

export const getApiKey = (event: APIGatewayProxyEvent): string =>
  getParam('apiKey', event.requestContext?.identity as Record<string, any>);

export const getBodyContent = (
  event: APIGatewayProxyEvent,
  throwIfEmpty = false,
): string => {
  const bodyContent = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64').toString()
    : event.body || '';

  if (throwIfEmpty && (!bodyContent || bodyContent === '')) {
    throw new ApiError('Invalid body content', 400);
  }

  return bodyContent;
};

export const getRawBody = (event: APIGatewayProxyEvent): Buffer => {
  return event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64')
    : Buffer.from(event.body || '');
};

const decodeUrlEncodedBody = <T>(bodyContent: string): T => {
  const result: any = {};

  decodeURIComponent(bodyContent)
    .split('&')
    .map((x) => {
      const item = x.split('=');
      result[item[0]] = item[1];
    });

  return result as T;
};

const jsonParseExtended = (content: string) => {
  try {
    return JSON.parse(content, (k, v) => {
      if (
        v !== null &&
        typeof v === 'object' &&
        'type' in v &&
        v.type === 'Buffer' &&
        'data' in v &&
        Array.isArray(v.data)
      ) {
        return Buffer.from(v.data);
      }
      return v;
    });
  } catch (e) {
    console.error('[jsonParseExtended]', e);
    return {};
  }
};

const getJwtPayload = (token?: string) => {
  try {
    const jwtPayload =
      token &&
      JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());

    return jwtPayload;
  } catch (ex) {
    console.error('[getJwtPayload]', ex);
    return undefined;
  }
};

const getParam = (
  name: string,
  params: Record<string, string | undefined> | null,
  required = true,
): string => {
  let value = params?.[name];
  value = value === 'undefined' ? undefined : value;

  if (!value && required) {
    throw new ApiError(`${name} required.`, 400);
  }

  return value as string;
};
