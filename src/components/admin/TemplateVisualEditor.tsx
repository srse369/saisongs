import React, { useState, useCallback, useMemo, useRef } from 'react';
import type { PresentationTemplate, BackgroundElement, ImageElement, VideoElement, TextElement, TemplateSlide } from '../../types';

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

/**
 * Detect video aspect ratio and return appropriate dimensions
 */
const detectVideoAspectRatio = async (url: string): Promise<{ width: string; height: string } | null> => {
  return new Promise((resolve) => {
    // Check if it's a YouTube URL
    const isYouTube = url.includes('youtube.com') || url.includes('youtu.be') || url.includes('/shorts/');
    
    if (isYouTube) {
      // YouTube videos - determine if it's a Short (vertical) or regular (horizontal)
      if (url.includes('/shorts/')) {
        // Shorts are vertical (9:16)
        resolve({ width: '360px', height: '640px' });
      } else {
        // Regular YouTube videos are typically 16:9
        resolve({ width: '640px', height: '360px' });
      }
      return;
    }

    // For regular video URLs, try to load and detect
    const video = document.createElement('video');
    video.preload = 'metadata';
    
    video.onloadedmetadata = () => {
      const aspectRatio = video.videoWidth / video.videoHeight;
      
      let width: string;
      let height: string;
      
      if (aspectRatio > 1.5) {
        // Wide video (16:9 or wider)
        width = '640px';
        height = '360px';
      } else if (aspectRatio < 0.7) {
        // Vertical video (9:16 or taller)
        width = '360px';
        height = '640px';
      } else {
        // Square-ish video (1:1 or close)
        width = '480px';
        height = '480px';
      }
      
      resolve({ width, height });
      video.remove();
    };
    
    video.onerror = () => {
      // Default to 16:9 if we can't load
      resolve({ width: '640px', height: '360px' });
      video.remove();
    };
    
    // Set a timeout in case video doesn't load
    setTimeout(() => {
      resolve({ width: '640px', height: '360px' });
      video.remove();
    }, 3000);
    
    video.src = url;
  });
};

