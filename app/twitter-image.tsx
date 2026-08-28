import { renderShareCard, shareCardAlt, shareCardContentType, shareCardSize } from '@/lib/shareCard';

export const runtime = 'nodejs';
export const alt = shareCardAlt;
export const size = shareCardSize;
export const contentType = shareCardContentType;

export default function TwitterImage() {
  return renderShareCard();
}
