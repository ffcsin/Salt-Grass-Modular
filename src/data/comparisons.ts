import type { Comparison } from './types';

// "X vs Y" comparison cluster — one buyer-research question per page. Each has a
// side-by-side table + honest verdict + FAQ. Facts must be true and balanced
// (don't strawman the alternative — Google + buyers see through it).
import { GENERATED_COMPARISONS } from './comparisons.generated';

export const SEED_COMPARISONS: Comparison[] = [
  {
    slug: 'container-homes-vs-traditional',
    title: 'Container Homes vs. Traditional Construction',
    metaTitle: 'Container Homes vs. Traditional Construction: Cost, Speed & Quality',
    description:
      'A balanced comparison of container homes and traditional stick-built construction — cost, timeline, durability, and when each makes sense.',
    intro:
      'Container homes and traditional stick-built construction both produce great homes — the right choice depends on your budget, timeline, and design goals. Here is an honest side-by-side.',
    optionA: 'Container Homes',
    optionB: 'Traditional Construction',
    rows: [
      { dimension: 'Typical timeline', a: '8–9 months (factory + site in parallel)', b: '12–18 months on average' },
      { dimension: 'Cost', a: 'Typically lower; transparent all-in pricing', b: 'Higher; change orders common' },
      { dimension: 'Structure', a: 'Steel frame — strong, wind-resistant', b: 'Wood frame (typical)' },
      { dimension: 'Quality control', a: 'Factory-inspected at 50/80/100%', b: 'Varies by site + weather' },
      { dimension: 'Design flexibility', a: 'High within module dimensions', b: 'Highest — fully bespoke' },
      { dimension: 'Best for', a: 'Speed, budget, durability, ADUs', b: 'Large, fully-custom footprints' },
    ],
    verdict:
      'Choose a container home when speed, transparent pricing, and durability matter — especially for studios, 1–2 bedroom homes, ADUs, and rental units. Choose traditional construction when you need a large, fully-bespoke footprint and timeline is flexible. SaltGrass builds both, so the recommendation is based on your project, not what we happen to sell.',
    faqs: [
      { q: 'Are container homes cheaper than traditional homes?', a: 'Generally yes — factory efficiency and reduced material waste typically make them more affordable than comparable traditional construction, with transparent all-in pricing and no surprise change orders.' },
      { q: 'Are container homes as durable as traditional homes?', a: 'Steel-framed container structures are highly durable and wind-resistant. Factory construction produces consistent, tight assemblies. With proper insulation and finishing, they are built to last decades.' },
      { q: 'Which is faster to build?', a: 'Container/modular is typically faster — 8–9 months versus 12–18 for traditional — because factory fabrication runs in parallel with site prep and permitting.' },
    ],
    related: ['modular-vs-manufactured', 'container-home-vs-adu'],
  },
  {
    slug: 'modular-vs-manufactured',
    title: 'Modular Homes vs. Manufactured (Mobile) Homes',
    metaTitle: 'Modular vs. Manufactured Homes: Key Differences Explained',
    description:
      'Modular and manufactured homes are often confused. Here is the real difference in building codes, permanence, financing, and value.',
    intro:
      'People often use "modular" and "manufactured" interchangeably, but they are different products built to different codes. The distinction affects financing, permanence, and resale value.',
    optionA: 'Modular Homes',
    optionB: 'Manufactured Homes',
    rows: [
      { dimension: 'Building code', a: 'Local/state code (IRC/IBC), same as site-built', b: 'Federal HUD code' },
      { dimension: 'Foundation', a: 'Permanent foundation', b: 'Often on a steel chassis / can be moved' },
      { dimension: 'Appraisal', a: 'Appraised like site-built real property', b: 'Can depreciate like a vehicle' },
      { dimension: 'Financing', a: 'Standard mortgages / construction loans', b: 'Often chattel loans, higher rates' },
      { dimension: 'Customization', a: 'High — custom designs', b: 'Limited to model options' },
    ],
    verdict:
      'Modular homes are built to the same local codes as site-built homes, sit on permanent foundations, and are appraised and financed as real property — which is why they hold value better. SaltGrass builds custom modular and container structures, not HUD-code manufactured homes.',
    faqs: [
      { q: 'Is a modular home the same as a mobile home?', a: 'No. Modular homes are built to the same state/local building codes as site-built homes and placed on permanent foundations. Manufactured (mobile) homes are built to the federal HUD code and can sit on a movable chassis.' },
      { q: 'Do modular homes hold their value?', a: 'Yes — because they are built to local code on permanent foundations, modular homes are appraised as real property and generally appreciate like site-built homes, unlike many manufactured homes.' },
    ],
    related: ['container-homes-vs-traditional', 'container-home-vs-adu'],
  },
];

const bySlug = new Map<string, Comparison>();
for (const c of [...SEED_COMPARISONS, ...GENERATED_COMPARISONS]) bySlug.set(c.slug, c);
export const COMPARISONS: Comparison[] = [...bySlug.values()];

export function getComparison(slug: string): Comparison | undefined {
  return bySlug.get(slug);
}
