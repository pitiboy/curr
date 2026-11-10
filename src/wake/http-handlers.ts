import type { IncomingMessage, ServerResponse } from 'node:http';

import {
  WAKE_CACHE_CONTROL,
  WAKE_JSON_HEADERS,
  WAKE_PATH,
  WAKE_READY_PATH,
} from './constants';

export type WakeReadyState = {
  ready: boolean;
  bootstrapFailed?: boolean;
};

export function requestPathname(url: string | undefined): string {
  try {
    return new URL(url ?? '/', 'http://localhost').pathname;
  } catch {
    return '/';
  }
}

export function isWakePath(
  method: string | undefined,
  pathname: string,
): 'wake' | 'ready' | false {
  if (method !== 'GET' && method !== 'HEAD') {
    return false;
  }
  if (pathname === WAKE_PATH) {
    return 'wake';
  }
  if (pathname === WAKE_READY_PATH) {
    return 'ready';
  }
  return false;
}

function writeJson(
  res: ServerResponse,
  status: number,
  body: unknown,
  extraHeaders?: Record<string, string>,
): void {
  if (res.writableEnded) {
    return;
  }
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    ...WAKE_JSON_HEADERS,
    ...extraHeaders,
  });
  res.end(payload);
}

export function respondWakeHead(res: ServerResponse): void {
  res.writeHead(200, WAKE_JSON_HEADERS);
  res.end();
}

export function respondWake(res: ServerResponse): void {
  writeJson(res, 200, { ok: true, waking: true });
}

export function respondReady(
  res: ServerResponse,
  state: WakeReadyState,
  method: string | undefined,
): void {
  if (method === 'HEAD') {
    if (state.ready) {
      res.writeHead(200, WAKE_JSON_HEADERS);
    } else {
      res.writeHead(503, {
        'Cache-Control': WAKE_CACHE_CONTROL,
        'Retry-After': '2',
      });
    }
    res.end();
    return;
  }

  if (state.bootstrapFailed) {
    writeJson(res, 503, { ready: false, error: 'bootstrap_failed' });
    return;
  }
  if (state.ready) {
    writeJson(res, 200, { ready: true });
    return;
  }
  writeJson(res, 503, { ready: false }, { 'Retry-After': '2' });
}

export function respondBootstrapping(
  res: ServerResponse,
  method: string | undefined,
): void {
  if (method === 'HEAD') {
    res.writeHead(503, {
      'Cache-Control': WAKE_CACHE_CONTROL,
      'Retry-After': '2',
    });
    res.end();
    return;
  }
  res.writeHead(503, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': WAKE_CACHE_CONTROL,
    'Retry-After': '2',
  });
  res.end('Service Unavailable');
}

export function handleEarlyRequest(
  req: IncomingMessage,
  res: ServerResponse,
  readyState: WakeReadyState,
  strapiHandler: ((...args: unknown[]) => void) | null,
): boolean {
  const pathname = requestPathname(req.url);
  const wakeKind = isWakePath(req.method, pathname);

  if (wakeKind === 'wake') {
    if (req.method === 'HEAD') {
      respondWakeHead(res);
    } else {
      respondWake(res);
    }
    return true;
  }

  if (wakeKind === 'ready') {
    respondReady(res, readyState, req.method);
    return true;
  }

  if (!strapiHandler) {
    respondBootstrapping(res, req.method);
    return true;
  }

  return false;
}
