import { db } from '../database/firebase';
import { TemplateConfig, TEMPLATES_META } from './template.types';

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/;

export const RESERVED_SLUGS = new Set(['admin', 'api', 'assets', 'w', ...Object.keys(TEMPLATES_META)]);

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug) && !RESERVED_SLUGS.has(slug);
}

export async function findTemplateBySlug(slug: string): Promise<{ id: string; data: TemplateConfig[string] } | null> {
  const snapshot = await db.collection('templates').where('SLUG', '==', slug).limit(1).get();
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { id: doc.id, data: doc.data() };
}
