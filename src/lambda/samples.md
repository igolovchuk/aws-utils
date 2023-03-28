### lambda utils

> Lambda Endpoint Handler

```typescript
import {
  ApiResponse,
  createHandler,
  getAuthData,
  getPathParam,
  getBody,
  isAdmin,
} from '@golovchuk/aws-utils/lambda';
import { APIGatewayProxyEvent } from 'aws-lambda';

import {
  ContentUploadUrlRequest,
  createContentUploadUrl,
} from '../../../services/content.service';

const endpoint = async (
  event: APIGatewayProxyEvent,
): Promise<ApiResponse<string>> => {
  const id = getPathParam('id', event);
  const model = getBody<ContentUploadUrlRequest>(event);
  const { userName, userGroups } = getAuthData(event.headers.Authorization);

  const url = await createContentUploadUrl({
    ...model,
    id,
    userName,
    isAdmin: isAdmin({ userGroups }),
  });

  return new ApiResponse(url);
};

export const handler = createHandler(endpoint);

```
>  Use Query parameters

```typescript
import {
  ApiResponse,
  createHandler,
  getQueryParam,
  getArrayQueryParam,
} from '@golovchuk/aws-utils/lambda';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { SubscriptionModel } from '../../../models';
import { getSubscriptions } from '../../../services/subscription.service';

const endpoint = async (
  event: APIGatewayProxyEvent,
): Promise<ApiResponse<SubscriptionModel[]>> => {
  const customerId = getQueryParam('customerId', event);
  const customerIds = getArrayQueryParam('customerId', event);
  const items = await getSubscriptions(customerId);

  return new ApiResponse(items);
};

export const handler = createHandler(endpoint);

```
>  Throw errors

```typescript
import {
  ApiError,
  ApiResponse,
  createHandler,
  getBody,
} from '@golovchuk/aws-utils/lambda';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { logger } from '../../../../shared/services';
import { stripeApi } from '../../../index';
import validator from './validator';
import { PortalAccessRequest, PortalAccessResponse } from './models';
import { getCustomer } from '../../../services/customer.service';

const endpoint = async (
  event: APIGatewayProxyEvent,
): Promise<ApiResponse<PortalAccessResponse>> => {
  const model = getBody<PortalAccessRequest>(event);
  await validator.validateAsync(model);

  const { customerId, redirectUrl } = model;
  const customer = await getCustomer(customerId);
  ApiError.throwIf(!customer, `Customer ${customerId} not found`);

  const session = await stripeApi.billingPortal.sessions.create({
    configuration: 'configId',
    customer: customer.stripeId,
    return_url: redirectUrl,
  });

  return new ApiResponse({ customerId, url: session.url });
};

export const handler = createHandler(endpoint);

```

>  JWT Payload parsing

```typescript
import { getJwtPayload, getParam } from '@golovchuk/aws-utils/lambda';

export function getAuthData(token?: string) {
  const payload = getJwtPayload(token);
  const userId = getParam('sub', payload).toString();
  return {
    userId,
  };
}
```

>  Handle API keys and Redirect URLs

```typescript
import {
  ApiError,
  ApiResponse,
  createHandler,
  getApiBaseUrl,
  getApiKey,
  getHeader,
  getBody,
} from '@golovchuk/aws-utils/lambda';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { stripeApi } from '../../../index';
import { CheckoutRequest, CheckoutResponse, CheckoutType } from './models';
import { createOrder } from '../../../../orders/order.service';
import { nanoid } from 'nanoid';
import { ToCheckoutSessionItem } from './mappers';
import { getUnixTime, addMinutes } from 'date-fns';
import { getCustomer } from '../../../services/customer.service';
import Stripe from 'stripe';

const endpoint = async (
  event: APIGatewayProxyEvent,
): Promise<ApiResponse<CheckoutResponse>> => {
  logger.debug(event);
  const apiKey = getApiKey(event);
  const model = getBody<CheckoutRequest>(event);
  const existingCustomer = await getCustomer(model.customerId);
  const orderId = nanoid();
  const lineItems = model.items.map(ToCheckoutSessionItem);
  const priceId = model.items[0].priceId;
  const redirectUrl =
    model.redirectUrl || `${getApiBaseUrl(event)}/v1/orders/payment-status`;

  const session = await stripeApi.checkout.sessions.create({
    line_items: lineItems,
    client_reference_id: orderId,
    mode: model.type,
    customer: existingCustomer?.stripeId,
    expires_at: getUnixTime(addMinutes(Date.now(), 60)), 
    success_url: `${redirectUrl}?status=success`,
    cancel_url: `${redirectUrl}?status=error`,
  });

  await createOrder(
    {
      id: orderId,
      reference: session.url!,
      currency: price.currency.toUpperCase(),
      customerId: existingCustomer?.id,
      items: lineItems.map((x) => ({
        assetName: product.name,
        assetId: product?.id,
        priceId: priceId,
        quantity: x.quantity!,
        unitPrice: price.unit_amount,
      })),
    },
    apiKey,
  );

  return new ApiResponse({ orderId: orderId, url: session.url! });
};

export const handler = createHandler(endpoint);

```
>  Lambda Handler Wrappers

```typescript
import { withHeaders, apiCallback, UserGroup } from '@golovchuk/aws-utils/lambda';

const createHandler = (callbackFn: APICallbackFunc) => withHeaders(apiCallback(callbackFn));
const createHandler = (callbackFn: APICallbackFunc) => withAdminRights(apiCallback(callbackFn));
const createHandler = (callbackFn: APICallbackFunc) => withRights([UserGroup.Admin], apiCallback(callbackFn));

```

>  Get Header data

```typescript
import { getHeader } from '@golovchuk/aws-utils/lambda';

const signature = getHeader('stripe-signature', event);
```

>  Get Auth data

```typescript
import { getAuthData, getJwtPayload, getApiKey } from '@golovchuk/aws-utils/lambda';

const { userName, userGroups } = getAuthData(event.headers.Authorization);
const payload = getJwtPayload(event.headers.Authorization);
const apiKey = getApiKey(event);
```

>  Get Body data

```typescript
import {
  getRawBody,
  getBodyContent,
  getBody,
} from '@golovchuk/aws-utils/lambda';
import { APIGatewayProxyEvent } from 'aws-lambda';

const rawBody: Buffer = getRawBody(event);
const stringBody: string = getBodyContent(event);
const modelBody = getBody<ContentUploadUrlRequest>(event);
```

>  Get Parameters

```typescript
import {
  getQueryParam,
  getArrayQueryParam,
  getPathParam,
  getParam,
} from '@golovchuk/aws-utils/lambda';
import { APIGatewayProxyEvent } from 'aws-lambda';


const customerId = getQueryParam('id', event);
const customerIds = getArrayQueryParam('id', event);
const customerId = getPathParam('id', event);
const customerId = getParam('id', event.queryStringParameters, required: true);
```

>  Get Caller Data

```typescript
import { getApiBaseUrl, getCallerBaseUrl } from '@golovchuk/aws-utils/lambda';

const redirectUrl = `${getApiBaseUrl(event)}/v1/orders/payment-status`;
const redirectUrl = getCallerBaseUrl(event);
```
