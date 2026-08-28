import type { MetadataRoute } from 'next';
import { getSiteOrigin } from '@/lib/url';

/** 방은 개인 공간이라 색인하지 않는다. 공개 진입점만 올린다. */
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = getSiteOrigin();
  return [{ url: origin, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 }];
}
