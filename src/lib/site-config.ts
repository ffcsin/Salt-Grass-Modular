// Central business identity — every page + schema + llms file reads from here (DRY).
// Change a fact once, it propagates everywhere.

export const SITE = {
  brand: 'SaltGrass Modular',
  legalName: 'SaltGrass Modular, LLC',
  // Live host (hyphenated Vercel project). At domain cutover → https://saltgrassmodular.com
  url: import.meta.env.SITE || 'https://salt-grass-modular.vercel.app',
  domain: 'saltgrassmodular.com',
  tagline: 'Custom Container Homes, Modular Pools & Rapid-Deployment Housing',
  description:
    'Custom modular construction company specializing in container homes, modular pools, traditional builds, and rapid-deployment housing for homeowners, developers, and government.',
  founder: 'Dylan Walker',
  phone: '405-659-1949',
  phoneE164: '+14056591949',
  email: 'Dylan.Walker@saltgrassmodular.com',
  // NAP
  address: {
    locality: 'Oklahoma City',
    region: 'OK',
    regionName: 'Oklahoma',
    postalCode: '73102',
    country: 'US',
  },
  geo: { lat: 35.4676, lng: -97.5164 },
  hours: 'Mo-Fr 08:00-17:00',
  priceRange: '$$',
  ogImage: '/img/og-saltgrass-logo.jpg',
  logo: '/logo.png',
  sameAs: [] as string[], // social profiles — add when provided
  // Facility / capacity facts (true, partner-confirmed in spec)
  facility: 'Oklahoma City, Oklahoma (40,000+ sq ft fabrication facility)',
  defaultKeywords: [
    'modular construction',
    'container homes',
    'modular pools',
    'prefab homes',
    'ADU',
    'rapid deployment housing',
    'modular homes Oklahoma',
  ],
} as const;

export const SERVICES = [
  { slug: 'container-homes', name: 'Custom Container Homes', short: 'Container Homes' },
  { slug: 'traditional-builds', name: 'Traditional Modular Builds', short: 'Traditional Builds' },
  { slug: 'pools', name: 'Modular Pools', short: 'Modular Pools' },
  { slug: 'disaster-relief', name: 'Disaster Relief & Rapid Deployment', short: 'Disaster Relief' },
  { slug: 'developers', name: 'Developers & Military Solutions', short: 'Developers & Military' },
] as const;

export const HEARTH_PREQUAL =
  'https://app.gethearth.com/financing/47456/82921/prequalify?utm_campaign=47456&utm_content=general&utm_medium=custom-lp&utm_source=contractor&utm_term=82921';
