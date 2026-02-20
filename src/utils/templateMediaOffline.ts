/**
 * Template media offline utility.
 * Downloads image, video, and audio resources from templates and caches them
 * in IndexedDB for offline use. Similar to how PowerPoint import stores media locally.
 * Uses backend proxy when direct fetch fails due to CORS.
 */

import type { PresentationTemplate, TemplateSlide } from '../types';
import { getCacheItem, setCacheItem, CACHE_KEYS } from './cacheUtils';
import { API_BASE_URL } from '../services/ApiClient';

function getProxyUrl(targetUrl: string): string {
  const base = API_BASE_URL.replace(/\/$/, '');
  return `${base}/offline/proxy-media?url=${encodeURIComponent(targetUrl)}`;
}

function getTemplateMediaCacheKey(templateId: string): string {
  return `${CACHE_KEYS.TEMPLATE_MEDIA_PREFIX}${templateId}`;
}

/** URLs we cannot download (YouTube, data URLs, blob URLs) */
function isDownloadableUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const u = url.trim();
  if (u.startsWith('data:')) return false;
  if (u.startsWith('blob:')) return false;
  if (/youtube\.com|youtu\.be/i.test(u)) return false;
  return true;
}

/** Convert relative or protocol-relative URL to absolute for fetch */
function toAbsoluteUrl(url: string): string {
  if (typeof window === 'undefined') return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('//')) return `${window.location.protocol}${url}`;
  if (url.startsWith('/')) return `${window.location.origin}${url}`;
  return url;
}

/** Collect all media URLs from a template (images, videos, audios, backgrounds) */
export function collectTemplateMediaUrls(template: PresentationTemplate): string[] {
  const urls = new Set<string>();

  function addUrl(url: string) {
    if (isDownloadableUrl(url)) urls.add(url);
  }

  function processSlide(slide: TemplateSlide | undefined) {
    if (!slide) return;
    for (const img of slide.images ?? []) addUrl(img.url);
    for (const vid of slide.videos ?? []) addUrl(vid.url);
    for (const aud of slide.audios ?? []) addUrl(aud.url);
    const bg = slide.background;
    if (bg?.type === 'image' || bg?.type === 'video') addUrl(bg.value);
  }

  // Multi-slide format
  for (const slide of template.slides ?? []) processSlide(slide);

  // Legacy single-slide format
  processSlide({
    images: template.images,
    videos: template.videos,
    audios: template.audios,
    background: template.background,
  } as TemplateSlide);

  // Background audio
  if (template.backgroundAudio?.url) addUrl(template.backgroundAudio.url);

  return Array.from(urls);
}

export interface TemplateMediaDownloadProgress {
  current: number;
  total: number;
  message: string;
  url?: string;
}

/**
 * Download all media from a template and cache as data URLs in IndexedDB.
 * Images are prioritized; audio and video are downloaded when possible.
 */
