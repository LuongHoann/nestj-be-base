/**
 * Safely stringify objects that may contain BigInt values
 * @param obj - The object to stringify
 * @returns JSON string with BigInt values converted to strings
 */
export function safeStringify(obj: any): string {
  return JSON.stringify(obj, (_, value) =>
    typeof value === 'bigint' ? value.toString() : value,
  );
}
