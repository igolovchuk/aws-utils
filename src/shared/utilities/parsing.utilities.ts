export const parseObject = <T>(data?: string): T | undefined => {
  try {
    if (!data) return undefined;

    return JSON.parse(data) as T;
  } catch (error) {
    return undefined;
  }
};

export const toPascalCase = (value: string): string =>
  value.replace(
    /(\w)(\w*)/g,
    (g0, g1, g2) => g1.toUpperCase() + g2.toLowerCase(),
  );

export const toQueryString = (data: Record<string, any>): string =>
  data ? new URLSearchParams(data).toString() : '';

export const isString = (value: any): boolean =>
  typeof value === 'string' || value instanceof String;

export const isNumber = (value: any): boolean =>
  typeof value === 'number' && !isNaN(value);
