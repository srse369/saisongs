import React, { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { PresentationTemplate, ServiceError } from '../types';
import templateService from '../services/TemplateService';
import { useToast } from './ToastContext';
import { safeSetLocalStorageItem, getLocalStorageItem, compressString, decompressString } from '../utils/cacheUtils';

const TEMPLATES_CACHE_KEY = 'saiSongs:templatesCache';
const TEMPLATES_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

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
        const cachedRaw = getLocalStorageItem(TEMPLATES_CACHE_KEY);
        if (cachedRaw) {
          try {
            // Decompress if needed
            const decompressed = decompressString(cachedRaw);
            const cached = JSON.parse(decompressed) as {
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

      // Persist to cache for subsequent loads (with compression for large template data)
      if (typeof window !== 'undefined') {
        const cacheData = JSON.stringify({
          timestamp: Date.now(),
          templates: freshTemplates,
        });
        
        // Compress template data to save localStorage space
        const compressedCacheData = compressString(cacheData);
        
        const success = safeSetLocalStorageItem(TEMPLATES_CACHE_KEY, compressedCacheData, {
          clearOnQuotaError: true,
          skipKeys: [TEMPLATES_CACHE_KEY], // Don't clear the template we're trying to set
        });
        
        if (!success) {
          console.warn('Failed to cache templates due to localStorage quota. Templates will be fetched from server on next load.');
        }
      }
    } catch (err) {
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
    try {
      const created = await templateService.createTemplate(template);
      // Add to local state immediately for instant UI update
      setTemplates(prev => [...prev, created]);
      // Clear localStorage cache so fresh data is fetched next time
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(TEMPLATES_CACHE_KEY);
      }
      toast.success('Template created successfully');
      return created;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create template';
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

  const updateTemplate = useCallback(async (id: string, updates: Partial<PresentationTemplate>): Promise<PresentationTemplate | null> => {
    setLoading(true);
    setError(null);
    try {
      const updated = await templateService.updateTemplate(id, updates);
      if (updated) {
        setTemplates(prev => prev.map(t => t.id === id ? updated : t));
        // Clear localStorage cache so fresh data is fetched next time
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(TEMPLATES_CACHE_KEY);
        }
        toast.success('Template updated successfully');
      }
      return updated;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update template';
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

  const deleteTemplate = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await templateService.deleteTemplate(id);
      setTemplates(prev => prev.filter(template => template.id !== id));
      // Clear localStorage cache so fresh data is fetched next time
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(TEMPLATES_CACHE_KEY);
      }
      toast.success('Template deleted successfully');
      return true;
    } catch (err) {
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
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(TEMPLATES_CACHE_KEY);
        }
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
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(TEMPLATES_CACHE_KEY);
        }
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
