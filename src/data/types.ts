// Shared shapes for the programmatic content clusters.

export interface FaqPair {
  q: string;
  a: string;
}

/** A US state or metro served. `kind` drives URL + template framing. */
export interface LocationData {
  slug: string; // url segment, e.g. 'texas' or 'oklahoma-city'
  name: string; // 'Texas' | 'Oklahoma City'
  kind: 'state' | 'metro';
  stateName: string; // full state name (for metros too)
  stateAbbr: string; // 'TX'
  // TRUE, differentiating facts — climate/engineering reality, never fabricated statutes
  climate: string; // e.g. 'Tornado Alley — high wind-load engineering'
  climateDetail: string; // 1-2 sentence true climate/engineering note
  cities?: string[]; // notable cities (for state pages)
  metroOf?: string; // state slug a metro belongs to
  // SaltGrass's honest relationship to this geography
  reach: 'home' | 'regional' | 'national'; // OK=home, neighbors=regional, far=national
  intro: string; // 1-paragraph location-specific intro (generic-safe)
  faqs: FaqPair[];
}

export interface CostCity {
  slug: string;
  city: string;
  stateAbbr: string;
  quickAnswer: string; // AEO voice-target lead sentence with the price range
  note?: string; // local cost-context note (generic-safe)
  faqs: FaqPair[];
}

export interface Comparison {
  slug: string; // 'container-homes-vs-traditional'
  title: string; // 'Container Homes vs. Traditional Construction'
  metaTitle: string;
  description: string;
  intro: string;
  optionA: string; // 'Container Homes'
  optionB: string; // 'Traditional Construction'
  rows: { dimension: string; a: string; b: string }[];
  verdict: string; // honest "which to pick when"
  faqs: FaqPair[];
  related?: string[]; // slugs of related comparisons
}

export interface GlossaryTerm {
  slug: string;
  term: string;
  short: string; // one-line definition (for DefinedTerm + cards)
  long: string; // 2-4 sentence explanation
  related?: string[]; // slugs
}
