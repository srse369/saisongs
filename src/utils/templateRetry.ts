import apiClient from '../services/ApiClient';
import type { PresentationTemplate } from '../types';

/**
 * Retry template fetch after transient 500s.
 * Resets ApiClient backoff and waits between attempts so the server can recover.
 */
export async function loadTemplateWithRetry(
  load: () => Promise<PresentationTemplate | null>,
  maxRetries = 2
): Promise<PresentationTemplate | null> {
  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
  const retries = isOffline ? 0 : maxRetries; // No retries when offline - cache is the only source

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const template = await load();
      if (template) return template;
    } catch (e) {
      if (attempt >= retries) throw e;
    }
    if (attempt < retries) {
      await new Promise((r) => setTimeout(r, 2000));
      apiClient.resetBackoff();
    }
  }
  return null;
}