export const TemplateVisualEditor: React.FC<TemplateVisualEditorProps> = ({
  template,
  onTemplateChange,
  onPreview,
}) => {
  const [activeTab, setActiveTab] = useState<'basic' | 'slides' | 'background' | 'images' | 'videos' | 'text'>('basic');
  const [selectedSlideIndex, setSelectedSlideIndex] = useState(0);

  // Ensure template has slides array (migrate from legacy format if needed)
  const slides = useMemo(() => {
    if (template.slides && template.slides.length > 0) {
      return template.slides;
    }
    // Legacy format - create single slide from template
    return [{
      background: template.background,
      images: template.images || [],
      videos: template.videos || [],
      text: template.text || [],
    }];
  }, [template]);

  const referenceSlideIndex = template.referenceSlideIndex ?? 0;
  const currentSlide = slides[selectedSlideIndex] || slides[0];

  // Helper to update template with new slides array
  const updateSlides = useCallback((newSlides: TemplateSlide[], newRefIndex?: number) => {
    // Also update legacy fields from reference slide for backward compatibility
    const refIdx = newRefIndex ?? referenceSlideIndex;
    const refSlide = newSlides[refIdx] || newSlides[0];
    
    onTemplateChange({
      ...template,
      slides: newSlides,
      referenceSlideIndex: refIdx,
      // Keep legacy fields in sync
      background: refSlide?.background,
      images: refSlide?.images || [],
      videos: refSlide?.videos || [],
      text: refSlide?.text || [],
    });
  }, [template, onTemplateChange, referenceSlideIndex]);

  // Update current slide
  const updateCurrentSlide = useCallback((updates: Partial<TemplateSlide>) => {
    const newSlides = [...slides];
    newSlides[selectedSlideIndex] = { ...currentSlide, ...updates };
    updateSlides(newSlides);
  }, [slides, selectedSlideIndex, currentSlide, updateSlides]);

  // Slide management handlers
  const handleAddSlide = useCallback(() => {
    const newSlide: TemplateSlide = {
      background: { type: 'color', value: '#000000' },
      images: [],
      videos: [],
      text: [],
    };
    const newSlides = [...slides, newSlide];
    updateSlides(newSlides);
    setSelectedSlideIndex(newSlides.length - 1);
  }, [slides, updateSlides]);

  const handleRemoveSlide = useCallback((index: number) => {
    if (slides.length <= 1) return; // Keep at least one slide
    
    const newSlides = slides.filter((_, i) => i !== index);
    let newRefIndex = referenceSlideIndex;
    
    // Adjust reference index if needed
    if (index === referenceSlideIndex) {
      newRefIndex = 0;
    } else if (index < referenceSlideIndex) {
      newRefIndex = referenceSlideIndex - 1;
    }
    
    updateSlides(newSlides, newRefIndex);
    
    // Adjust selected slide index
    if (selectedSlideIndex >= newSlides.length) {
      setSelectedSlideIndex(newSlides.length - 1);
    } else if (selectedSlideIndex > index) {
      setSelectedSlideIndex(selectedSlideIndex - 1);
    }
  }, [slides, referenceSlideIndex, selectedSlideIndex, updateSlides]);

  const handleMoveSlide = useCallback((fromIndex: number, direction: 'up' | 'down') => {
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= slides.length) return;
    
    const newSlides = [...slides];
    [newSlides[fromIndex], newSlides[toIndex]] = [newSlides[toIndex], newSlides[fromIndex]];
    
    // Adjust reference index
    let newRefIndex = referenceSlideIndex;
    if (fromIndex === referenceSlideIndex) {
      newRefIndex = toIndex;
    } else if (toIndex === referenceSlideIndex) {
      newRefIndex = fromIndex;
    }
    
    updateSlides(newSlides, newRefIndex);
    setSelectedSlideIndex(toIndex);
  }, [slides, referenceSlideIndex, updateSlides]);

  const handleSetReferenceSlide = useCallback((index: number) => {
    updateSlides(slides, index);
  }, [slides, updateSlides]);

  const handleDuplicateSlide = useCallback((index: number) => {
    const slideToCopy = slides[index];
    const newSlide: TemplateSlide = {
      background: slideToCopy.background ? { ...slideToCopy.background } : undefined,
      images: slideToCopy.images ? slideToCopy.images.map(img => ({ ...img, id: `${img.id}-copy-${Date.now()}` })) : [],
      videos: slideToCopy.videos ? slideToCopy.videos.map(vid => ({ ...vid, id: `${vid.id}-copy-${Date.now()}` })) : [],
      text: slideToCopy.text ? slideToCopy.text.map(txt => ({ ...txt, id: `${txt.id}-copy-${Date.now()}` })) : [],
    };
    const newSlides = [...slides.slice(0, index + 1), newSlide, ...slides.slice(index + 1)];
    
    // Adjust reference index if inserted before it
    let newRefIndex = referenceSlideIndex;
    if (index < referenceSlideIndex) {
      newRefIndex = referenceSlideIndex + 1;
    }
    
    updateSlides(newSlides, newRefIndex);
    setSelectedSlideIndex(index + 1);
  }, [slides, referenceSlideIndex, updateSlides]);

  // Basic Info Handlers
  const handleBasicChange = useCallback((field: 'name' | 'description', value: string) => {
    onTemplateChange({
      ...template,
      [field]: value,
    });
  }, [template, onTemplateChange]);

  // Background Handlers (work on current slide)
  const handleBackgroundTypeChange = useCallback((type: typeof BACKGROUND_TYPES[number]) => {
    const newBackground: BackgroundElement = {
      ...currentSlide.background,
      type,
      value: type === 'color' ? '#ffffff' : '',
    };
    updateCurrentSlide({ background: newBackground });
  }, [currentSlide, updateCurrentSlide]);

  const handleBackgroundValueChange = useCallback((value: string) => {
    updateCurrentSlide({
      background: {
        ...currentSlide.background,
        value,
      } as BackgroundElement,
    });
  }, [currentSlide, updateCurrentSlide]);

  const handleBackgroundOpacityChange = useCallback((opacity: number) => {
    updateCurrentSlide({
      background: {
        ...currentSlide.background,
        opacity,
      } as BackgroundElement,
    });
  }, [currentSlide, updateCurrentSlide]);

  // Image Handlers (work on current slide)
  const handleAddImage = useCallback(() => {
    const newImage: ImageElement = {
      id: `image-${Date.now()}`,
      url: '',
      position: 'top-right',
      width: '100px',
      height: '100px',
      opacity: 0.9,
      zIndex: 1,
    };
    updateCurrentSlide({
      images: [...(currentSlide.images || []), newImage],
    });
  }, [currentSlide, updateCurrentSlide]);

  const handleUpdateImage = useCallback((index: number, updates: Partial<ImageElement>) => {
    const images = currentSlide.images || [];
    const newImages = [...images];
    newImages[index] = { ...newImages[index], ...updates };
    updateCurrentSlide({ images: newImages });
  }, [currentSlide, updateCurrentSlide]);

  const handleRemoveImage = useCallback((index: number) => {
    const images = currentSlide.images || [];
    updateCurrentSlide({
      images: images.filter((_, i) => i !== index),
    });
  }, [currentSlide, updateCurrentSlide]);

  // Video Handlers (work on current slide)
  const handleAddVideo = useCallback(() => {
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
    updateCurrentSlide({
      videos: [...(currentSlide.videos || []), newVideo],
    });
  }, [currentSlide, updateCurrentSlide]);

  const handleUpdateVideo = useCallback(async (index: number, updates: Partial<VideoElement>) => {
    console.log('handleUpdateVideo called with:', index, updates);
    const videos = currentSlide.videos || [];
    const newVideos = [...videos];
    const currentVideo = newVideos[index];
    console.log('Current video:', currentVideo);
    
    // If URL is being updated and it's different from the current URL, detect aspect ratio
    if (updates.url && updates.url !== currentVideo.url && updates.url.trim()) {
      console.log('Detecting aspect ratio for:', updates.url);
      console.log('Current dimensions:', currentVideo.width, currentVideo.height);
      try {
        const dimensions = await detectVideoAspectRatio(updates.url);
        console.log('Detected dimensions:', dimensions);
        if (dimensions) {
          // Only update dimensions if they haven't been manually set
          // (i.e., still at default '100%' values)
          if (currentVideo.width === '100%' && currentVideo.height === '100%') {
            console.log('Applying detected dimensions');
            updates.width = dimensions.width;
            updates.height = dimensions.height;
          } else {
            console.log('Skipping - dimensions already set');
          }
        }
      } catch (error) {
        console.warn('Could not detect video aspect ratio:', error);
      }
    }
    
    newVideos[index] = { ...currentVideo, ...updates };
    updateCurrentSlide({ videos: newVideos });
  }, [currentSlide, updateCurrentSlide]);

  const handleRemoveVideo = useCallback((index: number) => {
    const videos = currentSlide.videos || [];
    updateCurrentSlide({
      videos: videos.filter((_, i) => i !== index),
    });
  }, [currentSlide, updateCurrentSlide]);

  // Text Handlers (work on current slide)
  const handleAddText = useCallback(() => {
    const newText: TextElement = {
      id: `text-${Date.now()}`,
      content: 'Sample Text',
      position: 'bottom-center',
      fontSize: '24px',
      color: '#ffffff',
      opacity: 0.9,
      zIndex: 2,
    };
    updateCurrentSlide({
      text: [...(currentSlide.text || []), newText],
    });
  }, [currentSlide, updateCurrentSlide]);

  const handleUpdateText = useCallback((index: number, updates: Partial<TextElement>) => {
    const texts = currentSlide.text || [];
    const newTexts = [...texts];
    newTexts[index] = { ...newTexts[index], ...updates };
    updateCurrentSlide({ text: newTexts });
  }, [currentSlide, updateCurrentSlide]);

  const handleRemoveText = useCallback((index: number) => {
    const texts = currentSlide.text || [];
    updateCurrentSlide({
      text: texts.filter((_, i) => i !== index),
    });
  }, [currentSlide, updateCurrentSlide]);

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {(['basic', 'slides', 'background', 'images', 'videos', 'text'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-medium text-sm whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
            }`}
          >
            {tab === 'slides' ? `📑 Slides (${slides.length})` : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Current Slide Indicator (shown when not on basic/slides tab) */}
      {activeTab !== 'basic' && activeTab !== 'slides' && (
        <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Editing Slide {selectedSlideIndex + 1} of {slides.length}
            </span>
            {selectedSlideIndex === referenceSlideIndex && (
              <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded">
                🎯 Reference Slide
              </span>
            )}
          </div>
          <select
            value={selectedSlideIndex}
            onChange={(e) => setSelectedSlideIndex(parseInt(e.target.value))}
            className="px-2 py-1 text-sm border border-blue-300 dark:border-blue-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            {slides.map((_, idx) => (
              <option key={idx} value={idx}>
                Slide {idx + 1} {idx === referenceSlideIndex ? '(Reference)' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

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

        {/* Slides Tab - Manage multiple slides */}
        {activeTab === 'slides' && (
          <div className="flex flex-col h-[400px]">
            {/* Fixed Top Section */}
            <div className="flex-shrink-0 space-y-3 pb-3">
              {/* Add Slide Button */}
              <button
                onClick={handleAddSlide}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Slide
              </button>

              {/* Info about slide structure */}
              <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-sm">
                <p className="text-gray-700 dark:text-gray-300">
                  <strong>Template Structure:</strong> Static slides → <span className="text-yellow-600 dark:text-yellow-400">Reference Slide (for songs)</span> → Static slides
                </p>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                  The reference slide is duplicated for each song verse during presentation.
                </p>
              </div>
            </div>

            {/* Scrollable Slide List */}
            <div className="flex-1 overflow-y-auto min-h-0 space-y-2 pr-1">
              {slides.map((slide, index) => (
                <div
                  key={index}
                  className={`border rounded-lg p-3 transition-colors ${
                    selectedSlideIndex === index
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  } ${
                    index === referenceSlideIndex
                      ? 'ring-2 ring-yellow-400 dark:ring-yellow-500'
                      : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* Slide Number */}
                      <span className="w-8 h-8 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-full text-sm font-medium text-gray-700 dark:text-gray-300">
                        {index + 1}
                      </span>
                      
                      {/* Slide Info */}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 dark:text-white">
                            Slide {index + 1}
                          </span>
                          {index === referenceSlideIndex && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded">
                              🎯 Reference
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {slide.background?.type === 'color' && `Color: ${slide.background.value}`}
                          {slide.background?.type === 'image' && 'Image background'}
                          {slide.background?.type === 'video' && 'Video background'}
                          {!slide.background && 'No background'}
                          {' • '}
                          {(slide.images?.length || 0)} img, {(slide.videos?.length || 0)} vid, {(slide.text?.length || 0)} txt
                        </div>
                      </div>
                    </div>

                    {/* Slide Actions */}
                    <div className="flex items-center gap-1">
                      {/* Move Up */}
                      <button
                        onClick={() => handleMoveSlide(index, 'up')}
                        disabled={index === 0}
                        className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move up"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      
                      {/* Move Down */}
                      <button
                        onClick={() => handleMoveSlide(index, 'down')}
                        disabled={index === slides.length - 1}
                        className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move down"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      
                      {/* Set as Reference */}
                      <button
                        onClick={() => handleSetReferenceSlide(index)}
                        className={`p-1.5 ${
                          index === referenceSlideIndex
                            ? 'text-yellow-500'
                            : 'text-gray-400 hover:text-yellow-500'
                        }`}
                        title={index === referenceSlideIndex ? 'Reference slide' : 'Set as reference slide'}
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      </button>

                      {/* Duplicate */}
                      <button
                        onClick={() => handleDuplicateSlide(index)}
                        className="p-1.5 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
                        title="Duplicate slide"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                      
                      {/* Edit */}
                      <button
                        onClick={() => {
                          setSelectedSlideIndex(index);
                          setActiveTab('background');
                        }}
                        className="p-1.5 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
                        title="Edit slide"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      
                      {/* Delete */}
                      <button
                        onClick={() => handleRemoveSlide(index)}
                        disabled={slides.length <= 1}
                        className="p-1.5 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Delete slide"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Fixed Bottom Section - Reference Slide Explanation */}
            <div className="flex-shrink-0 pt-3 border-t border-gray-200 dark:border-gray-700 mt-3">
              <div className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                <p><strong>Reference Slide Index:</strong> {referenceSlideIndex + 1}</p>
                <p className="mt-1">
                  {referenceSlideIndex > 0 && `Slides 1-${referenceSlideIndex} are intro slides. `}
                  Slide {referenceSlideIndex + 1} is used for song content.
                  {referenceSlideIndex < slides.length - 1 && ` Slides ${referenceSlideIndex + 2}-${slides.length} are outro slides.`}
                </p>
              </div>
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
                      currentSlide.background?.type === type
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {currentSlide.background?.type === 'color' && (
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                  Color
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={currentSlide.background.value || '#ffffff'}
                    onChange={(e) => handleBackgroundValueChange(e.target.value)}
                    className="w-14 h-10 rounded-md cursor-pointer"
                  />
                  <input
                    type="text"
                    value={currentSlide.background.value || '#ffffff'}
                    onChange={(e) => handleBackgroundValueChange(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="#ffffff"
                  />
                </div>
              </div>
            )}

            {(currentSlide.background?.type === 'image' || currentSlide.background?.type === 'video') && (
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                  URL
                </label>
                <input
                  type="url"
                  value={currentSlide.background?.value || ''}
                  onChange={(e) => handleBackgroundValueChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://example.com/image.jpg"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                Opacity: {Math.round((currentSlide.background?.opacity ?? 1) * 100)}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round((currentSlide.background?.opacity ?? 1) * 100)}
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

            {(currentSlide.images || []).length === 0 ? (
              <p className="text-center py-8 text-gray-500 dark:text-gray-400">No images added yet</p>
            ) : (
              <div className="space-y-4">
                {(currentSlide.images || []).map((image, index) => (
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

            {(currentSlide.videos || []).length === 0 ? (
              <p className="text-center py-8 text-gray-500 dark:text-gray-400">No videos added yet</p>
            ) : (
              <div className="space-y-4">
                {(currentSlide.videos || []).map((video, index) => (
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

            {(currentSlide.text || []).length === 0 ? (
              <p className="text-center py-8 text-gray-500 dark:text-gray-400">No text elements added yet</p>
            ) : (
              <div className="space-y-4">
                {(currentSlide.text || []).map((textEl, index) => (
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
                      <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                        Text Align
                      </label>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => handleUpdateText(index, { textAlign: 'left' })}
                          className={`flex-1 px-3 py-2 text-sm border rounded-md flex items-center justify-center gap-1 ${
                            (textEl.textAlign ?? 'left') === 'left'
                              ? 'bg-blue-500 text-white border-blue-500'
                              : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                          }`}
                          title="Align Left"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h14" />
                          </svg>
                          Left
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateText(index, { textAlign: 'center' })}
                          className={`flex-1 px-3 py-2 text-sm border rounded-md flex items-center justify-center gap-1 ${
                            textEl.textAlign === 'center'
                              ? 'bg-blue-500 text-white border-blue-500'
                              : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                          }`}
                          title="Align Center"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M7 12h10M5 18h14" />
                          </svg>
                          Center
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateText(index, { textAlign: 'right' })}
                          className={`flex-1 px-3 py-2 text-sm border rounded-md flex items-center justify-center gap-1 ${
                            textEl.textAlign === 'right'
                              ? 'bg-blue-500 text-white border-blue-500'
                              : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                          }`}
                          title="Align Right"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M10 12h10M6 18h14" />
                          </svg>
                          Right
                        </button>
                      </div>
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
