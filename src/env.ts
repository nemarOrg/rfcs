/** The clock a run uses: `text` when given (tests and rehearsals), else the real time. */
export function parseNow(text: string | undefined, name: string): Date {
  if (text === undefined || text === "") return new Date();
  const now = new Date(text);
  if (Number.isNaN(now.getTime())) throw new Error(`${name} is not a timestamp: ${text}`);
  return now;
}

/** A pull request number from `RFC_PR_NUMBER`; anything but a positive integer is an error. */
export function parsePrNumber(text: string): number {
  if (!/^[1-9][0-9]*$/.test(text)) {
    throw new Error(`RFC_PR_NUMBER is not a pull request number: ${text}`);
  }
  return Number(text);
}
