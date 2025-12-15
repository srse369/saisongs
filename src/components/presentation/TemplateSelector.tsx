import React, { useState, useEffect, useRef, useCallback } from 'react';
import templateService from '../../services/TemplateService';
import type { PresentationTemplate } from '../../types';

interface TemplateSelectorProps {
  onTemplateSelect?: (template: PresentationTemplate) => void;
  currentTemplateId?: string;
  onExpandedChange?: (expanded: boolean) => void;
}

export default function TemplateSelector({ onTemplateSelect, currentTemplateId, onExpandedChange }: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<PresentationTemplate[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Notify parent when expanded state changes
  useEffect(() => {
    onExpandedChange?.(expanded);
  }, [expanded, onExpandedChange]);

  // Add pulse animation style
  const pulseStyle = `
    @keyframes pulse-gentle {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }
    .animate-pulse-gentle {
      animation: pulse-gentle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }
  `;

  useEffect(() => {
    loadTemplates();
  }, []);

  // Handle escape key to close dropdown
  useEffect(() => {
    if (!expanded) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setExpanded(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [expanded]);

  // Handle click outside to close dropdown
  useEffect(() => {
    if (!expanded) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setExpanded(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [expanded]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const data = await templateService.getAllTemplates();
      setTemplates(data);
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (template: PresentationTemplate) => {
    if (onTemplateSelect) {
      onTemplateSelect(template);
    }
    setExpanded(false);
  };

  const selectedTemplate = templates.find(t => t.id === currentTemplateId);
  const isTemplateSelected = !!selectedTemplate;

  return (
    <>
      <style>{pulseStyle}</style>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setExpanded(!expanded)}
          className={`flex items-center gap-3 px-5 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900 shadow-lg hover:shadow-xl transition-all duration-200 font-medium ${
            isTemplateSelected 
              ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-700 hover:to-purple-700 focus:ring-purple-500'
              : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 focus:ring-amber-500 animate-pulse-gentle'
          }`}
          title={isTemplateSelected ? 'Select presentation template' : 'Pick a template for presentation'}
        >
          <i className="fas fa-layer-group text-lg"></i>
          <div className="flex flex-col items-start gap-0.5">
            <span className="text-xs font-bold opacity-90 tracking-wider">TEMPLATE</span>
            <span className="text-sm truncate max-w-xs">
              {isTemplateSelected ? selectedTemplate?.name : 'Select one'}
            </span>
          </div>
          <i className={`fas fa-chevron-down text-base flex-shrink-0 transition-transform duration-200 ml-auto ${expanded ? 'rotate-180' : ''}`}></i>
        </button>

      {expanded && (
        <div className="absolute top-full left-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 min-w-max max-h-96 overflow-y-auto">
          {loading ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
              <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600 mb-2"></div>
              <p>Loading templates...</p>
            </div>
          ) : templates.length === 0 ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
              No templates available
            </div>
          ) : (
            <div className="py-1">
              {templates.map((template, index) => (
                <button
                  key={template.id}
                  onClick={() => handleSelect(template)}
                  className={`w-full text-left px-4 py-3 transition-colors ${
                    currentTemplateId === template.id 
                      ? 'bg-purple-50 dark:bg-purple-900/30 border-l-4 border-purple-600' 
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 border-l-4 border-transparent'
                  } ${index !== templates.length - 1 ? 'border-b border-gray-100 dark:border-gray-700/50' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900 dark:text-white truncate">{template.name}</h3>
                        {template.isDefault && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200 whitespace-nowrap">
                            ⭐ Default
                          </span>
                        )}
                      </div>
                      {template.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 truncate">{template.description}</p>
                      )}
                      <div className="flex flex-wrap gap-2 mt-2">
                        {/* Aspect ratio indicator */}
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                          template.aspectRatio === '4:3' 
                            ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                            : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                        }`}>
                          <span>📐</span>
                          <span>{template.aspectRatio || '16:9'}</span>
                        </span>
                        {/* Slide count indicator */}
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                          <span>📑</span>
                          <span>{template.slides?.length || 1} slide{(template.slides?.length || 1) !== 1 ? 's' : ''} (ref: {(template.referenceSlideIndex ?? 0) + 1})</span>
                        </span>
                      </div>
                    </div>
                    {currentTemplateId === template.id && (
                      <i className="fas fa-check text-lg text-purple-600 flex-shrink-0 mt-0.5"></i>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      </div>
    </>
  );
}