export async function downloadTemplateMediaForOffline(
  templateId: string,
  template: PresentationTemplate,
  onProgress?: (p: TemplateMediaDownloadProgress) => void
): Promise<{ success: boolean; imagesCached: number; videosCached: number; audiosCached: number; failed: number }> {
  const urls = collectTemplateMediaUrls(template);
  const urlToDataUrl: Record<string, string> = {};
  let imagesCached = 0;
  let videosCached = 0;
  let audiosCached = 0;
  let failed = 0;

  if (urls.length === 0) {
    onProgress?.({ current: 1, total: 1, message: 'No media to download' });
    await setCacheItem(getTemplateMediaCacheKey(templateId), JSON.stringify({ urlToDataUrl }));
    return { success: true, imagesCached: 0, videosCached: 0, audiosCached: 0, failed: 0 };
  }

  const total = urls.length;
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const absUrl = toAbsoluteUrl(url);
    onProgress?.({ current: i + 1, total, message: `Downloading ${i + 1}/${total}...`, url });

    try {
      let blob: Blob;
      try {
        const res = await fetch(absUrl, { mode: 'cors', credentials: 'omit' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        blob = await res.blob();
      } catch (directErr) {
        // CORS or network error - try backend proxy (requires auth)
        const proxyUrl = getProxyUrl(absUrl);
        const proxyRes = await fetch(proxyUrl, { credentials: 'include' });
        if (!proxyRes.ok) {
          const errBody = await proxyRes.text();
          throw new Error(`Proxy ${proxyRes.status}: ${errBody || proxyRes.statusText}`);
        }
        blob = await proxyRes.blob();
      }
      const mime = blob.type || (url.match(/\.(jpg|jpeg|png|gif|webp)/i) ? 'image/jpeg' : 'video/mp4');
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      urlToDataUrl[url] = dataUrl;
      if (mime.startsWith('image/')) imagesCached++;
      else if (mime.startsWith('video/')) videosCached++;
      else if (mime.startsWith('audio/')) audiosCached++;
    } catch (err) {
      console.warn(`Failed to cache template media: ${url}`, err);
      failed++;
    }
  }

  const cacheKey = getTemplateMediaCacheKey(templateId);
  await setCacheItem(cacheKey, JSON.stringify({ urlToDataUrl }));

  onProgress?.({ current: total, total, message: 'Done!' });

  return {
    success: failed < urls.length,
    imagesCached,
    videosCached,
    audiosCached,
    failed,
  };
}

/**
 * Check if a template has its media cached for offline use.
 */
export async function isTemplateMediaCached(templateId: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const raw = await getCacheItem(getTemplateMediaCacheKey(templateId));
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as { urlToDataUrl?: Record<string, string> };
    const map = parsed?.urlToDataUrl;
    return map != null && typeof map === 'object' && Object.keys(map).length > 0;
  } catch {
    return false;
  }
}

function resolveUrl(url: string, urlToDataUrl: Record<string, string>): string {
  return urlToDataUrl[url] ?? url;
}

function resolveSlide(slide: TemplateSlide | undefined, urlToDataUrl: Record<string, string>): TemplateSlide | undefined {
  if (!slide) return slide;
  const images = slide.images?.map((img) => ({ ...img, url: resolveUrl(img.url, urlToDataUrl) }));
  const videos = slide.videos?.map((vid) => ({ ...vid, url: resolveUrl(vid.url, urlToDataUrl) }));
  const audios = slide.audios?.map((aud) => ({ ...aud, url: resolveUrl(aud.url, urlToDataUrl) }));
  let background = slide.background;
  if (background?.type === 'image' || background?.type === 'video') {
    background = { ...background, value: resolveUrl(background.value, urlToDataUrl) };
  }
  return { ...slide, images, videos, audios, background };
}

/**
 * Return a template with media URLs replaced by cached data URLs where available.
 * Use when offline to render templates with locally stored media.
 */
export async function resolveTemplateMediaUrls(
  template: PresentationTemplate,
  templateId?: string
): Promise<PresentationTemplate> {
  const id = templateId ?? template.id;
  if (!id || typeof window === 'undefined') return template;

  const raw = await getCacheItem(getTemplateMediaCacheKey(id));
  if (!raw) return template;

  try {
    const parsed = JSON.parse(raw) as { urlToDataUrl?: Record<string, string> };
    const urlToDataUrl = parsed?.urlToDataUrl;
    if (!urlToDataUrl || Object.keys(urlToDataUrl).length === 0) return template;

    const slides = template.slides?.map((s) => resolveSlide(s, urlToDataUrl));
    const backgroundAudio = template.backgroundAudio
      ? { ...template.backgroundAudio, url: resolveUrl(template.backgroundAudio.url, urlToDataUrl) }
      : template.backgroundAudio;

    // Legacy single-slide
    const legacySlide = {
      images: template.images,
      videos: template.videos,
      audios: template.audios,
      background: template.background,
    } as TemplateSlide;
    const resolvedLegacy = resolveSlide(legacySlide, urlToDataUrl);

    return {
      ...template,
      slides: slides ?? template.slides,
      backgroundAudio,
      images: resolvedLegacy?.images ?? template.images,
      videos: resolvedLegacy?.videos ?? template.videos,
      audios: resolvedLegacy?.audios ?? template.audios,
      background: resolvedLegacy?.background ?? template.background,
    };
  } catch {
    return template;
  }
}
