// JSON-LD builders — the AEO backbone. Each returns a plain object that a page
// passes to BaseLayout's `schemas` prop; BaseLayout renders each as a
// <script type="application/ld+json">. Keeps schema generation DRY + testable.
import { SITE } from './site-config';

const postalAddress = () => ({
  '@type': 'PostalAddress',
  streetAddress: SITE.address.locality,
  addressLocality: SITE.address.locality,
  addressRegion: SITE.address.region,
  postalCode: SITE.address.postalCode,
  addressCountry: SITE.address.country,
});

/** Site-wide LocalBusiness — NAP, geo, areaServed, services, hours. */
export function localBusinessSchema(areaServed?: string[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'GeneralContractor',
    '@id': `${SITE.url}/#business`,
    name: SITE.brand,
    description: SITE.description,
    url: SITE.url,
    telephone: SITE.phoneE164,
    email: SITE.email,
    image: `${SITE.url}${SITE.ogImage}`,
    logo: `${SITE.url}${SITE.logo}`,
    priceRange: SITE.priceRange,
    address: postalAddress(),
    geo: { '@type': 'GeoCoordinates', latitude: SITE.geo.lat, longitude: SITE.geo.lng },
    areaServed: (areaServed && areaServed.length
      ? areaServed
      : ['United States']
    ).map((name) => ({ '@type': 'AdministrativeArea', name })),
    serviceType: [
      'Container Home Construction',
      'Modular Pool Installation',
      'Modular Construction',
      'Disaster Relief Housing',
      'Government & Military Modular Housing',
    ],
    founder: { '@type': 'Person', name: SITE.founder },
    sameAs: SITE.sameAs,
    openingHoursSpecification: {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      opens: '08:00',
      closes: '17:00',
    },
  };
}

/** Organization with contactPoint. */
export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE.url}/#organization`,
    name: SITE.brand,
    legalName: SITE.legalName,
    url: SITE.url,
    logo: `${SITE.url}${SITE.logo}`,
    description: SITE.description,
    founder: { '@type': 'Person', name: SITE.founder },
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: SITE.phoneE164,
      email: SITE.email,
      contactType: 'sales',
      areaServed: 'US',
      availableLanguage: 'English',
    },
    sameAs: SITE.sameAs,
  };
}

/** WebSite + SearchAction (sitelinks search box eligibility). */
export function webSiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE.url}/#website`,
    url: SITE.url,
    name: SITE.brand,
    description: SITE.description,
    publisher: { '@id': `${SITE.url}/#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${SITE.url}/blog?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };
}

/** FAQPage from [{q,a}] pairs. */
export function faqSchema(faqs: { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

/** Service schema for service/location pages. */
export function serviceSchema(opts: {
  name: string;
  description: string;
  areaServed?: string;
  url: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: opts.name,
    description: opts.description,
    serviceType: opts.name,
    provider: { '@id': `${SITE.url}/#business` },
    areaServed: opts.areaServed
      ? { '@type': 'AdministrativeArea', name: opts.areaServed }
      : { '@type': 'Country', name: 'United States' },
    url: opts.url,
  };
}

/** BreadcrumbList from [{name,url}] (url relative or absolute). */
export function breadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.url.startsWith('http') ? it.url : `${SITE.url}${it.url}`,
    })),
  };
}

/** DefinedTermSet for the glossary. */
export function definedTermSetSchema(terms: { term: string; def: string; slug: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'DefinedTermSet',
    '@id': `${SITE.url}/glossary#termset`,
    name: 'Modular Construction Glossary',
    hasDefinedTerm: terms.map((t) => ({
      '@type': 'DefinedTerm',
      '@id': `${SITE.url}/glossary#${t.slug}`,
      name: t.term,
      description: t.def,
      inDefinedTermSet: `${SITE.url}/glossary#termset`,
    })),
  };
}

/** HowTo for the process page. */
export function howToSchema(opts: { name: string; description: string; steps: { name: string; text: string }[] }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: opts.name,
    description: opts.description,
    step: opts.steps.map((s, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: s.name,
      text: s.text,
    })),
  };
}
