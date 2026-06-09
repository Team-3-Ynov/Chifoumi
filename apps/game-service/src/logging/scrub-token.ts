export function scrubTokenFromUrl(url: string): string {
  return url.replace(/([?&]token=)[^&]*/gi, "$1***");
}
