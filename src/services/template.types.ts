export interface TemplateMeta {
  id: string;
  name: string;
  theme: string;
  preview: string;
}

export const TEMPLATES_META: Record<string, TemplateMeta> = {
  template_1: { id: 'template_1', name: 'Klasik Emerald', theme: 'Hijau Hutan & Emas', preview: '/template_1' },
};

export type TemplateConfig = Record<string, any>;
