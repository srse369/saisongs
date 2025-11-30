import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTemplates } from '../../contexts/TemplateContext';
import type { PresentationTemplate, Slide, TemplateSlide } from '../../types';
import { RefreshIcon, Modal } from '../common';
import { SlideView } from '../presentation/SlideView';
import { TemplateWysiwygEditor } from './TemplateWysiwygEditor';
import { isMultiSlideTemplate, getSlideBackgroundStyles, SlideBackground, SlideImages, SlideVideos, SlideText } from '../../utils/templateUtils';

/**
 * Format a dimension value (x, y, width, height) as an integer string
 * Handles values like "100px", "100.5px", 100, 100.5
 */
function formatDimension(value: string | number | undefined): string {
  if (value === undefined || value === null) return '';
  const strVal = String(value);
  // Remove 'px' suffix if present and parse as float, then round
  const numVal = parseFloat(strVal.replace('px', ''));
  if (isNaN(numVal)) return strVal;
  return `${Math.round(numVal)}px`;
}

/**
 * Convert a single slide to YAML format
 */
function slideToYaml(slide: { background?: any; images?: any[]; videos?: any[]; text?: any[]; songTitleStyle?: any; songLyricsStyle?: any; songTranslationStyle?: any }, indent: string = '', isReferenceSlide: boolean = false): string[] {
  const lines: string[] = [];

  // Background
  lines.push(`${indent}background:`);
  if (slide.background) {
    lines.push(`${indent}  type: ${slide.background.type}`);
    lines.push(`${indent}  value: ${escapeYamlString(slide.background.value || '')}`);
    if (slide.background.opacity !== undefined) {
      lines.push(`${indent}  opacity: ${slide.background.opacity}`);
    }
  }

  // Images
  lines.push(`${indent}images:`);
  if (slide.images && slide.images.length > 0) {
    slide.images.forEach((img) => {
      lines.push(`${indent}  - id: ` + escapeYamlString(img.id));
      lines.push(`${indent}    url: ${escapeYamlString(img.url)}`);
      if (img.position) lines.push(`${indent}    position: ${img.position}`);
      if (img.x !== undefined) lines.push(`${indent}    x: ${escapeYamlString(formatDimension(img.x))}`);
      if (img.y !== undefined) lines.push(`${indent}    y: ${escapeYamlString(formatDimension(img.y))}`);
      if (img.width) lines.push(`${indent}    width: ${escapeYamlString(formatDimension(img.width))}`);
      if (img.height) lines.push(`${indent}    height: ${escapeYamlString(formatDimension(img.height))}`);
      if (img.opacity !== undefined) lines.push(`${indent}    opacity: ${img.opacity}`);
      if (img.zIndex !== undefined) lines.push(`${indent}    zIndex: ${img.zIndex}`);
      if (img.rotation !== undefined) lines.push(`${indent}    rotation: ${Math.round(img.rotation)}`);
    });
  } else {
    lines.push(`${indent}  []`);
  }

  // Videos
  lines.push(`${indent}videos:`);
  if (slide.videos && slide.videos.length > 0) {
    slide.videos.forEach((vid) => {
      lines.push(`${indent}  - id: ` + escapeYamlString(vid.id));
      lines.push(`${indent}    url: ${escapeYamlString(vid.url)}`);
      if (vid.position) lines.push(`${indent}    position: ${vid.position}`);
      if (vid.x !== undefined) lines.push(`${indent}    x: ${escapeYamlString(formatDimension(vid.x))}`);
      if (vid.y !== undefined) lines.push(`${indent}    y: ${escapeYamlString(formatDimension(vid.y))}`);
      if (vid.width) lines.push(`${indent}    width: ${escapeYamlString(formatDimension(vid.width))}`);
      if (vid.height) lines.push(`${indent}    height: ${escapeYamlString(formatDimension(vid.height))}`);
      if (vid.opacity !== undefined) lines.push(`${indent}    opacity: ${vid.opacity}`);
      if (vid.zIndex !== undefined) lines.push(`${indent}    zIndex: ${vid.zIndex}`);
      if (vid.autoPlay !== undefined) lines.push(`${indent}    autoPlay: ${vid.autoPlay}`);
      if (vid.loop !== undefined) lines.push(`${indent}    loop: ${vid.loop}`);
      if (vid.muted !== undefined) lines.push(`${indent}    muted: ${vid.muted}`);
      if (vid.rotation !== undefined) lines.push(`${indent}    rotation: ${Math.round(vid.rotation)}`);
    });
  } else {
    lines.push(`${indent}  []`);
  }

  // Text
  lines.push(`${indent}text:`);
  if (slide.text && slide.text.length > 0) {
    slide.text.forEach((txt) => {
      lines.push(`${indent}  - id: ` + escapeYamlString(txt.id));
      // Use special formatting for content to handle multiline text
      lines.push(...formatTextContent(txt.content, `${indent}    `));
      if (txt.position) lines.push(`${indent}    position: ${txt.position}`);
      if (txt.x !== undefined) lines.push(`${indent}    x: ${escapeYamlString(formatDimension(txt.x))}`);
      if (txt.y !== undefined) lines.push(`${indent}    y: ${escapeYamlString(formatDimension(txt.y))}`);
      if (txt.width) lines.push(`${indent}    width: ${escapeYamlString(formatDimension(txt.width))}`);
      if (txt.height) lines.push(`${indent}    height: ${escapeYamlString(formatDimension(txt.height))}`);
      if (txt.fontSize) lines.push(`${indent}    fontSize: ${escapeYamlString(formatDimension(txt.fontSize))}`);
      if (txt.color) lines.push(`${indent}    color: ${escapeYamlString(txt.color)}`);
      if (txt.fontWeight) lines.push(`${indent}    fontWeight: ${txt.fontWeight}`);
      if (txt.textAlign) lines.push(`${indent}    textAlign: ${txt.textAlign}`);
      if (txt.maxWidth) lines.push(`${indent}    maxWidth: ${escapeYamlString(formatDimension(txt.maxWidth))}`);
      if (txt.opacity !== undefined) lines.push(`${indent}    opacity: ${txt.opacity}`);
      if (txt.zIndex !== undefined) lines.push(`${indent}    zIndex: ${txt.zIndex}`);
      if (txt.rotation !== undefined) lines.push(`${indent}    rotation: ${Math.round(txt.rotation)}`);
    });
  } else {
    lines.push(`${indent}  []`);
  }

  // Song content styles (only for reference slides)
  if (isReferenceSlide) {
    if (slide.songTitleStyle) {
      lines.push(`${indent}songTitleStyle:`);
      lines.push(`${indent}  yPosition: ${slide.songTitleStyle.yPosition}`);
      lines.push(`${indent}  fontSize: ${escapeYamlString(slide.songTitleStyle.fontSize)}`);
      lines.push(`${indent}  fontWeight: ${slide.songTitleStyle.fontWeight}`);
      lines.push(`${indent}  textAlign: ${slide.songTitleStyle.textAlign}`);
      lines.push(`${indent}  color: ${escapeYamlString(slide.songTitleStyle.color)}`);
    }
    if (slide.songLyricsStyle) {
      lines.push(`${indent}songLyricsStyle:`);
      lines.push(`${indent}  yPosition: ${slide.songLyricsStyle.yPosition}`);
      lines.push(`${indent}  fontSize: ${escapeYamlString(slide.songLyricsStyle.fontSize)}`);
      lines.push(`${indent}  fontWeight: ${slide.songLyricsStyle.fontWeight}`);
      lines.push(`${indent}  textAlign: ${slide.songLyricsStyle.textAlign}`);
      lines.push(`${indent}  color: ${escapeYamlString(slide.songLyricsStyle.color)}`);
    }
    if (slide.songTranslationStyle) {
      lines.push(`${indent}songTranslationStyle:`);
      lines.push(`${indent}  yPosition: ${slide.songTranslationStyle.yPosition}`);
      lines.push(`${indent}  fontSize: ${escapeYamlString(slide.songTranslationStyle.fontSize)}`);
      lines.push(`${indent}  fontWeight: ${slide.songTranslationStyle.fontWeight}`);
      lines.push(`${indent}  textAlign: ${slide.songTranslationStyle.textAlign}`);
      lines.push(`${indent}  color: ${escapeYamlString(slide.songTranslationStyle.color)}`);
    }
  }

  return lines;
}

