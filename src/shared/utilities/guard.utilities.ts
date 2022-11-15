export class Guard {
  static throwIfUndefined = (value?: string, message?: string): void => {
    if (!value) throw new Error(message || 'Value is required');
  };
  static throwIfEmpty = (value?: string, message?: string): void => {
    const throwError = !value || value === '';
    if (throwError) throw new Error(message || 'Value is required');
  };
}
