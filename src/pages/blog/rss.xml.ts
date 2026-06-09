import type { APIRoute } from 'astro';
import { getBlogPosts, getAuthorName } from '../../lib/blog';

const SITE_URL = 'https://www.saltgrassmodular.com';

export const GET: APIRoute = async () => {
  const posts = await getBlogPosts();
  const items = posts
    .slice(0, 30)
    .map(
      (p) => `
    <item>
      <title><![CDATA[${p.title}]]></title>
      <link>${SITE_URL}/blog/${p.slug}</link>
      <guid isPermaLink="true">${SITE_URL}/blog/${p.slug}</guid>
      <pubDate>${new Date(p.publishedAt).toUTCString()}</pubDate>
      <author>${getAuthorName(p.author)}</author>
      ${p.category ? `<category>${p.category}</category>` : ''}
      <description><![CDATA[${p.excerpt}]]></description>
    </item>
  `,
    )
    .join('');

  const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>Saltgrass Modular Blog</title>
<link>${SITE_URL}/blog</link>
<description>Insights and guides about modular construction.</description>
<language>en-us</language>
<atom:link href="${SITE_URL}/blog/rss.xml" rel="self" type="application/rss+xml" />
${items}
</channel>
</rss>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
