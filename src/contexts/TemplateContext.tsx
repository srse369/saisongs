import React, { createContext, useContext, useState, useCallback, cache } from 'react';
import type { ReactNode } from 'react';
import type { PresentationTemplate, ServiceError } from '../types';
import templateService from '../services/TemplateService';
import { useToast } from './ToastContext';
import { getCacheItem, setCacheItem, removeCacheItem } from '../utils/cacheUtils';

const TEMPLATES_CACHE_KEY = 'saiSongs:templatesCache';
const TEMPLATES_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface TemplateContextState {
  templates: PresentationTemplate[];
  loading: boolean;
  error: ServiceError | null;
  fetchTemplates: (forceRefresh?: boolean) => Promise<void>;
  getTemplateById: (id: string) => Promise<PresentationTemplate | null>;
  getDefaultTemplate: () => Promise<PresentationTemplate | null>;
  createTemplate: (template: PresentationTemplate) => Promise<PresentationTemplate | null>;
  updateTemplate: (id: string, updates: Partial<PresentationTemplate>) => Promise<PresentationTemplate | null>;
  deleteTemplate: (id: string) => Promise<boolean>;
  setAsDefault: (id: string) => Promise<PresentationTemplate | null>;
  duplicateTemplate: (id: string, name: string, centerIds: number[]) => Promise<PresentationTemplate | null>;
  validateYaml: (yamlContent: string) => Promise<{ valid: boolean; template?: Partial<PresentationTemplate>; error?: string }>;
  clearError: () => void;
  clearState: () => void;
}

const TemplateContext = createContext<TemplateContextState | undefined>(undefined);

interface TemplateProviderProps {
  children: ReactNode;
}

