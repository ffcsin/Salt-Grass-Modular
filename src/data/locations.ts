import type { LocationData } from './types';

// Programmatic location cluster. Add a row → a fully SEO-wired, cross-linked
// page appears at /locations/<slug>. State pages + metro pages share one shape.
//
// CONTENT RULE (generic-safe): every fact here must be TRUE everywhere it's
// stated. Climate/wind-load notes are real engineering reality. We never assert
// a specific local statute or permit number — permitting is framed as
// "varies by jurisdiction; we coordinate with your AHJ." `reach` is honest:
//   home     = Oklahoma (HQ, our home state)
//   regional = bordering / nearby states we routinely deliver homes to
//   national = anywhere — we ship modular nationwide for larger projects,
//              and serve government/military deployments worldwide.

export const SEED_LOCATIONS: LocationData[] = [
  {
    slug: 'oklahoma',
    name: 'Oklahoma',
    kind: 'state',
    stateName: 'Oklahoma',
    stateAbbr: 'OK',
    reach: 'home',
    climate: 'Tornado Alley — high wind-load engineering',
    climateDetail:
      'Oklahoma sits in the heart of Tornado Alley, so wind resistance is central to how we engineer every build. Our steel-framed modular and container structures are designed to meet local wind-load requirements.',
    cities: ['Oklahoma City', 'Tulsa', 'Norman', 'Broken Arrow', 'Lawton', 'Edmond'],
    intro:
      "Oklahoma is our home state — SaltGrass Modular fabricates in Oklahoma City, OK, and Oklahoma homeowners, developers, and agencies are who we build for first. From tornado-resistant container homes to modular pools and rapid-deployment housing, we deliver throughout the state with shorter lead times than out-of-state builders.",
    faqs: [
      { q: 'Does SaltGrass build container homes in Oklahoma?', a: 'Yes. Oklahoma is our home state — we fabricate in Oklahoma City, OK and deliver custom container homes, traditional modular builds, and modular pools statewide, including Oklahoma City, Tulsa, Norman, and rural areas.' },
      { q: 'Are modular homes tornado-resistant in Oklahoma?', a: 'Our steel-framed modular and container structures are engineered to meet local wind-load requirements. Factory construction also produces tighter, more consistent assemblies than typical on-site framing. We design to the wind exposure of your specific site.' },
      { q: 'How does permitting work for a modular home in Oklahoma?', a: 'Permitting requirements vary by city and county. We coordinate with your local authority having jurisdiction (AHJ) and handle the documentation as part of our process so you are not navigating it alone.' },
    ],
  },
  {
    slug: 'texas',
    name: 'Texas',
    kind: 'state',
    stateName: 'Texas',
    stateAbbr: 'TX',
    reach: 'regional',
    climate: 'Gulf hurricane wind zones + inland heat',
    climateDetail:
      'Texas spans Gulf-coast hurricane wind zones to dry inland heat. Coastal builds need higher wind-load engineering, while inland projects prioritize insulation and cooling efficiency — both areas where factory-built modular performs well.',
    cities: ['Houston', 'Dallas', 'San Antonio', 'Austin', 'Fort Worth', 'El Paso'],
    intro:
      "Texas is a core part of our regional delivery radius. From the Gulf Coast to the Hill Country, SaltGrass delivers custom container homes, modular pools, and rapid-deployment housing across Texas, engineering each build for its local wind and climate conditions.",
    faqs: [
      { q: 'Does SaltGrass deliver modular homes to Texas?', a: 'Yes. Texas is within our core regional delivery radius from our Oklahoma City, OK facility. We serve the major metros — Houston, Dallas–Fort Worth, San Antonio, Austin — as well as rural Texas.' },
      { q: 'Are modular homes built for hurricane wind zones in Texas?', a: 'Coastal Texas builds are engineered to the higher wind-load requirements of Gulf hurricane zones. Our steel-framed assemblies are well suited to high-wind design. We engineer to your specific site exposure.' },
      { q: 'How much does a container home cost in Texas?', a: 'SaltGrass container homes start around $75K for a 320 SF studio and scale with size and finishes, plus delivery. Texas pricing reflects delivery distance from our Oklahoma facility — request a quote for an all-in number for your location.' },
    ],
  },
  {
    slug: 'colorado',
    name: 'Colorado',
    kind: 'state',
    stateName: 'Colorado',
    stateAbbr: 'CO',
    reach: 'regional',
    climate: 'High-altitude snow load + seismic considerations',
    climateDetail:
      'Colorado builds must account for significant snow loads at altitude and mountain-region design factors. Factory engineering lets us specify the structural capacity each site requires before a module ever ships.',
    cities: ['Denver', 'Colorado Springs', 'Aurora', 'Fort Collins', 'Pueblo', 'Alamosa'],
    intro:
      "Colorado is part of our regional service area — we've delivered to Alamosa and serve the Front Range and mountain communities. SaltGrass engineers each Colorado build for altitude snow loads and mountain conditions, delivering container homes, modular builds, and pools.",
    faqs: [
      { q: 'Does SaltGrass build in Colorado?', a: 'Yes. Colorado is within our regional delivery area — we have delivered to Alamosa and serve the Denver Front Range and mountain communities with container homes, modular builds, and modular pools.' },
      { q: 'Can modular homes handle Colorado snow loads?', a: 'Yes. We engineer each build to the snow-load and structural requirements of its specific elevation and site. Factory construction lets us verify that structural capacity before delivery.' },
      { q: 'Do you deliver to mountain or rural Colorado sites?', a: 'We deliver to most accessible sites and coordinate logistics for mountain and rural locations. Site access is assessed during the quote process so there are no surprises at delivery.' },
    ],
  },
  // ----- metros (seed examples) -----
  {
    slug: 'oklahoma-city',
    name: 'Oklahoma City',
    kind: 'metro',
    stateName: 'Oklahoma',
    stateAbbr: 'OK',
    metroOf: 'oklahoma',
    reach: 'home',
    climate: 'Tornado Alley — high wind-load engineering',
    climateDetail:
      'The OKC metro is in active Tornado Alley. Wind-resistant engineering is standard on every build we deliver here, and factory assembly produces consistent, tight structures.',
    intro:
      'Oklahoma City is in our backyard. From our Oklahoma City, OK facility we deliver custom container homes, modular pools, and rapid-deployment housing throughout the OKC metro — Edmond, Norman, Moore, and Midwest City — with the shortest lead times we offer anywhere.',
    faqs: [
      { q: 'Does SaltGrass build container homes in Oklahoma City?', a: 'Yes. OKC is one of our closest markets to our Oklahoma City facility, so lead times and delivery costs are among the lowest we offer. We build container homes, modular pools, and traditional modular throughout the metro.' },
      { q: 'How fast can you deliver a modular home in OKC?', a: 'Typical timelines run 8–9 months from design to install, with fabrication running in parallel with site prep and permitting. Proximity to our facility keeps OKC delivery logistics simple.' },
    ],
  },
  {
    slug: 'tulsa',
    name: 'Tulsa',
    kind: 'metro',
    stateName: 'Oklahoma',
    stateAbbr: 'OK',
    metroOf: 'oklahoma',
    reach: 'home',
    climate: 'Tornado Alley — high wind-load engineering',
    climateDetail:
      'Tulsa sits in Tornado Alley with the same high-wind design priorities as the rest of eastern Oklahoma. Our steel-framed builds are engineered to local wind-load requirements.',
    intro:
      "Tulsa is right next door to our Oklahoma City facility — one of our closest and fastest markets. SaltGrass delivers custom container homes, modular pools, and rapid-deployment housing across the Tulsa metro, including Broken Arrow, Owasso, and Bixby.",
    faqs: [
      { q: 'Does SaltGrass serve the Tulsa area?', a: 'Yes — Tulsa is one of our nearest markets to the Oklahoma City, OK facility. We deliver container homes, modular pools, and traditional modular builds throughout the Tulsa metro with short lead times.' },
      { q: 'What does a container home cost near Tulsa?', a: 'Container homes start around $75K for a 320 SF studio and scale with size and finishes. Tulsa-area delivery costs are low given the short distance from our facility — request a quote for an all-in figure.' },
    ],
  },
  {
    slug: 'dallas',
    name: 'Dallas',
    kind: 'metro',
    stateName: 'Texas',
    stateAbbr: 'TX',
    metroOf: 'texas',
    reach: 'regional',
    climate: 'Inland heat + occasional severe storms',
    climateDetail:
      'The Dallas–Fort Worth metro sees hot summers and periodic severe storms. Modular construction delivers tight, well-insulated assemblies that perform efficiently in North Texas heat.',
    intro:
      "Dallas–Fort Worth is one of our most-requested Texas markets. SaltGrass delivers custom container homes, modular pools, and rapid-deployment housing across the DFW metroplex, engineering each build for North Texas heat and storm exposure.",
    faqs: [
      { q: 'Does SaltGrass build modular homes in Dallas?', a: 'Yes. Dallas–Fort Worth is within our core Texas delivery area. We build container homes, modular pools, and traditional modular throughout the metroplex.' },
      { q: 'How much does a modular home cost in Dallas?', a: 'Container homes start around $75K for a 320 SF studio plus delivery; larger and custom builds scale from there. DFW pricing reflects delivery distance from our Oklahoma facility — request an all-in quote for your site.' },
    ],
  },
];

// Full set is assembled at build by merging SEED with generated rows (see
// locations.generated.ts). Until generation runs, the seed alone produces pages.
import { GENERATED_LOCATIONS } from './locations.generated';

const bySlug = new Map<string, LocationData>();
for (const loc of [...SEED_LOCATIONS, ...GENERATED_LOCATIONS]) bySlug.set(loc.slug, loc);
export const LOCATIONS: LocationData[] = [...bySlug.values()];

export const STATE_LOCATIONS = LOCATIONS.filter((l) => l.kind === 'state');
export const METRO_LOCATIONS = LOCATIONS.filter((l) => l.kind === 'metro');

export function getLocation(slug: string): LocationData | undefined {
  return bySlug.get(slug);
}
export function metrosInState(stateSlug: string): LocationData[] {
  return METRO_LOCATIONS.filter((m) => m.metroOf === stateSlug);
}
