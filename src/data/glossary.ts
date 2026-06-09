import type { GlossaryTerm } from './types';

// Modular-construction glossary → DefinedTermSet schema (AEO: AI engines cite
// definitional content). Definitions must be accurate + vendor-neutral.
import { GENERATED_GLOSSARY } from './glossary.generated';

export const SEED_GLOSSARY: GlossaryTerm[] = [
  {
    slug: 'modular-construction',
    term: 'Modular Construction',
    short: 'Building method where sections (modules) are fabricated in a factory, then delivered and assembled on-site.',
    long: 'Modular construction builds a home or structure as finished sections in a controlled factory, then transports and joins them on a permanent foundation at the site. Because factory work runs in parallel with site preparation, projects finish faster than traditional construction while meeting the same local building codes.',
    related: ['container-home', 'prefab', 'adu'],
  },
  {
    slug: 'container-home',
    term: 'Container Home',
    short: 'A home built using the steel frame of shipping containers as the primary structure.',
    long: 'A container home uses the durable steel structure of shipping containers as its frame, then adds insulation, finishes, windows, doors, and systems. The steel frame is strong and wind-resistant, making container homes well-suited to high-wind regions when properly engineered.',
    related: ['modular-construction', 'adu', 'tiny-home'],
  },
  {
    slug: 'adu',
    term: 'ADU (Accessory Dwelling Unit)',
    short: 'A secondary, self-contained living unit on the same lot as a primary home.',
    long: 'An Accessory Dwelling Unit is an independent living space — with its own kitchen, bath, and entrance — on the same property as a main house. ADUs are popular for rental income, multigenerational living, and home offices. Modular and container construction is a fast, cost-effective way to add one.',
    related: ['container-home', 'modular-construction'],
  },
  {
    slug: 'prefab',
    term: 'Prefab (Prefabricated)',
    short: 'An umbrella term for any structure with components manufactured off-site before assembly.',
    long: 'Prefab, short for prefabricated, covers any building approach where parts are made in a factory and assembled on-site — including modular, panelized, and container construction. The shared benefit is the quality control and speed of factory production.',
    related: ['modular-construction', 'container-home'],
  },
  {
    slug: 'ahj',
    term: 'AHJ (Authority Having Jurisdiction)',
    short: 'The local government office that enforces building codes and issues permits for your site.',
    long: 'The Authority Having Jurisdiction is the city, county, or state office responsible for code enforcement, plan review, and permitting where you build. Because requirements vary by AHJ, modular builders coordinate directly with the local office on each project.',
    related: ['modular-construction', 'wind-load'],
  },
  {
    slug: 'wind-load',
    term: 'Wind Load',
    short: 'The force wind exerts on a structure, which engineering must resist for safety.',
    long: 'Wind load is the pressure that wind places on a building. Areas like Tornado Alley and hurricane coasts require higher wind-load resistance. Steel-framed modular and container structures are engineered to the wind exposure of each specific site.',
    related: ['container-home', 'ahj'],
  },
];

const bySlug = new Map<string, GlossaryTerm>();
for (const t of [...SEED_GLOSSARY, ...GENERATED_GLOSSARY]) bySlug.set(t.slug, t);
export const GLOSSARY: GlossaryTerm[] = [...bySlug.values()].sort((a, b) => a.term.localeCompare(b.term));
