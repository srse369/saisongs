import React, { useState, useEffect } from 'react';
import templateService from '../../services/TemplateService';
import type { PresentationTemplate } from '../../types';

interface TemplateSelectorProps {
  onTemplateSelect?: (template: PresentationTemplate) => void;
  currentTemplateId?: string;
}

export default function TemplateSelector({ onTemplateSelect, currentTemplateId }: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<PresentationTemplate[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

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
      <div className="relative">
        <button
          onClick={() => setExpanded(!expanded)}
          className={`flex items-center gap-3 px-5 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900 shadow-lg hover:shadow-xl transition-all duration-200 font-medium ${
            isTemplateSelected 
              ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-700 hover:to-purple-700 focus:ring-purple-500'
              : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 focus:ring-amber-500 animate-pulse-gentle'
          }`}
          title={isTemplateSelected ? 'Select presentation template' : 'Pick a template for presentation'}
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
          </svg>
          <div className="flex flex-col items-start gap-0.5">
            <span className="text-xs font-bold opacity-90 tracking-wider">TEMPLATE</span>
            <span className="text-sm truncate max-w-xs">
              {isTemplateSelected ? selectedTemplate?.name : 'Select one'}
            </span>
          </div>
          <svg 
            className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ml-auto ${expanded ? 'rotate-180' : ''}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
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
                        {template.background && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                            <span>📌</span>
                            <span className="capitalize">{template.background.type}</span>
                          </span>
                        )}
                        {template.images && template.images.length > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                            <span>🖼️</span>
                            <span>{template.images.length}</span>
                          </span>
                        )}
                        {template.videos && template.videos.length > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                            <span>🎬</span>
                            <span>{template.videos.length}</span>
                          </span>
                        )}
                        {template.text && template.text.length > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                            <span>📝</span>
                            <span>{template.text.length}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    {currentTemplateId === template.id && (
                      <svg className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
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
