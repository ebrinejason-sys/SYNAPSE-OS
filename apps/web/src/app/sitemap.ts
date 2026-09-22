import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://synapseos.tech'
  const paths = [
    '',
    '/pricing',
    '/book-meeting',
    '/contact',
    '/about',
    '/products/os',
    '/products/pharmacy',
    '/products/lab',
    '/legal/privacy',
    '/legal/terms',
    '/status',
    '/docs',
  ]
  return paths.map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency: path === '' || path === '/pricing' ? 'weekly' : 'monthly',
    priority: path === '' ? 1 : path === '/pricing' ? 0.9 : 0.7,
  }))
}
