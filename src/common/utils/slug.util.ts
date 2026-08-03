import { randomBytes } from 'crypto';

/**
 * Generates a URL-friendly slug from a string.
 * Appends a short random suffix to guarantee uniqueness.
 */
export function generateSlug(text: string, addSuffix = true): string {
  const base = text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!addSuffix) return base;

  const suffix = randomBytes(3).toString('hex'); // 6 chars
  return `${base}-${suffix}`;
}
