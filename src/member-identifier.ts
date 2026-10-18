/**
 * Member identifier from the name: Hungarian accents kept, words joined with
 * dots, e.g. "Kovács Erika" -> "kovács.erika". Allowed characters follow the
 * member schema regex `[áéíóőúüűöüűa-z0-9\-\.]+`. Text is NFC-normalised, so a
 * decomposed "á" (as macOS sometimes pastes it) gives the same identifier.
 */
const KEPT = /[a-z0-9áéíóöőúüű]/;

export function memberIdentifierBase(name: string): string {
  let out = '';
  for (const char of name.normalize('NFC').toLocaleLowerCase('hu')) {
    if (KEPT.test(char)) {
      out += char;
      continue;
    }
    // Other accented letters (ä, ç, ł…) lose their accent; anything else separates.
    const plain = char.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    out += /^[a-z0-9]$/.test(plain) ? plain : '.';
  }
  return out.replace(/\.+/g, '.').replace(/^\.|\.$/g, '');
}

/** `base`, or `base-2`, `base-3`… if taken. */
export function uniqueMemberIdentifier(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(base)) {
    return base;
  }
  let n = 2;
  while (used.has(`${base}-${n}`)) {
    n += 1;
  }
  return `${base}-${n}`;
}
