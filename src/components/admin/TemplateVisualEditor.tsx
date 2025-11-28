import React, { useState, useCallback } from 'react';
import type { PresentationTemplate, BackgroundElement, ImageElement, VideoElement, TextElement } from '../../types';

interface TemplateVisualEditorProps {
  template: PresentationTemplate;
  onTemplateChange: (template: PresentationTemplate) => void;
  onPreview?: (template: PresentationTemplate) => void;
}

const POSITION_OPTIONS = [
  'top-left', 'top-center', 'top-right',
  'center-left', 'center', 'center-right',
  'bottom-left', 'bottom-center', 'bottom-right'
] as const;

const BACKGROUND_TYPES = ['color', 'image', 'video'] as const;

export const TemplateVisualEditor: React.FC<TemplateVisualEditorProps> = ({
  template,
  onTemplateChange,
  onPreview,
}) => {
  const [activeTab, setActiveTab] = useState<'basic' | 'background' | 'images' | 'videos' | 'text'>('basic');

  // Basic Info Handlers
  const handleBasicChange = useCallback((field: 'name' | 'description', value: string) => {
    onTemplateChange({
      ...template,
      [field]: value,
    });
  }, [template, onTemplateChange]);

  // Background Handlers
  const handleBackgroundTypeChange = (type: typeof BACKGROUND_TYPES[number]) => {
    const newBackground: BackgroundElement = {
      ...template.background,
      type,
      value: type === 'color' ? '#ffffff' : '',
    };
    onTemplateChange({
      ...template,
      background: newBackground as BackgroundElement,
    });
  };

  const handleBackgroundValueChange = (value: string) => {
    onTemplateChange({
      ...template,
      background: {
        ...template.background,
        value,
      } as BackgroundElement,
    });
  };

  const handleBackgroundOpacityChange = (opacity: number) => {
    onTemplateChange({
      ...template,
      background: {
        ...template.background,
        opacity,
      } as BackgroundElement,
    });
  };

  // Image Handlers
  const handleAddImage = () => {
    const newImage: ImageElement = {
      id: `image-${Date.now()}`,
      url: '',
      position: 'top-right',
      width: '100px',
      height: '100px',
      opacity: 0.9,
      zIndex: 1,
    };
    onTemplateChange({
      ...template,
      images: [...(template.images || []), newImage],
    });
  };

  const handleUpdateImage = (index: number, updates: Partial<ImageElement>) => {
    const images = template.images || [];
    const newImages = [...images];
    newImages[index] = { ...newImages[index], ...updates };
    onTemplateChange({
      ...template,
      images: newImages,
    });
  };

  const handleRemoveImage = (index: number) => {
    const images = template.images || [];
    onTemplateChange({
      ...template,
      images: images.filter((_, i) => i !== index),
    });
  };

  // Video Handlers
  const handleAddVideo = () => {
    const newVideo: VideoElement = {
      id: `video-${Date.now()}`,
      url: '',
      position: 'center',
      width: '100%',
      height: '100%',
      opacity: 0.3,
      zIndex: 0,
      autoPlay: true,
      loop: true,
      muted: true,
    };
    onTemplateChange({
      ...template,
      videos: [...(template.videos || []), newVideo],
    });
  };

  const handleUpdateVideo = (index: number, updates: Partial<VideoElement>) => {
    const videos = template.videos || [];
    const newVideos = [...videos];
    newVideos[index] = { ...newVideos[index], ...updates };
    onTemplateChange({
      ...template,
      videos: newVideos,
    });
  };

  const handleRemoveVideo = (index: number) => {
    const videos = template.videos || [];
    onTemplateChange({
      ...template,
      videos: videos.filter((_, i) => i !== index),
    });
  };

  // Text Handlers
  const handleAddText = () => {
    const newText: TextElement = {
      id: `text-${Date.now()}`,
      content: 'Sample Text',
      position: 'bottom-center',
      fontSize: '24px',
      color: '#ffffff',
      opacity: 0.9,
      zIndex: 2,
    };
    onTemplateChange({
      ...template,
      text: [...(template.text || []), newText],
    });
  };

  const handleUpdateText = (index: number, updates: Partial<TextElement>) => {
    const texts = template.text || [];
    const newTexts = [...texts];
    newTexts[index] = { ...newTexts[index], ...updates };
    onTemplateChange({
      ...template,
      text: newTexts,
    });
  };

  const handleRemoveText = (index: number) => {
    const texts = template.text || [];
    onTemplateChange({
      ...template,
      text: texts.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {(['basic', 'background', 'images', 'videos', 'text'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-medium text-sm whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="space-y-4">
        {/* Basic Info Tab */}
        {activeTab === 'basic' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                Template Name
              </label>
              <input
                type="text"
                value={template.name}
                onChange={(e) => handleBasicChange('name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="My Template"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                Description
              </label>
              <textarea
                value={template.description || ''}
                onChange={(e) => handleBasicChange('description', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Describe your template..."
              />
            </div>
          </div>
        )}

        {/* Background Tab */}
        {activeTab === 'background' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                Background Type
              </label>
              <div className="flex gap-2">
                {BACKGROUND_TYPES.map((type) => (
                  <button
                    key={type}
                    onClick={() => handleBackgroundTypeChange(type)}
                    className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${
                      template.background?.type === type
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {template.background?.type === 'color' && (
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                  Color
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={template.background.value || '#ffffff'}
                    onChange={(e) => handleBackgroundValueChange(e.target.value)}
                    className="w-14 h-10 rounded-md cursor-pointer"
                  />
                  <input
                    type="text"
                    value={template.background.value || '#ffffff'}
                    onChange={(e) => handleBackgroundValueChange(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="#ffffff"
                  />
                </div>
              </div>
            )}

            {(template.background?.type === 'image' || template.background?.type === 'video') && (
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                  URL
                </label>
                <input
                  type="url"
                  value={template.background?.value || ''}
                  onChange={(e) => handleBackgroundValueChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://example.com/image.jpg"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                Opacity: {Math.round((template.background?.opacity ?? 1) * 100)}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round((template.background?.opacity ?? 1) * 100)}
                onChange={(e) => handleBackgroundOpacityChange(parseInt(e.target.value) / 100)}
                className="w-full"
              />
            </div>
          </div>
        )}

        {/* Images Tab */}
        {activeTab === 'images' && (
          <div className="space-y-4">
            <button
              onClick={handleAddImage}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Image
            </button>

            {(template.images || []).length === 0 ? (
              <p className="text-center py-8 text-gray-500 dark:text-gray-400">No images added yet</p>
            ) : (
              <div className="space-y-4">
                {(template.images || []).map((image, index) => (
                  <div key={image.id} className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-gray-900 dark:text-white">Image {index + 1}</h4>
                      <button
                        onClick={() => handleRemoveImage(index)}
                        className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                      >
                        ✕
                      </button>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                        URL
                      </label>
                      <input
                        type="url"
                        value={image.url}
                        onChange={(e) => handleUpdateImage(index, { url: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="https://example.com/image.jpg"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                        Position (Predefined)
                      </label>
                      <select
                        value={image.position || ''}
                        onChange={(e) => handleUpdateImage(index, { position: e.target.value as typeof POSITION_OPTIONS[number] || undefined, x: undefined, y: undefined })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Use custom X/Y</option>
                        {POSITION_OPTIONS.map((pos) => (
                          <option key={pos} value={pos}>{pos}</option>
                        ))}
                      </select>
                    </div>

                    {!image.position && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                            X Position
                          </label>
                          <input
                            type="text"
                            value={image.x || ''}
                            onChange={(e) => handleUpdateImage(index, { x: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="e.g., 10px or 5%"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                            Y Position
                          </label>
                          <input
                            type="text"
                            value={image.y || ''}
                            onChange={(e) => handleUpdateImage(index, { y: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="e.g., 10px or 5%"
                          />
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                          Width
                        </label>
                        <input
                          type="text"
                          value={image.width}
                          onChange={(e) => handleUpdateImage(index, { width: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="100px"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                          Height
                        </label>
                        <input
                          type="text"
                          value={image.height}
                          onChange={(e) => handleUpdateImage(index, { height: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="100px"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                        Opacity: {Math.round((image.opacity ?? 1) * 100)}%
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={Math.round((image.opacity ?? 1) * 100)}
                        onChange={(e) => handleUpdateImage(index, { opacity: parseInt(e.target.value) / 100 })}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                        Z-Index (Layer Order)
                      </label>
                      <input
                        type="number"
                        value={image.zIndex ?? 1}
                        onChange={(e) => handleUpdateImage(index, { zIndex: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="0"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Higher numbers appear on top</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Videos Tab */}
        {activeTab === 'videos' && (
          <div className="space-y-4">
            <button
              onClick={handleAddVideo}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Video
            </button>

            {(template.videos || []).length === 0 ? (
              <p className="text-center py-8 text-gray-500 dark:text-gray-400">No videos added yet</p>
            ) : (
              <div className="space-y-4">
                {(template.videos || []).map((video, index) => (
                  <div key={video.id} className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-gray-900 dark:text-white">Video {index + 1}</h4>
                      <button
                        onClick={() => handleRemoveVideo(index)}
                        className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                      >
                        ✕
                      </button>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                        URL
                      </label>
                      <input
                        type="url"
                        value={video.url}
                        onChange={(e) => handleUpdateVideo(index, { url: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="https://example.com/video.mp4"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                        Position (Predefined)
                      </label>
                      <select
                        value={video.position || ''}
                        onChange={(e) => handleUpdateVideo(index, { position: e.target.value as typeof POSITION_OPTIONS[number] || undefined, x: undefined, y: undefined })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Use custom X/Y</option>
                        {POSITION_OPTIONS.map((pos) => (
                          <option key={pos} value={pos}>{pos}</option>
                        ))}
                      </select>
                    </div>

                    {!video.position && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                            X Position
                          </label>
                          <input
                            type="text"
                            value={video.x || ''}
                            onChange={(e) => handleUpdateVideo(index, { x: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="e.g., 10px or 5%"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                            Y Position
                          </label>
                          <input
                            type="text"
                            value={video.y || ''}
                            onChange={(e) => handleUpdateVideo(index, { y: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="e.g., 10px or 5%"
                          />
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                          Width
                        </label>
                        <input
                          type="text"
                          value={video.width}
                          onChange={(e) => handleUpdateVideo(index, { width: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="100%"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                          Height
                        </label>
                        <input
                          type="text"
                          value={video.height}
                          onChange={(e) => handleUpdateVideo(index, { height: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="100%"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                        Opacity: {Math.round((video.opacity ?? 1) * 100)}%
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={Math.round((video.opacity ?? 1) * 100)}
                        onChange={(e) => handleUpdateVideo(index, { opacity: parseInt(e.target.value) / 100 })}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                        Z-Index (Layer Order)
                      </label>
                      <input
                        type="number"
                        value={video.zIndex ?? 0}
                        onChange={(e) => handleUpdateVideo(index, { zIndex: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="0"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Higher numbers appear on top</p>
                    </div>

                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={video.autoPlay ?? true}
                          onChange={(e) => handleUpdateVideo(index, { autoPlay: e.target.checked })}
                          className="rounded"
                        />
                        <span className="text-sm text-gray-900 dark:text-white">Auto Play</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={video.loop ?? true}
                          onChange={(e) => handleUpdateVideo(index, { loop: e.target.checked })}
                          className="rounded"
                        />
                        <span className="text-sm text-gray-900 dark:text-white">Loop</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={video.muted ?? true}
                          onChange={(e) => handleUpdateVideo(index, { muted: e.target.checked })}
                          className="rounded"
                        />
                        <span className="text-sm text-gray-900 dark:text-white">Muted</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Text Tab */}
        {activeTab === 'text' && (
          <div className="space-y-4">
            <button
              onClick={handleAddText}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Text
            </button>

            {(template.text || []).length === 0 ? (
              <p className="text-center py-8 text-gray-500 dark:text-gray-400">No text elements added yet</p>
            ) : (
              <div className="space-y-4">
                {(template.text || []).map((textEl, index) => (
                  <div key={textEl.id} className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-gray-900 dark:text-white">Text Element {index + 1}</h4>
                      <button
                        onClick={() => handleRemoveText(index)}
                        className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                      >
                        ✕
                      </button>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                        Content
                      </label>
                      <textarea
                        value={textEl.content}
                        onChange={(e) => handleUpdateText(index, { content: e.target.value })}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Text to display"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                        Position (Predefined)
                      </label>
                      <select
                        value={textEl.position || ''}
                        onChange={(e) => handleUpdateText(index, { position: e.target.value as typeof POSITION_OPTIONS[number] || undefined, x: undefined, y: undefined })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Use custom X/Y</option>
                        {POSITION_OPTIONS.map((pos) => (
                          <option key={pos} value={pos}>{pos}</option>
                        ))}
                      </select>
                    </div>

                    {!textEl.position && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                            X Position
                          </label>
                          <input
                            type="text"
                            value={textEl.x || ''}
                            onChange={(e) => handleUpdateText(index, { x: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="e.g., 10px or 5%"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                            Y Position
                          </label>
                          <input
                            type="text"
                            value={textEl.y || ''}
                            onChange={(e) => handleUpdateText(index, { y: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="e.g., 10px or 5%"
                          />
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                          Font Size
                        </label>
                        <input
                          type="text"
                          value={textEl.fontSize}
                          onChange={(e) => handleUpdateText(index, { fontSize: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="24px"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                          Color
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            value={textEl.color}
                            onChange={(e) => handleUpdateText(index, { color: e.target.value })}
                            className="w-10 h-10 rounded-md cursor-pointer"
                          />
                          <input
                            type="text"
                            value={textEl.color}
                            onChange={(e) => handleUpdateText(index, { color: e.target.value })}
                            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="#ffffff"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                        Font Weight
                      </label>
                      <select
                        value={textEl.fontWeight ?? 'normal'}
                        onChange={(e) => handleUpdateText(index, { fontWeight: e.target.value as any })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="normal">Normal</option>
                        <option value="bold">Bold</option>
                        <option value="100">100 (Thin)</option>
                        <option value="300">300 (Light)</option>
                        <option value="400">400 (Regular)</option>
                        <option value="600">600 (Semi-Bold)</option>
                        <option value="700">700 (Bold)</option>
                        <option value="900">900 (Black)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                        Opacity: {Math.round((textEl.opacity ?? 1) * 100)}%
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={Math.round((textEl.opacity ?? 1) * 100)}
                        onChange={(e) => handleUpdateText(index, { opacity: parseInt(e.target.value) / 100 })}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                        Z-Index (Layer Order)
                      </label>
                      <input
                        type="number"
                        value={textEl.zIndex ?? 2}
                        onChange={(e) => handleUpdateText(index, { zIndex: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="0"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Higher numbers appear on top</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Preview Button */}
      {onPreview && (
        <div className="flex gap-2 justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => onPreview(template)}
            className="px-4 py-2 text-sm font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 rounded-md hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Preview
          </button>
        </div>
      )}
    </div>
  );
};
