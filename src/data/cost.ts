import type { CostCity } from './types';

// Transparent pricing reference — these figures are the partner-confirmed
// SaltGrass starting prices from the design spec. Keep IDENTICAL to the
// /financing and /saltgrass-101/cost-breakdown pages and the llms corpus.
export const COST_TIERS = [
  { model: 'Studio Container Home', size: '320 SF', price: '$75,000' },
  { model: '2-Bedroom Container Home', size: '640 SF', price: '$105,000' },
  { model: '3-Bedroom Container Home', size: '960 SF', price: '$155,000' },
  { model: '3-Bedroom Container Home', size: '1,280 SF', price: '$204,800' },
  { model: '4-Bedroom Container Home', size: '1,920 SF', price: '$307,200' },
  { model: 'Tube Steel + Fiberglass Pool', size: 'varies', price: 'from $48,000' },
  { model: 'Welded Steel + Epoxy Pool', size: 'varies', price: 'from $52,000' },
] as const;

// All-in pricing always includes fabrication, delivery, and installation.
export const PRICE_INCLUDES =
  'All SaltGrass prices are all-in: fabrication, delivery, and initial systems startup. Delivery distance from our Oklahoma City, Oklahoma facility is the main location-based variable.';

import { GENERATED_COST_CITIES } from './cost.generated';

// Hand-seeded cost cities (the rest are generated for metros).
export const SEED_COST_CITIES: CostCity[] = [
  {
    slug: 'oklahoma-city',
    city: 'Oklahoma City',
    stateAbbr: 'OK',
    quickAnswer:
      'A SaltGrass container home in Oklahoma City starts at $75,000 for a 320 SF studio, $105,000 for a 1-bedroom (640 SF), and $155,000 for a 2-bedroom (960 SF) — all-in with delivery and installation. OKC is close to our facility, so delivery costs are among the lowest we offer.',
    note: 'Oklahoma City is near our Oklahoma City, OK fabrication facility, keeping delivery logistics simple and costs low.',
    faqs: [
      { q: 'How much does a container home cost in Oklahoma City?', a: 'Starting prices are $75K (320 SF studio), $105K (640 SF 1-bed), and $155K (960 SF 2-bed), all-in with delivery and installation. OKC proximity to our facility keeps delivery costs low.' },
      { q: 'What is included in the price?', a: 'Fabrication, delivery, and initial systems startup. Optional add-ons include heating, lighting, automation, decking, and landscaping.' },
    ],
  },
  {
    slug: 'dallas',
    city: 'Dallas',
    stateAbbr: 'TX',
    quickAnswer:
      'A SaltGrass container home in Dallas starts at $75,000 for a 320 SF studio, $105,000 for a 1-bedroom, and $155,000 for a 2-bedroom — all-in with delivery and installation. Dallas pricing reflects delivery distance from our Oklahoma facility.',
    note: 'Dallas–Fort Worth delivery costs reflect the distance from our Oklahoma City, OK facility; we provide an all-in quote for your exact site.',
    faqs: [
      { q: 'How much does a container home cost in Dallas?', a: 'Starting at $75K (studio), $105K (1-bed), and $155K (2-bed), all-in. DFW delivery distance from our Oklahoma facility is reflected in the final all-in quote.' },
      { q: 'Are modular pools available in Dallas?', a: 'Yes — Tube Steel + Fiberglass pools run $48K and Welded Steel + Epoxy pools $52K, including installation.' },
    ],
  },
];

const bySlug = new Map<string, CostCity>();
for (const c of [...SEED_COST_CITIES, ...GENERATED_COST_CITIES]) bySlug.set(c.slug, c);
export const COST_CITIES: CostCity[] = [...bySlug.values()];

export function getCostCity(slug: string): CostCity | undefined {
  return bySlug.get(slug);
}
