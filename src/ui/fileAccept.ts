// `accept` values for file inputs.
//
// On Android, `FileButton` opens the Files app directly where the browser can; this is for the
// file input it falls back to. There Chrome lists every app that hands out files (the camera
// and "Photos & videos" among them) and filters the Files app by `accept`: `application/*`
// keeps the camera away and matches however the sending app labelled the file
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
