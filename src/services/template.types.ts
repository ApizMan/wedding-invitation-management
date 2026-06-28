// A "design" is a visual invitation card layout (frontend/templates/{id}/index.html).
// It is NOT a wedding — many weddings can use the same design.
export interface TemplateMeta {
  id: string;
  name: string;
  theme: string;
  preview: string;
  code: string;
  category: 'wedding' | 'aqiqah' | 'birthday' | 'corporate';
}

// `code` follows category prefix + running number (WED001, AQ001, BYD001, COR001) — shown to
// admin/customer alongside the design name so support requests can reference a stable identifier.
export const TEMPLATES_META: Record<string, TemplateMeta> = {
  template_1: { id: 'template_1', name: 'Klasik Emerald', theme: 'Hijau Hutan & Emas', preview: '/template_1', code: 'WED001', category: 'wedding' },
};

export const DEFAULT_DESIGN_ID = 'template_1';

// A "wedding" is a Firestore document in the `templates` collection holding one couple's
// data (names, schedule, family, contacts, gifts, theme colors, slug, DESIGN_ID, ...).
export type TemplateConfig = Record<string, any>;
