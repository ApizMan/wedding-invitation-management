export type PackageTier = 'bronze' | 'platinum' | 'gold';

export type PackageFeature = 'RSVP' | 'WISHES' | 'CUSTOM_SLUG' | 'MUSIC' | 'PREWEDDING' | 'GIFT';

const PACKAGE_FEATURES: Record<PackageTier, PackageFeature[]> = {
  bronze: [],
  platinum: ['RSVP', 'WISHES', 'CUSTOM_SLUG'],
  gold: ['RSVP', 'WISHES', 'CUSTOM_SLUG', 'MUSIC', 'PREWEDDING', 'GIFT'],
};

export const PACKAGE_PRICES: Record<PackageTier, number> = {
  bronze: 30,
  platinum: 35,
  gold: 50,
};

// Fields gated behind each feature flag — stripped from save payloads when the package lacks the feature.
const FEATURE_FIELDS: Record<PackageFeature, string[]> = {
  RSVP: [],
  WISHES: [],
  CUSTOM_SLUG: ['SLUG'],
  MUSIC: ['MUSIC_ENABLED', 'MUSIC_URL', 'MUSIC_START_TIME'],
  PREWEDDING: ['PREWEDDING_ENABLED', 'PREWEDDING_DISPLAY_MODE', 'PREWEDDING_PHOTOS'],
  GIFT: ['GIFT_ENABLED', 'GIFT_QR_URL', 'GIFT_BANK_NAME', 'GIFT_BANK_ACCOUNT', 'GIFT_ACCOUNT_NAME', 'GIFT_ADDRESS', 'GIFT_ITEMS'],
};

// Docs created before the package system existed (e.g. the template_1 demo) have no PACKAGE field —
// treat them as 'gold' so existing behavior doesn't regress.
export function resolvePackage(pkg: unknown): PackageTier {
  return pkg === 'bronze' || pkg === 'platinum' || pkg === 'gold' ? pkg : 'gold';
}

export function hasFeature(pkg: PackageTier, feature: PackageFeature): boolean {
  return PACKAGE_FEATURES[pkg].includes(feature);
}

// Strips fields the given package isn't entitled to from a save payload, so a customer can't
// bypass the editor's hidden tabs by posting directly to the save endpoint.
export function sanitizeSaveByPackage(pkg: PackageTier, body: Record<string, unknown>): Record<string, unknown> {
  const blockedFields = new Set<string>();
  (Object.keys(FEATURE_FIELDS) as PackageFeature[]).forEach(feature => {
    if (!hasFeature(pkg, feature)) {
      FEATURE_FIELDS[feature].forEach(f => blockedFields.add(f));
    }
  });
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (!blockedFields.has(key)) sanitized[key] = value;
  }
  return sanitized;
}
