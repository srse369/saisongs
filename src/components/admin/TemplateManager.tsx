import React, { useState, useEffect, useMemo } from 'react';
import { useTemplates } from '../../contexts/TemplateContext';
import type { PresentationTemplate, Slide } from '../../types';
import { RefreshIcon, Modal } from '../common';
import { SlideView } from '../presentation/SlideView';
import { TemplateVisualEditor } from './TemplateVisualEditor';

/**
 * Convert a PresentationTemplate object to YAML string format
 */
function templateToYaml(template: PresentationTemplate): string {
  const lines: string[] = [];

  // Name
  lines.push(`name: ${escapeYamlString(template.name)}`);

  // Description
  if (template.description) {
    lines.push(`description: ${escapeYamlString(template.description)}`);
  }

  // Background
  lines.push('background:');
  if (template.background) {
    lines.push(`  type: ${template.background.type}`);
    lines.push(`  value: ${escapeYamlString(template.background.value || '')}`);
    if (template.background.opacity !== undefined) {
      lines.push(`  opacity: ${template.background.opacity}`);
    }
  }

  // Images
  lines.push('images:');
  if (template.images && template.images.length > 0) {
    template.images.forEach((img) => {
      lines.push('  - id: ' + escapeYamlString(img.id));
      lines.push(`    url: ${escapeYamlString(img.url)}`);
      if (img.position) lines.push(`    position: ${img.position}`);
      if (img.x !== undefined) lines.push(`    x: ${escapeYamlString(String(img.x))}`);
      if (img.y !== undefined) lines.push(`    y: ${escapeYamlString(String(img.y))}`);
      if (img.width) lines.push(`    width: ${escapeYamlString(img.width)}`);
      if (img.height) lines.push(`    height: ${escapeYamlString(img.height)}`);
      if (img.opacity !== undefined) lines.push(`    opacity: ${img.opacity}`);
      if (img.zIndex !== undefined) lines.push(`    zIndex: ${img.zIndex}`);
    });
  } else {
    lines.push('  []');
  }

  // Videos
  lines.push('videos:');
  if (template.videos && template.videos.length > 0) {
    template.videos.forEach((vid) => {
      lines.push('  - id: ' + escapeYamlString(vid.id));
      lines.push(`    url: ${escapeYamlString(vid.url)}`);
      if (vid.position) lines.push(`    position: ${vid.position}`);
      if (vid.x !== undefined) lines.push(`    x: ${escapeYamlString(String(vid.x))}`);
      if (vid.y !== undefined) lines.push(`    y: ${escapeYamlString(String(vid.y))}`);
      if (vid.width) lines.push(`    width: ${escapeYamlString(vid.width)}`);
      if (vid.height) lines.push(`    height: ${escapeYamlString(vid.height)}`);
      if (vid.opacity !== undefined) lines.push(`    opacity: ${vid.opacity}`);
      if (vid.zIndex !== undefined) lines.push(`    zIndex: ${vid.zIndex}`);
      if (vid.autoPlay !== undefined) lines.push(`    autoPlay: ${vid.autoPlay}`);
      if (vid.loop !== undefined) lines.push(`    loop: ${vid.loop}`);
      if (vid.muted !== undefined) lines.push(`    muted: ${vid.muted}`);
    });
  } else {
    lines.push('  []');
  }

  // Text
  lines.push('text:');
  if (template.text && template.text.length > 0) {
    template.text.forEach((txt) => {
      lines.push('  - id: ' + escapeYamlString(txt.id));
      lines.push(`    content: ${escapeYamlString(txt.content)}`);
      if (txt.position) lines.push(`    position: ${txt.position}`);
      if (txt.x !== undefined) lines.push(`    x: ${escapeYamlString(String(txt.x))}`);
      if (txt.y !== undefined) lines.push(`    y: ${escapeYamlString(String(txt.y))}`);
      if (txt.fontSize) lines.push(`    fontSize: ${escapeYamlString(txt.fontSize)}`);
      if (txt.color) lines.push(`    color: ${escapeYamlString(txt.color)}`);
      if (txt.fontWeight) lines.push(`    fontWeight: ${txt.fontWeight}`);
      if (txt.opacity !== undefined) lines.push(`    opacity: ${txt.opacity}`);
      if (txt.zIndex !== undefined) lines.push(`    zIndex: ${txt.zIndex}`);
    });
  } else {
    lines.push('  []');
  }

  return lines.join('\n');
}

/**
 * Escape strings for YAML output
 */
