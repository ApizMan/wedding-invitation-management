import { TemplateConfig } from './template.types';

export const DEFAULT_COLORS: Record<string, string> = {
  COLOR_GOLD: '#c9a84c',
  COLOR_GOLD_LIGHT: '#e8d5a3',
  COLOR_GOLD_DARK: '#8b6914',
  COLOR_FOREST: '#1a3d2b',
  COLOR_FOREST_MID: '#2d5a40',
  COLOR_CREAM: '#fdf8f0',
  COLOR_PARCHMENT: '#f5edd6',
  COLOR_TAN: '#f0e8d5',
};

export function hexToRgb(hex: string): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return '0,0,0';
  return `${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)}`;
}

export function renderThemeVars(data: TemplateConfig[string]): string {
  const colors = { ...DEFAULT_COLORS };
  for (const key of Object.keys(DEFAULT_COLORS)) {
    const val = data[key];
    if (val && /^#[0-9a-f]{6}$/i.test(String(val))) colors[key] = String(val);
  }
  return Object.entries(colors)
    .map(([key, hex]) => {
      const cssVar = '--' + key.toLowerCase().replace(/_/g, '-');
      return `      ${cssVar}: ${hex};\n      ${cssVar}-rgb: ${hexToRgb(hex)};`;
    })
    .join('\n');
}
