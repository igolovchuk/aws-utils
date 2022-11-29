export const chunkArray = <T>(myArray: Array<T>, chunkSize: number): T[][] => {
  let index = 0;
  const arrayLength = myArray.length;
  const tempArray = [];

  for (index = 0; index < arrayLength; index += chunkSize) {
    const myChunk = myArray.slice(index, index + chunkSize);
    // Do something if you want with the group
    tempArray.push(myChunk);
  }

  return tempArray;
};

export const chunkBuffer = (
  buffer: Buffer,
  chunkSizeInBytes: number,
): Buffer[] => {
  let index = 0;
  const arrayLength = buffer.length;
  const result = [];

  while (index < arrayLength) {
    result.push(buffer.slice(index, (index += chunkSizeInBytes)));
  }

  return result;
};
