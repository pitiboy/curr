import fs from 'node:fs';
import path from 'node:path';

let cached: string | null | undefined;

const FALLBACK_HTML = `<!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="refresh" content="0;url=/wake/?next=%2Fbackoffice%2F" />
  <title>KÖR – indulás</title>
</head>
<body>
  <p><a href="/wake/?next=%2Fbackoffice%2F">A szerver indul…</a></p>
</body>
</html>`;

function wakeHtmlCandidates(): string[] {
  const cwd = process.cwd();
  return [
    path.join(cwd, 'public/wake/index.html'),
    path.join(cwd, 'docs/deploy/wake/index.html'),
  ];
}

export function loadWakeLandingHtml(): string {
  if (cached !== undefined) {
    return cached ?? FALLBACK_HTML;
  }
  for (const file of wakeHtmlCandidates()) {
    try {
      cached = fs.readFileSync(file, 'utf8');
      return cached;
    } catch {
      /* try next */
    }
  }
  cached = null;
  return FALLBACK_HTML;
}

export function resetWakeLandingHtmlCacheForTests(): void {
  cached = undefined;
}
