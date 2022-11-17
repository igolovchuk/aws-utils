export class Guard {
  static throwIfUndefined = (value?: any, message?: string): void => {
    if (!value) throw new Error(message || 'Value is required');
  };
  static throwIfEmpty = (value?: string, message?: string): void => {
    const throwError = !value || value === '';
    if (throwError) throw new Error(message || 'Value is required');
  };
  static throwIf = (condition: boolean, message?: string): void => {
    if (condition) throw new Error(message || 'Data was not valid');
  };
}