/**
 * Convert a PresentationTemplate object to YAML string format
 * Supports both multi-slide and legacy single-slide formats
 */
function templateToYaml(template: PresentationTemplate): string {
  const lines: string[] = [];

  // Name
  lines.push(`name: ${escapeYamlString(template.name)}`);

  // Description
  if (template.description) {
    lines.push(`description: ${escapeYamlString(template.description)}`);
  }

  // Aspect ratio (default is 16:9)
  lines.push(`aspectRatio: ${template.aspectRatio || '16:9'}`);

  // Check if template has multi-slide format
  if (template.slides && template.slides.length > 0) {
    // New multi-slide format
    lines.push(`referenceSlideIndex: ${template.referenceSlideIndex ?? 0}`);
    lines.push('slides:');
    template.slides.forEach((slide, index) => {
      const isReference = index === template.referenceSlideIndex;
      lines.push(`  - # Slide ${index + 1}${isReference ? ' (Reference)' : ''}`);
      const slideLines = slideToYaml(slide, '    ', isReference);
      lines.push(...slideLines);
    });
  } else {
    // Legacy single-slide format (fallback)
    lines.push(...slideToYaml({
      background: template.background,
      images: template.images,
      videos: template.videos,
      text: template.text,
    }, ''));
  }

  return lines.join('\n');
}

