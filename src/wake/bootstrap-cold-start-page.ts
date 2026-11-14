import { WAKE_BOOTSTRAP_REDIRECT } from './bootstrap-browser';

/** Rövid szünet, hogy a hidegindítás üzenet olvasható legyen az azonnali 302 helyett. */
export const WAKE_COLD_START_REDIRECT_DELAY_MS = 2000;

function escapeHtmlAttr(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;');
}

export function buildColdStartInterstitialHtml(
  redirectTo: string = WAKE_BOOTSTRAP_REDIRECT,
  delayMs: number = WAKE_COLD_START_REDIRECT_DELAY_MS,
): string {
  const target =
    redirectTo.startsWith('/') && !redirectTo.startsWith('//')
      ? redirectTo
      : WAKE_BOOTSTRAP_REDIRECT;
  const safeTarget = escapeHtmlAttr(target);
  const delaySec = Math.max(1, Math.round(delayMs / 1000));

  return `<!doctype html>
<html lang="hu">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <meta http-equiv="refresh" content="${delaySec};url=${safeTarget}" />
  <title>KÖR – indulás</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; line-height: 1.5; color: #1a1f24; }
    p { max-width: 28rem; }
    a { color: #2d6a4f; }
  </style>
</head>
<body>
  <p><strong>Az oldal éppen hidegen indul.</strong></p>
  <p>Átirányítás következik…</p>
  <p><a href="${safeTarget}">Ha nem történik semmi, kattints ide.</a></p>
  <script>
    setTimeout(function () {
      location.replace(${JSON.stringify(target)});
    }, ${delayMs});
  </script>
</body>
</html>`;
}
