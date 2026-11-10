const MAX_DEPTH = 20;

function isBinaryLike(value: unknown): boolean {
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) {
    return true;
  }
  if (value == null || typeof value !== 'object') {
    return false;
  }
  const obj = value as Record<string, unknown>;
  if (
    typeof obj.pipe === 'function' &&
    typeof obj.read === 'function' &&
    typeof obj.on === 'function'
  ) {
    return true;
  }
  if (
    typeof obj.path === 'string' &&
    ('mimetype' in obj || 'size' in obj || 'name' in obj)
  ) {
    return true;
  }
  return false;
}

export function redact(value: unknown, keys: Set<string>): unknown {
  const seen = new WeakSet<object>();
  return redactDeep(value, keys, seen, 0);
}

function redactDeep(
  value: unknown,
  keys: Set<string>,
  seen: WeakSet<object>,
  depth: number,
): unknown {
  if (value == null) {
    return value;
  }
  if (isBinaryLike(value)) {
    return '[BINARY]';
  }
  if (depth >= MAX_DEPTH) {
    return '[MAX_DEPTH]';
  }
  if (typeof value !== 'object') {
    return value;
  }
  if (seen.has(value)) {
    return '[CYCLE]';
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactDeep(item, keys, seen, depth + 1));
  }

  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (keys.has(key.toLowerCase())) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = redactDeep(child, keys, seen, depth + 1);
    }
  }
  return result;
}

export function truncateJson(
  value: unknown,
  maxBytes: number,
): { value: unknown; truncated: boolean } {
  let serialized: string;
  try {
    serialized = JSON.stringify(value ?? null);
  } catch {
    return {
      value: { _truncated: true, preview: '[UNSERIALIZABLE]' },
      truncated: true,
    };
  }
  if (serialized.length <= maxBytes) {
    return { value, truncated: false };
  }
  return {
    value: {
      _truncated: true,
      preview: serialized.slice(0, maxBytes),
    },
    truncated: true,
  };
}
