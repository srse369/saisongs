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
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const template = await load();
      if (template) return template;
    } catch (e) {
      if (attempt >= maxRetries) throw e;
    }
    if (attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, 2000));
      apiClient.resetBackoff();
    }
  }
  return null;
}
