/** A full line that is a markdown HTML comment, including the excel import block. */
const COMMENT_LINE = /^\s*<!--.*-->\s*$/;

export function hasDescriptionComment(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return value.split(/\r?\n/).some((line) => COMMENT_LINE.test(line));
}

/**
 * Description text for display. Full-line HTML comments stay in the stored
 * value and in the finalize textarea; markdown renderers omit them, and so
 * does every backoffice surface except that input.
 */
export function visibleDescription(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .split(/\r?\n/)
    .filter((line) => !COMMENT_LINE.test(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
