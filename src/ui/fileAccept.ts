// `accept` values for file inputs.
//
// Chrome on Android opens its "Camera / Photos & videos / Files" chooser unless `accept` comes
// down to exactly one MIME type that is not an image, video or audio type. A list such as
// `.gz,application/gzip` counts as several, so on Android every input gets `application/*`:
// one type, no camera, and it matches however the sending app labelled the file
// (`application/gzip`, `application/x-gzip`, `application/octet-stream`, `application/json`).
// The file is checked after it is opened anyway. Other platforms keep the precise list, which
// iOS and desktop pickers filter on well.

const ANDROID_ACCEPT = 'application/*';

export function isAndroid(userAgent: string): boolean {
  return /\bAndroid\b/i.test(userAgent);
}

export function fileAccept(accept: string, userAgent = navigator.userAgent): string {
  return isAndroid(userAgent) ? ANDROID_ACCEPT : accept;
}
