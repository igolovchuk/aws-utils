export class ApiResponse<T> {
  content: T;
  code: number;
  isBase64Encoded: boolean;
  stringify: boolean;
  headers?: {
    [header: string]: boolean | number | string;
  };

  constructor(
    content: T,
    code = 200,
    headers = {},
    isBase64Encoded = false,
    stringify = true,
  ) {
    this.content = content;
    this.code = code;
    this.headers = headers;
    this.isBase64Encoded = isBase64Encoded;
    this.stringify = stringify;
  }
}

export class ApiError extends Error {
  code: number;
  validationErrors?: string[];
  constructor(
    message: string,
    code = 500,
    validationErrors: string[] | undefined = undefined,
  ) {
    super(message);
    this.message = message;
    this.code = code;
    this.validationErrors = validationErrors;
  }
}