function escapeYamlString(str: string): string {
  if (!str) return "''";
  // If string contains special characters, wrap in quotes
  if (/[:|{}[\],&*#?!@`"'%]/.test(str) || str.includes('\n')) {
    return `'${str.replace(/'/g, "''")}'`;
  }
  return str;
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
  const [editingTemplate, setEditingTemplate] = useState<PresentationTemplate | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [yamlContent, setYamlContent] = useState('');
  const [validationError, setValidationError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [editorMode, setEditorMode] = useState<'visual' | 'yaml'>('visual');
  const previewContainerRef = React.useRef<HTMLDivElement>(null);

  // Load templates on mount
  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Handle escape key to close preview modal, and arrow keys to scroll
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!previewTemplate) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setPreviewTemplate(null);
        return;
      }

      // Handle arrow keys for scrolling through preview
      const container = previewContainerRef.current;
      if (!container) return;

      const scrollAmount = 100; // pixels to scroll per key press
      
      switch (event.key) {
        case 'ArrowUp':
          event.preventDefault();
          container.scrollTop -= scrollAmount;
          break;
        case 'ArrowDown':
          event.preventDefault();
          container.scrollTop += scrollAmount;
          break;
        case 'ArrowLeft':
          event.preventDefault();
          container.scrollLeft -= scrollAmount;
          break;
        case 'ArrowRight':
          event.preventDefault();
          container.scrollLeft += scrollAmount;
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [previewTemplate]);

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
      
      if (editorMode === 'visual') {
        // In visual mode, always generate YAML from the current template
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

  const handlePreview = (template: PresentationTemplate) => {
    console.log('👁️ Preview clicked - template:', template.name, 'background:', template.background);
    setPreviewTemplate(template);
  };

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
        {filteredTemplates.length > 0 ? (
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
                  {template.background && (
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600 dark:text-gray-400">
                      <span className="inline-flex items-center px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">
                        📌 {template.background.type}
                      </span>
                      {template.images && template.images.length > 0 && (
                        <span className="inline-flex items-center px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">
                          🖼️ {template.images.length} image{template.images.length !== 1 ? 's' : ''}
                        </span>
                      )}
                      {template.videos && template.videos.length > 0 && (
                        <span className="inline-flex items-center px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">
                          🎬 {template.videos.length} video{template.videos.length !== 1 ? 's' : ''}
                        </span>
                      )}
                      {template.text && template.text.length > 0 && (
                        <span className="inline-flex items-center px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">
                          📝 {template.text.length} element{template.text.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions Row */}
                <div className="flex flex-wrap items-center justify-start gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => handlePreview(template)}
                    className="flex items-center gap-2 p-2 text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 dark:hover:bg-purple-900/50 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    <span className="text-sm font-medium whitespace-nowrap">Preview</span>
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
      >
        <div className="space-y-4">
          {/* Editor Mode Tabs */}
          <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => {
                // When clicking visual editor button, check if we're coming FROM YAML mode
                if (editorMode === 'yaml' && yamlContent.trim()) {
                  // Sync YAML changes to visual before switching
                  validateYaml(yamlContent).then(validation => {
                    if (validation.valid && validation.template && editingTemplate) {
                      setEditingTemplate({
                        ...editingTemplate,
                        ...validation.template,
                      });
                    }
                  });
                }
                setEditorMode('visual');
              }}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                editorMode === 'visual'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
              }`}
            >
              🎨 Visual Editor
            </button>
            <button
              onClick={() => {
                // When clicking YAML editor button, check if we're coming FROM visual mode
                if (editorMode === 'visual' && editingTemplate) {
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
              ⚙️ YAML Editor
            </button>
          </div>

          {/* Visual Editor Mode */}
          {editorMode === 'visual' && editingTemplate && (
            <>
              <TemplateVisualEditor
                template={editingTemplate}
                onTemplateChange={setEditingTemplate}
                onPreview={handlePreview}
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
                />
              </div>

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

          <div className="flex gap-2 justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
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
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white truncate">
                  Template Preview: {previewTemplate.name}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Use arrow keys to scroll • Press Esc to close
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPreviewTemplate(null);
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl leading-none ml-4 flex-shrink-0"
                aria-label="Close preview"
              >
                ✕
              </button>
            </div>

            {/* Preview Content - Takes most of the space and is scrollable */}
            <div 
              ref={previewContainerRef}
              className="flex-1 overflow-auto relative"
              style={{ overscrollBehavior: 'contain' }}
            >
              {/* Full slide preview without constraints */}
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
                } as Slide}
                showTranslation={true}
                template={previewTemplate}
              />
            </div>

            {/* Footer with Details - Collapsible info panel */}
            <div className="bg-white dark:bg-gray-800 p-3 border-t border-gray-200 dark:border-gray-700 overflow-y-auto max-h-32 flex-shrink-0">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                {/* Description */}
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1 text-xs">Description</h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                    {previewTemplate.description || '(No description)'}
                  </p>
                </div>

                {/* Background Info */}
                {previewTemplate.background && (
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1 text-xs">Background</h3>
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        {previewTemplate.background.type}
                      </span>
                      {previewTemplate.background.value && (
                        <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300 font-mono truncate max-w-xs">
                          {previewTemplate.background.value}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Elements Count */}
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1 text-xs">Elements</h3>
                  <div className="space-y-0.5 text-xs">
                    {previewTemplate.images && previewTemplate.images.length > 0 && (
                      <div className="text-gray-600 dark:text-gray-400">
                        🖼️ {previewTemplate.images.length} image{previewTemplate.images.length !== 1 ? 's' : ''}
                      </div>
                    )}
                    {previewTemplate.videos && previewTemplate.videos.length > 0 && (
                      <div className="text-gray-600 dark:text-gray-400">
                        🎬 {previewTemplate.videos.length} video{previewTemplate.videos.length !== 1 ? 's' : ''}
                      </div>
                    )}
                    {previewTemplate.text && previewTemplate.text.length > 0 && (
                      <div className="text-gray-600 dark:text-gray-400">
                        📝 {previewTemplate.text.length} text element{previewTemplate.text.length !== 1 ? 's' : ''}
                      </div>
                    )}
                    {(!previewTemplate.images || previewTemplate.images.length === 0) &&
                      (!previewTemplate.videos || previewTemplate.videos.length === 0) &&
                      (!previewTemplate.text || previewTemplate.text.length === 0) && (
                      <div className="text-gray-500 dark:text-gray-500 text-xs">No overlays</div>
                    )}
                  </div>
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
