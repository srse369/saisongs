import { VIDEO_LOAD_TIMEOUT } from '../constants';

/**
 * Detect video aspect ratio and return appropriate dimensions
 */
export const detectVideoAspectRatio = async (url: string): Promise<{ width: number; height: number } | null> => {
  return new Promise((resolve) => {
    try {
      // Check if it's a YouTube URL
      const isYouTube = url.includes('youtube.com') || url.includes('youtu.be') || url.includes('/shorts/');
      
      if (isYouTube) {
        // YouTube videos - determine if it's a Short (vertical) or regular (horizontal)
        if (url.includes('/shorts/')) {
          // Shorts are vertical (9:16)
          resolve({ width: 360, height: 640 });
        } else {
          // Regular YouTube videos are typically 16:9
          resolve({ width: 640, height: 360 });
        }
        return;
      }

      // For regular video URLs, try to load and detect
      const video = document.createElement('video');
      video.preload = 'metadata';
      
      video.onloadedmetadata = () => {
        const aspectRatio = video.videoWidth / video.videoHeight;
        
        let width: number;
        let height: number;
        
        if (aspectRatio > 1.5) {
          // Wide video (16:9 or wider)
          width = 640;
          height = 360;
        } else if (aspectRatio < 0.7) {
          // Vertical video (9:16 or taller)
          width = 360;
          height = 640;
        } else {
          // Square-ish video (1:1 or close)
          width = 480;
          height = 480;
        }
        
        resolve({ width, height });
        video.remove();
      };
      
      video.onerror = () => {
        // Default to 16:9 if we can't load
        resolve({ width: 640, height: 360 });
        video.remove();
      };
      
      // Set a timeout in case video doesn't load
      setTimeout(() => {
        resolve({ width: 640, height: 360 });
        video.remove();
      }, VIDEO_LOAD_TIMEOUT);
      
      video.src = url;
    } catch (err) {
      // Handle any errors and return default
      resolve({ width: 640, height: 360 });
    }
  });
};

/**
 * Detect image aspect ratio and return appropriate dimensions
 */
export const detectImageAspectRatio = async (url: string): Promise<{ width: number; height: number } | null> => {
  return new Promise((resolve) => {
    let resolved = false;
    let timeoutId: NodeJS.Timeout;
    
    const resolveOnce = (dimensions: { width: number; height: number }) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        resolve(dimensions);
      }
    };
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      const aspectRatio = img.naturalWidth / img.naturalHeight;
      
      let width: number;
      let height: number;
      
      if (aspectRatio > 1.5) {
        // Wide image (16:9 or wider)
        width = 640;
        height = 360;
      } else if (aspectRatio < 0.7) {
        // Vertical image (9:16 or taller)
        width = 360;
        height = 640;
      } else {
        // Square-ish image (1:1 or close)
        width = 400;
        height = 400;
      }
      
      resolveOnce({ width, height });
    };
    
    img.onerror = () => {
      // Default to square if we can't load
      resolveOnce({ width: 400, height: 400 });
    };
    
    // Set a timeout
    timeoutId = setTimeout(() => {
      if (!resolved) {
        resolveOnce({ width: 400, height: 400 });
      }
    }, 3000);
    
    // Load WITHOUT crossOrigin (better compatibility, but can't always read dimensions)
    img.src = url;
  });
};
