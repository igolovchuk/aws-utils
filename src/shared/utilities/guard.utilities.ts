import { isNumber, isString } from './parsing.utilities';

export class Guard {
  static throwIfUndefined = (value?: any, message?: string): void => {
    if (!value) throw new Error(message || 'Value is required');
  };

  static throwIfEmpty = <T>(value?: T, message?: string): void => {
    let throwError = false;

    switch (true) {
      case isString(value):
        throwError = !value || (value as unknown) === '';
        break;
      case Array.isArray(value):
        throwError = !value || (value as any).length === 0;
        break;
      case isNumber(value):
        throwError = !value;
        break;
    }
    if (throwError) throw new Error(message || 'Value is required');
  };

  static throwIf = (condition: boolean, message?: string): void => {
    if (condition) throw new Error(message || 'Data was not valid');
  };
}
