export function escapeHtml(str: string): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function deceasedPrefixBlock(isDeceased: boolean): string {
  return isDeceased ? '<span class="font-cormorant italic text-sm text-gold">Allahyarham</span><br/>' : '';
}

export function deceasedBadge(isDeceased: boolean): string {
  return isDeceased ? '<span class="text-xs normal-case font-lato" style="color:#c9a84c;">(Semoga Dicucuri Rahmat)</span>' : '';
}
