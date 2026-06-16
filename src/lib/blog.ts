const API_BASE =
  import.meta.env.PUBLIC_API_URL ||
  'https://lpai-monorepo-production.up.railway.app';
const LOCATION_ID = import.meta.env.PUBLIC_LOCATION_ID;

export interface BlogPost {
  _id: string;
  slug: string;
  title: string;
  excerpt: string;
  content?: string;
  coverImage?: string;
  author?: { name: string; avatar?: string } | string;
  category?: string;
  section?: string;
  tags?: string[];
  published: boolean;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
  heroStyle?: string;
  ctaType?: string;
  viewCount?: number;
  seo?: {
    metaTitle?: string;
    metaDescription?: string;
    keywords?: string[] | string;
    ogImage?: string;
    noIndex?: boolean;
    canonicalUrl?: string;
  };
}

export interface BlogCategory {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  color?: string;
  postCount?: number;
}

export interface CtaData {
  slug?: string;
  heading: string;
  description: string;
  buttonText: string;
  href: string;
  gradient?: string;
}

export interface BlogChrome {
  headerHtml?: string;
  footerHtml?: string;
  customCss?: string;
}

export async function getBlogPosts(): Promise<BlogPost[]> {
  try {
    const res = await fetch(
      `${API_BASE}/api/blog/posts?locationId=${LOCATION_ID}&status=published&limit=100`,
    );
    const json = await res.json();
    return (json.success && json.data?.posts) || (Array.isArray(json.data) ? json.data : []);
  } catch {
    return [];
  }
}

export async function getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  try {
    const res = await fetch(
      `${API_BASE}/api/blog/posts/${encodeURIComponent(slug)}?locationId=${LOCATION_ID}`,
    );
    const json = await res.json();
    return (json.success && json.data) || null;
  } catch {
    return null;
  }
}

export async function getBlogCategories(): Promise<BlogCategory[]> {
  try {
    const res = await fetch(`${API_BASE}/api/blog/categories?locationId=${LOCATION_ID}`);
    const json = await res.json();
    return (json.success && json.data) || (Array.isArray(json.data) ? json.data : []);
  } catch {
    return [];
  }
}

export async function getRelatedPosts(
  category: string | undefined,
  excludeSlug: string,
): Promise<BlogPost[]> {
  if (!category) return [];
  try {
    const params = new URLSearchParams({
      locationId: LOCATION_ID,
      category,
      status: 'published',
      limit: '4',
    });
    const res = await fetch(`${API_BASE}/api/blog/posts?${params}`);
    const json = await res.json();
    const posts: BlogPost[] = json.data?.posts || (Array.isArray(json.data) ? json.data : []);
    return posts.filter((p) => p.slug !== excludeSlug).slice(0, 3);
  } catch {
    return [];
  }
}

export async function getCtaForPost(
  ctaType?: string,
  postSlug?: string,
): Promise<CtaData | null> {
  try {
    const res = await fetch(`${API_BASE}/api/blog/ctas?locationId=${LOCATION_ID}`);
    const json = await res.json();
    if (!json.success) return null;
    const all: CtaData[] = json.data || [];
    if (!all.length) return null;
    if (ctaType && ctaType !== 'none') {
      const match = all.find((c) => c.slug === ctaType);
      if (match) return match;
    }
    const hash = (postSlug || '')
      .split('')
      .reduce((a, ch) => a + ch.charCodeAt(0), 0);
    return all[hash % all.length];
  } catch {
    return null;
  }
}

export async function getAllCtas(): Promise<CtaData[]> {
  try {
    const res = await fetch(`${API_BASE}/api/blog/ctas?locationId=${LOCATION_ID}`);
    const json = await res.json();
    return json.success ? json.data || [] : [];
  } catch {
    return [];
  }
}

export async function getBlogChrome(): Promise<BlogChrome | null> {
  try {
    const res = await fetch(`${API_BASE}/api/blog/settings/${LOCATION_ID}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.data?.chrome || null;
  } catch {
    return null;
  }
}

export function getAuthorName(author: BlogPost['author']): string {
  if (!author) return 'SaltGrass Team';
  if (typeof author === 'string') return author;
  return author.name || 'SaltGrass Team';
}

export function getAuthorAvatar(author: BlogPost['author']): string | undefined {
  if (!author || typeof author === 'string') return undefined;
  return author.avatar;
}

export function estimateReadTime(content?: string, excerpt?: string): number {
  if (content) {
    const words = content
      .replace(/<[^>]*>/g, '')
      .split(/\s+/)
      .filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 200));
  }
  if (excerpt) {
    const excerptWords = excerpt
      .replace(/<[^>]*>/g, '')
      .split(/\s+/)
      .filter(Boolean).length;
    return Math.max(3, Math.round((excerptWords * 50) / 200));
  }
  return 5;
}
