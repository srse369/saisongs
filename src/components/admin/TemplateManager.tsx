import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTemplates } from '../../contexts/TemplateContext';
import { useAuth } from '../../contexts/AuthContext';
import type { PresentationTemplate, Slide, TemplateSlide, AspectRatio } from '../../types';
import { ensureSongContentStyles } from '../../types';
import { RefreshIcon, Modal, CenterMultiSelect, CenterBadges, Tooltip } from '../common';
import { PresentationModal } from '../presentation/PresentationModal';
import { TemplateWysiwygEditor } from './TemplateWysiwygEditor';
import { MediaExportModal } from './MediaExportModal';
import { isMultiSlideTemplate } from '../../utils/templateUtils';
import { pptxImportService } from '../../services/PptxImportService';
import type { CloudStorageConfig } from '../../services/CloudStorageService';

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
 * @param slide The slide to convert
 * @param indent Indentation prefix
 * @param isReferenceSlide Whether this is the reference slide
 * @param slideIndex 0-based index of this slide (used for audio defaults)
 */
function slideToYaml(slide: { background?: any; images?: any[]; videos?: any[]; audios?: any[]; text?: any[]; songTitleStyle?: any; songLyricsStyle?: any; songTranslationStyle?: any; bottomLeftTextStyle?: any; bottomRightTextStyle?: any }, indent: string = '', isReferenceSlide: boolean = false, slideIndex: number = 0): string[] {
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
      if (vid.hideVideo !== undefined) lines.push(`${indent}    hideVideo: ${vid.hideVideo}`);
      if (vid.hideAudio !== undefined) lines.push(`${indent}    hideAudio: ${vid.hideAudio}`);
      if (vid.rotation !== undefined) lines.push(`${indent}    rotation: ${Math.round(vid.rotation)}`);
    });
  } else {
    lines.push(`${indent}  []`);
  }

  // Audios - always output key properties with defaults to ensure persistence
  lines.push(`${indent}audios:`);
  if (slide.audios && slide.audios.length > 0) {
    const defaultSlideNum = slideIndex + 1; // 1-based slide number
    slide.audios.forEach((aud) => {
      lines.push(`${indent}  - id: ` + escapeYamlString(aud.id));
      lines.push(`${indent}    url: ${escapeYamlString(aud.url)}`);
      if (aud.position) lines.push(`${indent}    position: ${aud.position}`);
      if (aud.x !== undefined) lines.push(`${indent}    x: ${escapeYamlString(formatDimension(aud.x))}`);
      if (aud.y !== undefined) lines.push(`${indent}    y: ${escapeYamlString(formatDimension(aud.y))}`);
      if (aud.width) lines.push(`${indent}    width: ${escapeYamlString(formatDimension(aud.width))}`);
      if (aud.height) lines.push(`${indent}    height: ${escapeYamlString(formatDimension(aud.height))}`);
      // Always output these with defaults
      lines.push(`${indent}    opacity: ${aud.opacity ?? 1}`);
      lines.push(`${indent}    zIndex: ${aud.zIndex ?? 1}`);
      lines.push(`${indent}    autoPlay: ${aud.autoPlay ?? true}`);
      lines.push(`${indent}    loop: ${aud.loop ?? false}`);
      lines.push(`${indent}    volume: ${aud.volume ?? 1}`);
      lines.push(`${indent}    visualHidden: ${aud.visualHidden ?? false}`);
      // Always output slide range with defaults based on the slide where audio is defined
      lines.push(`${indent}    startSlide: ${aud.startSlide ?? defaultSlideNum}`);
      lines.push(`${indent}    endSlide: ${aud.endSlide ?? defaultSlideNum}`);
      if (aud.playAcrossAllSlides !== undefined) lines.push(`${indent}    playAcrossAllSlides: ${aud.playAcrossAllSlides}`);
      if (aud.rotation !== undefined) lines.push(`${indent}    rotation: ${Math.round(aud.rotation)}`);
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
      if (txt.fontFamily) lines.push(`${indent}    fontFamily: ${escapeYamlString(txt.fontFamily)}`);
      if (txt.fontWeight) lines.push(`${indent}    fontWeight: ${txt.fontWeight}`);
      if (txt.fontStyle) lines.push(`${indent}    fontStyle: ${txt.fontStyle}`);
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
    const outputSongStyle = (styleName: string, style: any) => {
      if (!style) return;
      lines.push(`${indent}${styleName}:`);
      lines.push(`${indent}  x: ${style.x}`);
      lines.push(`${indent}  y: ${style.y}`);
      lines.push(`${indent}  width: ${style.width}`);
      if (style.height) lines.push(`${indent}  height: ${style.height}`);
      lines.push(`${indent}  fontSize: ${escapeYamlString(style.fontSize)}`);
      lines.push(`${indent}  fontWeight: ${style.fontWeight}`);
      if (style.fontStyle) lines.push(`${indent}  fontStyle: ${style.fontStyle}`);
      if (style.fontFamily) lines.push(`${indent}  fontFamily: ${escapeYamlString(style.fontFamily)}`);
      lines.push(`${indent}  textAlign: ${style.textAlign}`);
      lines.push(`${indent}  color: ${escapeYamlString(style.color)}`);
      // Legacy yPosition for backward compatibility
      if (style.yPosition !== undefined) lines.push(`${indent}  yPosition: ${style.yPosition}`);
    };
    
    outputSongStyle('songTitleStyle', slide.songTitleStyle);
    outputSongStyle('songLyricsStyle', slide.songLyricsStyle);
    outputSongStyle('songTranslationStyle', slide.songTranslationStyle);
    outputSongStyle('bottomLeftTextStyle', slide.bottomLeftTextStyle);
    outputSongStyle('bottomRightTextStyle', slide.bottomRightTextStyle);
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
      const slideLines = slideToYaml(slide, '    ', isReference, index);
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
  const { isAdmin, isEditor, editorFor } = useAuth();
  const {
    templates,
    loading,
    error,
    fetchTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    setAsDefault,
    duplicateTemplate,
    validateYaml,
    clearError,
  } = useTemplates();

  // Check if user can edit a template
  const canEditTemplate = useCallback((template: PresentationTemplate) => {
    if (isAdmin) return true;
    const templateCenterIds = template.center_ids || [];
    // Templates with no centers can only be edited by admins
    if (templateCenterIds.length === 0) return false;
    const userEditorFor = editorFor || [];
    return templateCenterIds.some(cid => userEditorFor.includes(cid));
  }, [isAdmin, editorFor]);

  const [showForm, setShowForm] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<PresentationTemplate | null>(null);
  const [previewSlideIndex, setPreviewSlideIndex] = useState(0);
  const [editingTemplate, setEditingTemplate] = useState<PresentationTemplate | null>(null);
  const [originalTemplate, setOriginalTemplate] = useState<PresentationTemplate | null>(null); // Track original state for dirty detection
  const [duplicatingTemplate, setDuplicatingTemplate] = useState<PresentationTemplate | null>(null);
  const [centerIds, setCenterIds] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [yamlContent, setYamlContent] = useState('');
  const [validationError, setValidationError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [editorSelectedSlideIndex, setEditorSelectedSlideIndex] = useState(0);
  const [editorMode, setEditorMode] = useState<'wysiwyg' | 'yaml'>('wysiwyg');
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const [importingPptx, setImportingPptx] = useState(false);
  const [importProgress, setImportProgress] = useState('');
  const [showMediaExportModal, setShowMediaExportModal] = useState(false);
  const [pendingPptxFile, setPendingPptxFile] = useState<File | null>(null);
  const pptxInputRef = useRef<HTMLInputElement>(null);
  
  // Check if template has unsaved changes
  const hasUnsavedChanges = React.useMemo(() => {
    if (!editingTemplate) return false;
    if (!originalTemplate) return true; // New template always has "changes"
    
    // Compare key fields to detect changes
    const current = JSON.stringify({
      name: editingTemplate.name,
      description: editingTemplate.description,
      aspectRatio: editingTemplate.aspectRatio,
      slides: editingTemplate.slides,
      referenceSlideIndex: editingTemplate.referenceSlideIndex,
      isDefault: editingTemplate.isDefault,
    });
    const original = JSON.stringify({
      name: originalTemplate.name,
      description: originalTemplate.description,
      aspectRatio: originalTemplate.aspectRatio,
      slides: originalTemplate.slides,
      referenceSlideIndex: originalTemplate.referenceSlideIndex,
      isDefault: originalTemplate.isDefault,
    });
    return current !== original;
  }, [editingTemplate, originalTemplate]);

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
        
        // Check if any dropdowns/selects are open (focused)
        const activeElement = document.activeElement as HTMLElement;
        if (activeElement && (activeElement.tagName === 'SELECT' || activeElement.classList.contains('dropdown-open'))) {
          // Blur the dropdown to close it
          activeElement.blur();
          return;
        }
        
        // If in fullscreen, exit fullscreen first
        if (previewFullscreen || document.fullscreenElement) {
          if (document.fullscreenElement) {
            document.exitFullscreen();
          }
          setPreviewFullscreen(false);
          return;
        }
        
        // Finally, close the preview
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
    // Create a new slide with default song content styles
    const defaultSlide = ensureSongContentStyles(
      {
        background: { type: 'color' as const, value: '#1a1a2e' },
        images: [],
        videos: [],
        text: [],
      },
      '16:9'
    );
    
    const newTemplate: PresentationTemplate = {
      name: 'New Template',
      description: '',
      aspectRatio: '16:9',
      slides: [defaultSlide],
      referenceSlideIndex: 0,
      // Legacy fields for compatibility
      background: defaultSlide.background,
      images: [],
      videos: [],
      text: [],
      yaml: '',
      isDefault: false,
    };
    setEditingTemplate(newTemplate);
    setOriginalTemplate(null); // New template has no original
    setCenterIds([]); // Reset center IDs
    setYamlContent('');
    setValidationError('');
    setShowForm(true);
  };

  const handleImportPptx = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.pptx')) {
      setValidationError('Please select a valid PowerPoint file (.pptx)');
      return;
    }

    // Store the file and show media export configuration modal
    setPendingPptxFile(file);
    setShowMediaExportModal(true);
  };

  const handleMediaExportConfirm = async (cloudConfig: CloudStorageConfig | undefined) => {
    setShowMediaExportModal(false);
    
    if (!pendingPptxFile) return;

    const file = pendingPptxFile;
    setPendingPptxFile(null);

    setImportingPptx(true);
    setImportProgress('Reading PowerPoint file...');

    try {
      // Extract template name from filename
      const templateName = file.name.replace('.pptx', '');
      
      // Import the PowerPoint file with optional cloud storage configuration
      const importedTemplate = await pptxImportService.importPptxFile(
        file, 
        templateName,
        cloudConfig,
        (current, total, message) => {
          setImportProgress(message);
        }
      );
      
      // Set it as the editing template
      setEditingTemplate(importedTemplate);
      setOriginalTemplate(null); // Imported template has no original
      setCenterIds([]);
      setYamlContent('');
      setValidationError('');
      setShowForm(true);
      
      const skipUpload = (cloudConfig as any)?.skipUpload;
      const mediaMessage = skipUpload
        ? 'Media files reused from previous upload'
        : cloudConfig 
        ? `Media files uploaded to ${cloudConfig.provider}` 
        : 'Media embedded as data URLs';
      setSuccessMessage(`Successfully imported ${importedTemplate.slides?.length || 0} slides from PowerPoint! ${mediaMessage}`);
      setImportProgress('');
      
      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (error) {
      console.error('Error importing PowerPoint:', error);
      setValidationError(`Failed to import PowerPoint: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setImportProgress('');
    } finally {
      setImportingPptx(false);
      // Reset the file input so the same file can be selected again
      if (pptxInputRef.current) {
        pptxInputRef.current.value = '';
      }
    }
  };

  const handleEditClick = (template: PresentationTemplate) => {
    // Deep clone the template to preserve original state
    const clonedTemplate = JSON.parse(JSON.stringify(template));
    
    // Ensure reference slide has song content styles with defaults
    let templateWithDefaults = { ...template };
    const aspectRatio: AspectRatio = template.aspectRatio || '16:9';
    const referenceIndex = template.referenceSlideIndex ?? 0;
    
    if (templateWithDefaults.slides && templateWithDefaults.slides.length > 0) {
      const updatedSlides = [...templateWithDefaults.slides];
      updatedSlides[referenceIndex] = ensureSongContentStyles(
        updatedSlides[referenceIndex],
        aspectRatio
      );
      templateWithDefaults = {
        ...templateWithDefaults,
        slides: updatedSlides,
      };
    }
    
    setEditingTemplate(templateWithDefaults);
    setOriginalTemplate(clonedTemplate);
    setCenterIds(template.center_ids || []); // Load existing center IDs
    setYamlContent(template.yaml || '');
    setValidationError('');
    setShowForm(true);
  };

  const handleDuplicateClick = (template: PresentationTemplate) => {
    // Generate timestamp-based name
    const now = new Date();
    const timestamp = now.toLocaleString('en-US', { 
      month: '2-digit', 
      day: '2-digit', 
      year: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      hour12: false 
    }).replace(/,/g, '');
    const newName = `${template.name} (${timestamp})`;
    
    // Set center assignment based on user role
    // Admin: no centers (global template)
    // Editor: all centers user is editor for
    const newCenterIds = isAdmin ? [] : (editorFor || []);
    
    setDuplicatingTemplate({ ...template, name: newName });
    setCenterIds(newCenterIds);
  };

  const handleDuplicateConfirm = async () => {
    if (!duplicatingTemplate) return;

    try {
      const result = await duplicateTemplate(
        duplicatingTemplate.id!,
        duplicatingTemplate.name,
        centerIds
      );
      
      if (result) {
        setDuplicatingTemplate(null);
        setSuccessMessage(`Template duplicated as "${duplicatingTemplate.name}"`);
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } catch (error) {
      console.error('Error duplicating template:', error);
    }
  };

  const handleDuplicateCancel = () => {
    setDuplicatingTemplate(null);
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

      // Ensure reference slide has song content styles with defaults
      const aspectRatio: AspectRatio = editingTemplate.aspectRatio || '16:9';
      const referenceIndex = editingTemplate.referenceSlideIndex ?? 0;
      
      // Apply defaults to reference slide if song content styles are missing
      let templateWithDefaults = { ...editingTemplate };
      if (templateWithDefaults.slides && templateWithDefaults.slides.length > 0) {
        const updatedSlides = [...templateWithDefaults.slides];
        updatedSlides[referenceIndex] = ensureSongContentStyles(
          updatedSlides[referenceIndex],
          aspectRatio
        );
        templateWithDefaults = {
          ...templateWithDefaults,
          slides: updatedSlides,
        };
      }

      // Determine the final YAML content based on editor mode
      let finalYamlContent: string;
      
      if (editorMode === 'wysiwyg') {
        // In WYSIWYG mode, always generate YAML from the current template (with defaults applied)
        finalYamlContent = templateToYaml(templateWithDefaults);
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
        ...templateWithDefaults,
        ...validation.template,
        yaml: finalYamlContent,
        center_ids: centerIds, // Include center assignment
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
        setOriginalTemplate(null);
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
    if (hasUnsavedChanges) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to close without saving?'
      );
      if (!confirmed) {
        return;
      }
    }
    setShowForm(false);
    setEditingTemplate(null);
    setOriginalTemplate(null);
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
              <Tooltip content="Reload templates from the database">
                <button
                  type="button"
                  onClick={() => fetchTemplates(true)}
                  disabled={loading}
                  className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <RefreshIcon className="w-4 h-4" />
                  Refresh
                </button>
              </Tooltip>
              {!showForm && (
                <>
                  <Tooltip content="Create a new presentation template with custom slides and styling">
                    <button
                      onClick={handleCreateClick}
                      disabled={loading}
                      className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                    >
                      <i className="fas fa-plus text-lg"></i>
                      Create Template
                    </button>
                  </Tooltip>
                  
                  {/* Import PowerPoint Button */}
                  <Tooltip content="Import slides from a PowerPoint file (.pptx) to create a new template">
                    <button
                      onClick={() => pptxInputRef.current?.click()}
                      disabled={loading || importingPptx}
                      className="w-full px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                    >
                      <i className="fas fa-upload text-lg"></i>
                      {importingPptx ? 'Importing...' : 'Import PowerPoint'}
                    </button>
                  </Tooltip>
                  
                  {/* Hidden file input for PowerPoint import */}
                  <input
                    ref={pptxInputRef}
                    type="file"
                    accept=".pptx"
                    onChange={handleImportPptx}
                    className="hidden"
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Import Progress Message */}
      {importProgress && (
        <div className="mb-6 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 px-4 py-3 rounded-md flex items-center gap-3">
          <i className="fas fa-spinner fa-spin text-lg text-blue-600 dark:text-blue-400"></i>
          <span>{importProgress}</span>
        </div>
      )}

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
                    {/* Center badges - show actual centers for all users */}
                    <CenterBadges centerIds={template.center_ids || []} />
                    </div>
                </div>

                {/* Actions Row */}
                <div className="flex flex-wrap items-center justify-start gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <Tooltip content="Preview this template with sample content">
                    <button
                      onClick={() => handlePreview(template)}
                      className="p-2 text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 dark:hover:bg-purple-900/50 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors"
                    >
                      <i className="fas fa-eye text-lg"></i>
                    </button>
                  </Tooltip>
                  {canEditTemplate(template) && (
                    <Tooltip content="Edit template layout, styling, and slide configuration">
                      <button
                        onClick={() => handleEditClick(template)}
                        className="flex items-center gap-2 p-2 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                      >
                        <i className="fas fa-edit text-lg"></i>
                        <span className="text-sm font-medium whitespace-nowrap">Edit</span>
                      </button>
                    </Tooltip>
                  )}
                  {isEditor && (
                    <Tooltip content="Create a copy of this template that you can modify">
                      <button
                        onClick={() => handleDuplicateClick(template)}
                        className="flex items-center gap-2 p-2 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors"
                      >
                        <i className="fas fa-copy text-lg"></i>
                        <span className="text-sm font-medium whitespace-nowrap">Duplicate</span>
                      </button>
                    </Tooltip>
                  )}
                  {canEditTemplate(template) && !template.isDefault && (
                    <Tooltip content="Make this the default template for new presentations">
                      <button
                        onClick={() => handleSetDefault(template.id!)}
                        className="flex items-center gap-2 p-2 text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 hover:bg-yellow-100 dark:hover:bg-yellow-900/50 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 transition-colors"
                      >
                        <i className="fas fa-star text-lg"></i>
                        <span className="text-sm font-medium whitespace-nowrap">Set Default</span>
                      </button>
                    </Tooltip>
                  )}
                  {canEditTemplate(template) && (
                    <Tooltip content="Permanently delete this template">
                      <button
                        onClick={() => handleDelete(template.id!)}
                        className="flex items-center gap-2 p-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
                      >
                        <i className="fas fa-trash text-lg"></i>
                      <span className="text-sm font-medium whitespace-nowrap">Delete</span>
                    </button>
                    </Tooltip>
                  )}
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
            <Tooltip content="Visual drag-and-drop editor - design your template with a live preview">
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
            </Tooltip>
            <Tooltip content="Advanced text-based editor - directly edit template configuration as YAML code">
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
            </Tooltip>
          </div>

          {/* WYSIWYG Editor Mode */}
          {editorMode === 'wysiwyg' && editingTemplate && (
            <>
              <TemplateWysiwygEditor
                template={editingTemplate}
                onTemplateChange={setEditingTemplate}
                onSlideIndexChange={setEditorSelectedSlideIndex}
                onSwitchToYaml={(slideIndex) => {
                  // Sync visual changes to YAML before switching
                  const templateWithDefaults = applyDefaultSongContentStyles(editingTemplate);
                  const newYaml = templateToYaml(templateWithDefaults);
                  setYamlContent(newYaml);
                  setEditorMode('yaml');
                  
                  // After switching, scroll to the slide in YAML
                  // Find the line that starts with "  - # Slide X" (1-based)
                  setTimeout(() => {
                    const textarea = document.querySelector('textarea[value]') as HTMLTextAreaElement;
                    if (textarea) {
                      const slideMarker = '  - # Slide ' + (slideIndex + 1);
                      const yamlLines = newYaml.split('\n');
                      let lineNumber = 0;
                      for (let i = 0; i < yamlLines.length; i++) {
                        if (yamlLines[i].startsWith(slideMarker)) {
                          lineNumber = i;
                          break;
                        }
                      }
                      // Scroll to approximately that line
                      const lineHeight = 20; // approximate
                      textarea.scrollTop = lineNumber * lineHeight - 100;
                      // Also set cursor position
                      const charPosition = yamlLines.slice(0, lineNumber).join('\n').length;
                      textarea.setSelectionRange(charPosition, charPosition);
                      textarea.focus();
                    }
                  }, 100);
                }}
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
                  <Tooltip content="Unique name to identify this template">
                    <span className="ml-1 text-gray-400 dark:text-gray-500 cursor-help">
                      <i className="fas fa-info-circle text-xs"></i>
                    </span>
                  </Tooltip>
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
                  <Tooltip content="Brief description of this template's purpose or style">
                    <span className="ml-1 text-gray-400 dark:text-gray-500 cursor-help">
                      <i className="fas fa-info-circle text-xs"></i>
                    </span>
                  </Tooltip>
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
                <Tooltip content="Slide dimensions - 16:9 for widescreen displays, 4:3 for older projectors">
                  <span className="ml-1 text-gray-400 dark:text-gray-500 cursor-help">
                    <i className="fas fa-info-circle text-xs"></i>
                  </span>
                </Tooltip>
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

          {/* Center Assignment */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="mb-2">
              <label className="block text-sm font-medium text-gray-900 dark:text-white">
                {isAdmin ? "Centers" : "Centers"}
                <Tooltip content={isAdmin ? "Assign this template to specific centers, or leave empty to make it available to all centers" : "Select which centers can use this template"}>
                  <span className="ml-1 text-gray-400 dark:text-gray-500 cursor-help">
                    <i className="fas fa-info-circle text-xs"></i>
                  </span>
                </Tooltip>
              </label>
            </div>
            <CenterMultiSelect
              selectedCenterIds={centerIds}
              onChange={setCenterIds}
              editableOnly={!isAdmin}
              label={isAdmin ? "Optional - leave empty for all centers" : "Select from your editor centers"}
            />
          </div>

          <div className="flex gap-2 justify-between pt-2">
            <Tooltip content="Preview how this template will look with sample content">
              <button
                onClick={() => {
                  if (editingTemplate) {
                    setPreviewSlideIndex(editorSelectedSlideIndex);
                    setPreviewTemplate(editingTemplate);
                  }
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
              >
                <i className="fas fa-eye text-base"></i>
                Preview
              </button>
            </Tooltip>
            <div className="flex gap-2">
              <Tooltip content="Discard changes and close the editor">
                <button
                  onClick={handleFormCancel}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </Tooltip>
              <Tooltip content={editingTemplate?.id ? "Save changes to this template" : "Create a new template with these settings"}>
                <button
                  onClick={handleFormSubmit}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {editingTemplate?.id ? 'Update Template' : 'Create Template'}
                </button>
              </Tooltip>
            </div>
          </div>
        </div>
      </Modal>

      {/* Full Page Template Preview Modal */}
      <PresentationModal
        isOpen={!!previewTemplate}
        onClose={() => {
          if (previewFullscreen && document.fullscreenElement) {
            document.exitFullscreen();
          }
          setPreviewTemplate(null);
          setPreviewSlideIndex(0);
        }}
        title={'Template Preview: ' + (previewTemplate?.name || '')}
        slides={previewSlides.map((slide, idx) => {
          if (idx === previewReferenceIndex) {
            // Return a sample Slide for reference slide
            return {
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
              index: idx,
            } as Slide;
          }
          // Return the template slide as-is
          return slide;
        })}
        currentSlideIndex={previewSlideIndex}
        onSlideChange={setPreviewSlideIndex}
        template={previewTemplate}
        referenceSlideIndex={previewReferenceIndex}
        showDescription={true}
        description={previewTemplate?.description}
        isFullscreen={previewFullscreen}
        disableKeyboardNavigation={true}
      />

      {/* Duplicate Template Confirmation Modal */}
      <Modal
        isOpen={!!duplicatingTemplate}
        onClose={handleDuplicateCancel}
        title="Duplicate Template"
      >
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Duplicate template <span className="font-semibold">{duplicatingTemplate?.name?.split(' (')[0]}</span>?
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              New Template Name
            </label>
            <input
              type="text"
              value={duplicatingTemplate?.name || ''}
              onChange={(e) => setDuplicatingTemplate(prev => prev ? { ...prev, name: e.target.value } : null)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <CenterMultiSelect
              selectedCenterIds={centerIds}
              onChange={setCenterIds}
              editableOnly={!isAdmin}
              label={isAdmin ? "Centers (leave empty for global template)" : "Centers (pre-selected with your editor centers)"}
            />
          </div>
          <div className="flex justify-end space-x-3">
            <button
              onClick={handleDuplicateCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              onClick={handleDuplicateConfirm}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              Duplicate
            </button>
          </div>
        </div>
      </Modal>

      {/* Media Export Configuration Modal */}
      <MediaExportModal
        isOpen={showMediaExportModal}
        onClose={() => {
          setShowMediaExportModal(false);
          setPendingPptxFile(null);
          // Reset file input
          if (pptxInputRef.current) {
            pptxInputRef.current.value = '';
          }
        }}
        onConfirm={handleMediaExportConfirm}
      />

      {/* PowerPoint Import Progress Modal */}
      {importingPptx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
            <div className="flex flex-col items-center gap-4">
              <i className="fas fa-file-powerpoint text-6xl text-orange-500 animate-pulse"></i>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                Importing PowerPoint
              </h3>
              <p className="text-gray-600 dark:text-gray-300 text-center">
                {importProgress || 'Processing...'}
              </p>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                <div className="bg-blue-600 h-2.5 rounded-full animate-pulse" style={{ width: '100%' }}></div>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                Please wait while we process your presentation...
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TemplateManager;
