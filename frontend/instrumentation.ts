export function register() {
  // Node.js 22+ --localstorage-file creates a localStorage global with no methods,
  // which breaks Next.js SSR client-detection. Remove it so server code behaves correctly.
  if (
    typeof (global as Record<string, unknown>).localStorage !== "undefined" &&
    typeof (global as unknown as { localStorage: Storage }).localStorage.getItem !== "function"
  ) {
    delete (global as Record<string, unknown>).localStorage;
  }
}