export const TemplateProvider: React.FC<TemplateProviderProps> = ({ children }) => {
  const [templates, setTemplates] = useState<PresentationTemplate[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<ServiceError | null>(null);
  const [hasFetched, setHasFetched] = useState<boolean>(false);
  const toast = useToast();

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearState = useCallback(() => {
    setTemplates([]);
    setError(null);
    setHasFetched(false);
  }, []);

  const fetchTemplates = useCallback(async (forceRefresh: boolean = false) => {
    // Prevent retry loops: if we've already fetched and failed, don't retry automatically
    if (!forceRefresh && hasFetched && error) {
      return;
    }

    // Reset backoff for explicit user-triggered refreshes
    if (forceRefresh && typeof window !== 'undefined') {
      const { apiClient } = await import('../services/ApiClient');
      apiClient.resetBackoff('/templates');
      setError(null);
      setHasFetched(false);
    }

    setLoading(true);
    setError(null);
    try {
      // Try to hydrate from browser cache first to speed up page load,
      // unless the caller explicitly requested a forced refresh.
      if (!forceRefresh && typeof window !== 'undefined') {
        const cachedRaw = await getCacheItem(TEMPLATES_CACHE_KEY);
        if (cachedRaw) {
          try {
            // getLocalStorageItem already decompresses automatically
            const cached = JSON.parse(cachedRaw) as {
              timestamp: number;
              templates: PresentationTemplate[];
            };
            const now = Date.now();
            if (cached.timestamp && now - cached.timestamp < TEMPLATES_CACHE_TTL_MS && Array.isArray(cached.templates)) {
              setTemplates(cached.templates);
              setLoading(false);
              setHasFetched(true);
              return;
            }
          } catch {
            // Ignore cache parse errors and fall back to network
          }
        }
      }

      // Fallback: fetch from backend
      const freshTemplates = await templateService.getAllTemplates();
      setTemplates(freshTemplates);
      setHasFetched(true);

      // Persist to cache for subsequent loads
      if (typeof window !== 'undefined') {
        const cacheData = JSON.stringify({
          timestamp: Date.now(),
          templates: freshTemplates,
        });
        const ok = await setCacheItem(TEMPLATES_CACHE_KEY, cacheData);
        if (!ok) {
          console.warn('Failed to cache templates. Templates will be fetched from server on next load.');
        }
      }
    } catch (err) {
      // Offline fallback: use cached data even if expired so app works without network
      if (typeof window !== 'undefined') {
        const cachedRaw = await getCacheItem(TEMPLATES_CACHE_KEY);
        if (cachedRaw) {
          try {
            const cached = JSON.parse(cachedRaw) as { timestamp: number; templates: PresentationTemplate[] };
            if (cached.templates && Array.isArray(cached.templates)) {
              setTemplates(cached.templates);
              setHasFetched(true);
              return;
            }
          } catch {
            // Fall through to error
          }
        }
      }
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch templates';
      setError({
        code: 'UNKNOWN_ERROR',
        message: errorMessage,
      });
      toast.error(errorMessage);
      setHasFetched(true);
    } finally {
      setLoading(false);
    }
  }, [toast, hasFetched, error]);

  const getTemplateById = useCallback(async (id: string): Promise<PresentationTemplate | null> => {
    setLoading(true);
    setError(null);
    try {
      const template = await templateService.getTemplate(id);
      return template;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch template';
      setError({
        code: 'UNKNOWN_ERROR',
        message: errorMessage,
      });
      toast.error(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const getDefaultTemplate = useCallback(async (): Promise<PresentationTemplate | null> => {
    setError(null);
    try {
      const template = await templateService.getDefaultTemplate();
      return template;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch default template';
      setError({
        code: 'UNKNOWN_ERROR',
        message: errorMessage,
      });
      return null;
    }
  }, [toast]);

  const createTemplate = useCallback(async (template: PresentationTemplate): Promise<PresentationTemplate | null> => {
    setLoading(true);
    setError(null);
    const tempId = `temp-template-${Date.now()}`;
    const optimisticTemplate: PresentationTemplate = { ...template, id: tempId };
    try {
      if (typeof window !== 'undefined') {
        setTemplates(prev => {
          const updated = [...prev, optimisticTemplate];
          setCacheItem(TEMPLATES_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), templates: updated })).catch(() => {});
          return updated;
        });
      }
      const created = await templateService.createTemplate(template);
      if (typeof window !== 'undefined') {
        setTemplates(prev => {
          const updated = prev.filter(t => t.id !== tempId);
          const merged = [...updated, created];
          setCacheItem(TEMPLATES_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), templates: merged })).catch(() => {});
          return merged;
        });
      }
      toast.success('Template created successfully');
      return created;
    } catch (err) {
      if (typeof window !== 'undefined') {
        setTemplates(prev => {
          const reverted = prev.filter(t => t.id !== tempId);
          setCacheItem(TEMPLATES_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), templates: reverted })).catch(() => {});
          return reverted;
        });
      }
      const errorMessage = err instanceof Error ? err.message : 'Failed to create template';
      setError({ code: 'UNKNOWN_ERROR', message: errorMessage });
      toast.error(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const updateTemplate = useCallback(async (id: string, updates: Partial<PresentationTemplate>): Promise<PresentationTemplate | null> => {
    setLoading(true);
    setError(null);
    const existing = templates.find(t => t.id === id);
    const optimisticTemplate = existing ? { ...existing, ...updates } : null;
    try {
      if (optimisticTemplate && typeof window !== 'undefined') {
        setTemplates(prev => {
          const updated = prev.map(t => t.id === id ? optimisticTemplate : t);
          setCacheItem(TEMPLATES_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), templates: updated })).catch(() => {});
          return updated;
        });
      }
      const updated = await templateService.updateTemplate(id, updates);
      if (updated) {
        setTemplates(prev => {
          const merged = prev.map(t => t.id === id ? updated : t);
          setCacheItem(TEMPLATES_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), templates: merged })).catch(() => {});
          return merged;
        });
        toast.success('Template updated successfully');
      } else if (existing && typeof window !== 'undefined') {
        setTemplates(prev => {
          const reverted = prev.map(t => t.id === id ? existing : t);
          setCacheItem(TEMPLATES_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), templates: reverted })).catch(() => {});
          return reverted;
        });
      }
      return updated;
    } catch (err) {
      if (existing && typeof window !== 'undefined') {
        setTemplates(prev => {
          const reverted = prev.map(t => t.id === id ? existing : t);
          setCacheItem(TEMPLATES_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), templates: reverted })).catch(() => {});
          return reverted;
        });
      }
      const errorMessage = err instanceof Error ? err.message : 'Failed to update template';
      setError({ code: 'UNKNOWN_ERROR', message: errorMessage });
      toast.error(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast, templates]);

  const deleteTemplate = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    const templateToDelete = templates.find(t => t.id === id);
    try {
      if (templateToDelete && typeof window !== 'undefined') {
        setTemplates(prev => {
          const updated = prev.filter(t => t.id !== id);
          setCacheItem(TEMPLATES_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), templates: updated })).catch(() => {});
          return updated;
        });
      }
      await templateService.deleteTemplate(id);
      toast.success('Template deleted successfully');
      return true;
    } catch (err) {
      if (templateToDelete && typeof window !== 'undefined') {
        setTemplates(prev => {
          const reverted = [...prev, templateToDelete];
          setCacheItem(TEMPLATES_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), templates: reverted })).catch(() => {});
          return reverted;
        });
      }
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete template';
      setError({
        code: 'UNKNOWN_ERROR',
        message: errorMessage,
      });
      toast.error(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const setAsDefault = useCallback(async (id: string): Promise<PresentationTemplate | null> => {
    setLoading(true);
    setError(null);
    try {
      const updated = await templateService.setAsDefault(id);
      if (updated) {
        // Update local state to reflect the new default
        setTemplates(prev => prev.map(t => ({
          ...t,
          isDefault: t.id === id
        })));
        // Clear localStorage cache so fresh data is fetched next time
        removeCacheItem(TEMPLATES_CACHE_KEY).catch(() => {});
        toast.success(`${updated.name} is now the default template`);
      }
      return updated;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to set default template';
      setError({
        code: 'UNKNOWN_ERROR',
        message: errorMessage,
      });
      toast.error(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const duplicateTemplate = useCallback(async (id: string, name: string, centerIds: number[]): Promise<PresentationTemplate | null> => {
    setLoading(true);
    setError(null);
    try {
      const duplicated = await templateService.duplicateTemplate(id, name, centerIds);
      if (duplicated) {
        // Add to local state immediately for instant UI update
        setTemplates(prev => [...prev, duplicated]);
        // Clear localStorage cache so fresh data is fetched next time
        removeCacheItem(TEMPLATES_CACHE_KEY).catch(() => {});
        toast.success(`Template duplicated as "${name}"`);
      }
      return duplicated;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to duplicate template';
      setError({
        code: 'UNKNOWN_ERROR',
        message: errorMessage,
      });
      toast.error(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const validateYaml = useCallback(async (yamlContent: string): Promise<{ valid: boolean; template?: Partial<PresentationTemplate>; error?: string }> => {
    setError(null);
    try {
      const result = await templateService.validateYaml(yamlContent);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to validate YAML';
      setError({
        code: 'UNKNOWN_ERROR',
        message: errorMessage,
      });
      toast.error(errorMessage);
      return { valid: false, error: errorMessage };
    }
  }, [toast]);

  const value: TemplateContextState = {
    templates,
    loading,
    error,
    fetchTemplates,
    getTemplateById,
    getDefaultTemplate,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    setAsDefault,
    duplicateTemplate,
    validateYaml,
    clearError,
    clearState,
  };

  return <TemplateContext.Provider value={value}>{children}</TemplateContext.Provider>;
};

export const useTemplates = (): TemplateContextState => {
  const context = useContext(TemplateContext);
  if (context === undefined) {
    throw new Error('useTemplates must be used within a TemplateProvider');
  }
  return context;
};