/**
 * Escape strings for YAML output
 */
function escapeYamlString(str: string): string {
  if (!str) return "''";
  // If string contains special characters (but not newlines), wrap in quotes
  if (/[:|{}[\],&*#?!@`"'%]/.test(str)) {
    return `'${str.replace(/'/g, "''")}'`;
  }
  return str;
}

/**
 * Format text content for YAML, handling multiline content with literal block scalar
 */
function formatTextContent(content: string, indent: string): string[] {
  if (!content) return [`${indent}content: ''`];
  
  // Check if content has newlines
  if (content.includes('\n')) {
    // Use YAML literal block scalar (|) for multiline content
    const lines: string[] = [`${indent}content: |`];
    content.split('\n').forEach(line => {
      lines.push(`${indent}  ${line}`);
    });
    return lines;
  }
  
  // Single line content - use regular escaping
  return [`${indent}content: ${escapeYamlString(content)}`];
}

export const TemplateManager: React.FC = () => {
  const {
    templates,
    loading,
    error,
    fetchTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    setAsDefault,
    validateYaml,
    clearError,
  } = useTemplates();

  const [showForm, setShowForm] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<PresentationTemplate | null>(null);
  const [previewSlideIndex, setPreviewSlideIndex] = useState(0);
  const [editingTemplate, setEditingTemplate] = useState<PresentationTemplate | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [yamlContent, setYamlContent] = useState('');
  const [validationError, setValidationError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [editorMode, setEditorMode] = useState<'wysiwyg' | 'yaml'>('wysiwyg');
  const [previewScale, setPreviewScale] = useState(1);
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const previewContainerRef = React.useRef<HTMLDivElement>(null);
  const fullscreenContainerRef = React.useRef<HTMLDivElement>(null);

  // Calculate preview scale when preview opens or window resizes
  useEffect(() => {
    if (!previewTemplate || !previewContainerRef.current) return;
    
    const calculateScale = () => {
      const container = previewContainerRef.current;
      if (!container) return;
      
      const aspectRatio = previewTemplate.aspectRatio || '16:9';
      const slideWidth = aspectRatio === '4:3' ? 1600 : 1920;
      const slideHeight = aspectRatio === '4:3' ? 1200 : 1080;
      
      // Get container dimensions with padding
      const containerWidth = container.clientWidth - 32; // 16px padding on each side
      const containerHeight = container.clientHeight - 32;
      
      // Skip if container isn't measured yet
      if (containerWidth <= 0 || containerHeight <= 0) return;
      
      const scaleX = containerWidth / slideWidth;
      const scaleY = containerHeight / slideHeight;
      const scale = Math.min(scaleX, scaleY, 1); // Don't scale up beyond 100%
      
      setPreviewScale(scale);
    };
    
    // Initial calculation with a small delay to ensure DOM is ready
    const timeoutId = setTimeout(calculateScale, 50);
    
    // Also use ResizeObserver for more reliable updates
    const resizeObserver = new ResizeObserver(calculateScale);
    if (previewContainerRef.current) {
      resizeObserver.observe(previewContainerRef.current);
    }
    
    window.addEventListener('resize', calculateScale);
    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', calculateScale);
    };
  }, [previewTemplate]);

  // Handle fullscreen toggle for preview
  const togglePreviewFullscreen = useCallback(() => {
    if (!fullscreenContainerRef.current) return;
    
    if (!document.fullscreenElement) {
      fullscreenContainerRef.current.requestFullscreen().catch(err => {
        console.error('Error attempting to enable fullscreen:', err);
      });
    } else {
      document.exitFullscreen();
    }
  }, []);

  // Track fullscreen state changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setPreviewFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Get slides array from preview template (for multi-slide preview)
  const previewSlides = useMemo(() => {
    if (!previewTemplate) return [];
    if (isMultiSlideTemplate(previewTemplate)) {
      return previewTemplate.slides || [];
    }
    // Legacy single-slide template - wrap in array
    return [{
      background: previewTemplate.background,
      images: previewTemplate.images || [],
      videos: previewTemplate.videos || [],
      text: previewTemplate.text || [],
    }];
  }, [previewTemplate]);

  const previewReferenceIndex = previewTemplate?.referenceSlideIndex ?? 0;

  // Load templates on mount
  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Handle escape key to close preview modal, and arrow keys to navigate slides
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!previewTemplate) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setPreviewTemplate(null);
        setPreviewSlideIndex(0);
        return;
      }

      // Handle arrow keys for slide navigation in multi-slide templates
      switch (event.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
          event.preventDefault();
          setPreviewSlideIndex(prev => Math.max(0, prev - 1));
          break;
        case 'ArrowRight':
        case 'ArrowDown':
          event.preventDefault();
          setPreviewSlideIndex(prev => Math.min(previewSlides.length - 1, prev + 1));
          break;
        case 'Home':
          event.preventDefault();
          setPreviewSlideIndex(0);
          break;
        case 'End':
          event.preventDefault();
          setPreviewSlideIndex(previewSlides.length - 1);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [previewTemplate, previewSlides.length]);

  // Filter templates based on search
  const filteredTemplates = useMemo(() => {
    if (!searchTerm.trim()) return templates;
    const query = searchTerm.toLowerCase();
    return templates.filter(
      t =>
        t.name.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query)
    );
  }, [templates, searchTerm]);

  const handleCreateClick = () => {
    setEditingTemplate({
      name: 'New Template',
      description: '',
      background: { type: 'color', value: '#ffffff' },
      images: [],
      videos: [],
      text: [],
      yaml: '',
      isDefault: false,
    });
    setYamlContent('');
    setValidationError('');
    setShowForm(true);
  };

  const handleEditClick = (template: PresentationTemplate) => {
    setEditingTemplate(template);
    setYamlContent(template.yaml || '');
    setValidationError('');
    setShowForm(true);
  };

  const handleDelete = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) {
      return;
    }
    try {
      const success = await deleteTemplate(templateId);
      if (success) {
        setSuccessMessage('Template deleted successfully');
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } catch (error) {
      console.error('Error deleting template:', error);
    }
  };

  const handleSetDefault = async (templateId: string) => {
    try {
      const updated = await setAsDefault(templateId);
      if (updated) {
        setSuccessMessage(`${updated.name} is now the default template`);
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } catch (error) {
      console.error('Error setting default template:', error);
    }
  };

  const handleFormSubmit = async () => {
    if (!editingTemplate) return;

    try {
      setValidationError('');

      // Determine the final YAML content based on editor mode
      let finalYamlContent: string;
      
      if (editorMode === 'wysiwyg') {
        // In WYSIWYG mode, always generate YAML from the current template
        finalYamlContent = templateToYaml(editingTemplate);
      } else {
        // In YAML mode, use the edited YAML content
        finalYamlContent = yamlContent;
      }

      // Validate YAML first
      const validation = await validateYaml(finalYamlContent);
      if (!validation.valid) {
        setValidationError(validation.error || 'Invalid YAML');
        return;
      }

      const templateData = {
        ...editingTemplate,
        ...validation.template,
        yaml: finalYamlContent,
      } as PresentationTemplate;

      let result;
      if (editingTemplate.id) {
        result = await updateTemplate(editingTemplate.id, templateData);
      } else {
        result = await createTemplate(templateData);
      }

      if (result) {
        setShowForm(false);
        setEditingTemplate(null);
        setYamlContent('');
        setSearchTerm(''); // Clear search to show newly created/updated template
        setSuccessMessage(
          editingTemplate.id
            ? 'Template updated successfully'
            : 'Template created successfully'
        );
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } catch (error) {
      console.error('Error saving template:', error);
      setValidationError('Failed to save template');
    }
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingTemplate(null);
    setYamlContent('');
    setValidationError('');
  };

  const handlePreview = useCallback((template: PresentationTemplate) => {
    console.log('👁️ Preview clicked - template:', template.name, 'slides:', template.slides?.length ?? 1);
    setPreviewSlideIndex(0);
    setPreviewTemplate(template);
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
      {/* Header Section */}
      <div className="mb-4 sm:mb-8">
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Presentation Templates</h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Manage presentation templates for slide shows
            </p>
          </div>

          {/* Controls */}
          <div className="flex flex-col lg:flex-row gap-3 w-full">
            <input
              type="text"
              placeholder="Search templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
              className="flex-1 px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex flex-col sm:flex-row gap-2 lg:justify-start flex-shrink-0">
              <button
                type="button"
                onClick={() => fetchTemplates(true)}
                disabled={loading}
                className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <RefreshIcon className="w-4 h-4" />
                Refresh
              </button>
              {!showForm && (
                <button
                  onClick={handleCreateClick}
                  disabled={loading}
                  className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create Template
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="mb-6 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300 px-4 py-3 rounded-md">
          {successMessage}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 px-4 py-3 rounded-md flex justify-between items-center">
          <span>{error.message}</span>
          <button
            onClick={clearError}
            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Templates List */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
            <p className="mt-4 text-gray-500 dark:text-gray-400 text-sm">Loading templates...</p>
          </div>
        ) : filteredTemplates.length > 0 ? (
          filteredTemplates.map((template) => (
            <div
              key={template.id}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                      {template.name}
                    </h3>
                    {template.isDefault && (
                      <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded">
                        ⭐ Default
                      </span>
                    )}
                  </div>
                  {template.description && (
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                      {template.description}
                    </p>
                  )}
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600 dark:text-gray-400">
                    {/* Aspect ratio indicator */}
                    <span className={`inline-flex items-center px-2 py-1 rounded ${
                      template.aspectRatio === '4:3' 
                        ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                        : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                    }`}>
                      📐 {template.aspectRatio || '16:9'}
                      </span>
                    {/* Slide count indicator */}
                    <span className="inline-flex items-center px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                      📑 {template.slides?.length || 1} slide{(template.slides?.length || 1) !== 1 ? 's' : ''} (ref: {(template.referenceSlideIndex ?? 0) + 1})
                        </span>
                    </div>
                </div>

                {/* Actions Row */}
                <div className="flex flex-wrap items-center justify-start gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => handlePreview(template)}
                    title="Preview"
                    className="p-2 text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 dark:hover:bg-purple-900/50 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleEditClick(template)}
                    className="flex items-center gap-2 p-2 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <span className="text-sm font-medium whitespace-nowrap">Edit</span>
                  </button>
                  {!template.isDefault && (
                    <button
                      onClick={() => handleSetDefault(template.id!)}
                      className="flex items-center gap-2 p-2 text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 hover:bg-yellow-100 dark:hover:bg-yellow-900/50 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      <span className="text-sm font-medium whitespace-nowrap">Set Default</span>
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(template.id!)}
                    className="flex items-center gap-2 p-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span className="text-sm font-medium whitespace-nowrap">Delete</span>
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">
              {templates.length === 0 ? 'No templates yet' : 'No templates match your search'}
            </p>
          </div>
        )}
      </div>

      {/* Template Form Modal */}
      <Modal
        isOpen={showForm}
        title={editingTemplate?.id ? 'Edit Template' : 'Create Template'}
        onClose={handleFormCancel}
        size={editorMode === 'wysiwyg' ? 'xlarge' : 'large'}
      >
        <div className="space-y-4">
          {/* Editor Mode Tabs (WYSIWYG + YAML) */}
          <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={async () => {
                // When clicking WYSIWYG button, check if we're coming FROM YAML mode
                if (editorMode === 'yaml' && yamlContent.trim()) {
                  // Sync YAML changes before switching - await to ensure template is updated first
                  const validation = await validateYaml(yamlContent);
                    if (validation.valid && validation.template && editingTemplate) {
                      setEditingTemplate({
                        ...editingTemplate,
                        ...validation.template,
                      });
                    }
                }
                setEditorMode('wysiwyg');
              }}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                editorMode === 'wysiwyg'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
              }`}
            >
              🖱️ WYSIWYG
            </button>
            <button
              onClick={() => {
                // When clicking YAML editor button, check if we're coming FROM WYSIWYG mode
                if (editorMode === 'wysiwyg' && editingTemplate) {
                  // Sync visual changes to YAML before switching
                  setYamlContent(templateToYaml(editingTemplate));
                }
                setEditorMode('yaml');
              }}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                editorMode === 'yaml'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
              }`}
            >
              ⚙️ YAML
            </button>
          </div>

          {/* WYSIWYG Editor Mode */}
          {editorMode === 'wysiwyg' && editingTemplate && (
            <>
              <TemplateWysiwygEditor
                template={editingTemplate}
                onTemplateChange={setEditingTemplate}
              />
              {validationError && (
                <div className="p-3 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 rounded text-sm">
                  {validationError}
                </div>
              )}
            </>
          )}

          {/* YAML Editor Mode */}
          {editorMode === 'yaml' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                  YAML Configuration
                </label>
                <textarea
                  value={yamlContent}
                  onChange={(e) => {
                    const newYaml = e.target.value;
                    setYamlContent(newYaml);
                    setValidationError('');
                    
                    // Auto-sync YAML changes back to template in real-time
                    if (newYaml.trim()) {
                      validateYaml(newYaml).then(validation => {
                        if (validation.valid && validation.template && editingTemplate) {
                          setEditingTemplate({
                            ...editingTemplate,
                            ...validation.template,
                          });
                        }
                      });
                    }
                  }}
                  rows={15}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md font-mono text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="name: My Template&#10;description: Template description&#10;background:&#10;  type: color&#10;  value: '#ffffff'&#10;images: []&#10;videos: []&#10;text: []"
                />
              </div>

              {validationError && (
                <div className="p-3 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 rounded text-sm">
                  {validationError}
                </div>
              )}
            </>
          )}

          {/* Template Properties - Always visible */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                  Template Name
                </label>
                <input
                  type="text"
                  value={editingTemplate?.name || ''}
                  onChange={(e) =>
                    setEditingTemplate(
                      editingTemplate
                        ? { ...editingTemplate, name: e.target.value }
                        : null
                    )
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Template name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={editingTemplate?.description || ''}
                  onChange={(e) =>
                    setEditingTemplate(
                      editingTemplate
                        ? { ...editingTemplate, description: e.target.value }
                        : null
                    )
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Template description"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                Aspect Ratio
                </label>
              <select
                value={editingTemplate?.aspectRatio || '16:9'}
                onChange={(e) =>
                  setEditingTemplate(
                    editingTemplate
                      ? { ...editingTemplate, aspectRatio: e.target.value as '16:9' | '4:3' }
                      : null
                  )
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="16:9">16:9 (1920×1080)</option>
                <option value="4:3">4:3 (1600×1200)</option>
              </select>
              </div>
                </div>

          <div className="flex gap-2 justify-end pt-4">
            <button
              onClick={handleFormCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleFormSubmit}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {editingTemplate?.id ? 'Update Template' : 'Create Template'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Full Page Template Preview Modal */}
      {previewTemplate && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center p-2">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl w-full h-full max-w-full max-h-screen flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
              <div className="flex items-center gap-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white truncate">
                  Template Preview: {previewTemplate.name}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {previewSlides.length > 1 
                      ? `Slide ${previewSlideIndex + 1} of ${previewSlides.length} • Use arrow keys to navigate • Press Esc to close`
                      : 'Press Esc to close'}
                </p>
              </div>
                {/* Aspect ratio and dimensions info */}
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded ${
                    previewTemplate.aspectRatio === '4:3'
                      ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                      : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                  }`}>
                    📐 {previewTemplate.aspectRatio || '16:9'}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                    {previewTemplate.aspectRatio === '4:3' ? '1600×1200' : '1920×1080'} → {Math.round((previewTemplate.aspectRatio === '4:3' ? 1600 : 1920) * previewScale)}×{Math.round((previewTemplate.aspectRatio === '4:3' ? 1200 : 1080) * previewScale)}px
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                {/* Fullscreen toggle button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                    togglePreviewFullscreen();
                  }}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                  aria-label={previewFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                  title={previewFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                >
                  {previewFullscreen ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                  )}
                </button>
                {/* Close button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (previewFullscreen) {
                      document.exitFullscreen();
                    }
                  setPreviewTemplate(null);
                    setPreviewSlideIndex(0);
                }}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl leading-none"
                aria-label="Close preview"
              >
                ✕
              </button>
              </div>
            </div>

            {/* Preview Content - Shows current slide scaled to fit */}
            <div 
              ref={(el) => {
                (previewContainerRef as any).current = el;
                (fullscreenContainerRef as any).current = el;
              }}
              className="flex-1 overflow-hidden relative flex items-center justify-center bg-gray-900 p-4"
            >
              {/* Wrapper that has the final scaled dimensions */}
              <div 
                className="relative"
                style={{
                  width: Math.round((previewTemplate.aspectRatio === '4:3' ? 1600 : 1920) * previewScale),
                  height: Math.round((previewTemplate.aspectRatio === '4:3' ? 1200 : 1080) * previewScale),
                }}
              >
                {/* Scaled slide container - uses transform for crisp scaling */}
                <div 
                  className="absolute top-0 left-0 shadow-2xl"
                  style={{
                    width: previewTemplate.aspectRatio === '4:3' ? 1600 : 1920,
                    height: previewTemplate.aspectRatio === '4:3' ? 1200 : 1080,
                    transform: `scale(${previewScale})`,
                    transformOrigin: 'top left',
                  }}
            >
                {/* Render based on whether it's a static slide or reference slide */}
                {previewSlideIndex === previewReferenceIndex ? (
                  /* Reference slide - show with sample song content */
              <SlideView 
                slide={{
                  songName: 'Sample Devotional Song',
                  content: 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6',
                  translation: 'Translation Line 1\nTranslation Line 2\nTranslation Line 3',
                  singerName: 'Sample Singer',
                  pitch: 'C',
                  nextSongName: 'Next Song',
                  nextSingerName: 'Next Singer',
                  nextPitch: 'D',
                  nextIsContinuation: false,
                  songSlideNumber: 1,
                  songSlideCount: 5,
                      index: previewSlideIndex,
                } as Slide}
                showTranslation={true}
                template={previewTemplate}
              />
                ) : (
                  /* Static slide - show template content only */
                  <div 
                    className="presentation-slide relative overflow-hidden"
                    style={{
                      ...getSlideBackgroundStyles(previewSlides[previewSlideIndex]),
                      width: '100%',
                      height: '100%',
                    }}
                  >
                    <SlideBackground templateSlide={previewSlides[previewSlideIndex]} />
                    <SlideImages templateSlide={previewSlides[previewSlideIndex]} />
                    <SlideVideos templateSlide={previewSlides[previewSlideIndex]} />
                    <SlideText templateSlide={previewSlides[previewSlideIndex]} />
            </div>
                )}
                
                {/* Reference Slide Indicator Overlay */}
                {previewSlideIndex === previewReferenceIndex && previewSlides.length > 1 && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="bg-yellow-500/90 text-black px-6 py-3 rounded-lg text-2xl font-bold shadow-xl transform rotate-[-5deg] border-4 border-yellow-600">
                      🎯 Reference Slide
                    </div>
                  </div>
                )}

                {/* Static Slide Indicator */}
                {previewSlideIndex !== previewReferenceIndex && previewSlides.length > 1 && (
                  <div className="absolute top-4 left-1/2 transform -translate-x-1/2 pointer-events-none">
                    <div className="bg-gray-700/80 text-white px-4 py-2 rounded-lg text-sm font-medium">
                      {previewSlideIndex < previewReferenceIndex ? 'Intro Slide' : 'Outro Slide'} (Static)
                      </div>
                      </div>
                    )}
                      </div>
              </div>
            </div>
            
            {/* Slide Navigation (always shown) */}
            <div className="flex items-center justify-center gap-2 p-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
              <button
                onClick={() => setPreviewSlideIndex(prev => Math.max(0, prev - 1))}
                disabled={previewSlideIndex === 0}
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              {/* Slide dots/indicators */}
              <div className="flex gap-2 mx-4">
                {previewSlides.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setPreviewSlideIndex(idx)}
                    className={`w-3 h-3 rounded-full transition-colors ${
                      idx === previewSlideIndex
                        ? 'bg-blue-500'
                        : idx === previewReferenceIndex
                          ? 'bg-yellow-400 hover:bg-yellow-500'
                          : 'bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'
                    }`}
                    title={idx === previewReferenceIndex ? `Slide ${idx + 1} (Reference)` : `Slide ${idx + 1}`}
                  />
                ))}
              </div>
              
              <button
                onClick={() => setPreviewSlideIndex(prev => Math.min(previewSlides.length - 1, prev + 1))}
                disabled={previewSlideIndex === previewSlides.length - 1}
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              
              <span className="ml-4 text-sm text-gray-600 dark:text-gray-400">
                Slide {previewSlideIndex + 1} / {previewSlides.length}
                {previewSlideIndex === previewReferenceIndex && (
                  <span className="ml-2 text-yellow-500 font-medium">⭐ Reference</span>
                    )}
              </span>
                  </div>

            {/* Footer with Details - Description only */}
            <div className="bg-white dark:bg-gray-800 p-3 border-t border-gray-200 dark:border-gray-700 overflow-y-auto max-h-32 flex-shrink-0">
              <div className="grid grid-cols-1 gap-2 text-sm">
                {/* Description */}
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1 text-xs">Description</h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                    {previewTemplate.description || '(No description)'}
                  </p>
                </div>
              </div>
            </div>

            {/* Footer with Close Button */}
            <div className="flex gap-2 justify-end p-2 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPreviewTemplate(null);
                }}
                className="px-4 py-1 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
