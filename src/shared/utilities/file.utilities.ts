export class FileUtils {
  static decompose = (
    fileName: string,
  ): { name: string; extension: string } => {
    const splitted = fileName.split('.');
    if (splitted?.length !== 2)
      throw new Error(`Could not parse file ${fileName}`);

    return { name: splitted[0], extension: splitted[1] };
  };

  static sizeInMb = (bytes?: number): number => {
    return (bytes || 0) / (1024 * 1000);
  };
}
