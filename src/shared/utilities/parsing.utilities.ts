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
