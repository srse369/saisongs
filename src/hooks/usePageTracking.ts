import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../services/ApiClient';

/**
 * Hook to track page views for analytics
 * Detects client's public IP and sends tracking data to backend
 */
export const usePageTracking = () => {
  const location = useLocation();
  const { userRole } = useAuth();
  const publicIpCache = useRef<string | null>(null);
  const lastTrackedPath = useRef<string | null>(null);
  const trackingInProgress = useRef<boolean>(false);
  const abortControllersRef = useRef<AbortController[]>([]);

  useEffect(() => {
    // Prevent duplicate tracking for the same path
    if (lastTrackedPath.current === location.pathname || trackingInProgress.current) {
      return;
    }
    
    trackingInProgress.current = true;
    
    // Detect client's public IP address with multiple fallback services
    const getPublicIp = async (): Promise<string | null> => {
      // Return cached IP if available
      if (publicIpCache.current) {
        return publicIpCache.current;
      }

      // List of IP detection services (try in order)
      const ipServices = [
        { url: 'https://api.my-ip.io/v2/ip.json', parser: (data: any) => data.ip },
        { url: 'https://ipapi.co/json/', parser: (data: any) => data.ip },
        { url: 'https://ifconfig.me/ip', parser: (text: string) => text.trim() }
      ];

      const isDevelopment = import.meta.env.DEV;

      for (const service of ipServices) {
        const controller = new AbortController();
        abortControllersRef.current.push(controller);
        
        try {
          const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
          
          const response = await fetch(service.url, {
            method: 'GET',
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          if (response.ok) {
            const isJson = response.headers.get('content-type')?.includes('json');
            const result = isJson ? await response.json() : await response.text();
            const ip = service.parser(result);
            
            if (ip && typeof ip === 'string' && ip.length > 0) {
              publicIpCache.current = ip;
              if (isDevelopment) {
                console.log('[Analytics] Public IP detected:', ip);
              }
              return ip;
            }
          }
        } catch (error) {
          // Only log unexpected errors (not timeouts or aborts)
          const isAbortError = error instanceof Error && 
            (error.name === 'AbortError' || error.message.includes('aborted'));
          const isNetworkError = error instanceof TypeError && 
            error.message.includes('Failed to fetch');
          
          // AbortError is expected when timeout expires or component unmounts
          // Network errors are common (CORS, ad blockers, service down) - only log in dev
          if (!isAbortError && isDevelopment && isNetworkError) {
            console.debug(`[Analytics] IP detection service unavailable: ${service.url}`);
          } else if (!isAbortError && !isNetworkError && isDevelopment) {
            // Log unexpected errors in development only
            console.warn(`[Analytics] Unexpected error from ${service.url}:`, error);
          }
          continue;
        } finally {
          // Remove controller from ref array
          abortControllersRef.current = abortControllersRef.current.filter(c => c !== controller);
        }
      }
      
      // Only log in development mode
      if (isDevelopment) {
        console.debug('[Analytics] All IP detection services failed - continuing without IP');
      }
      return null;
    };

    // Track page view
    const trackPageView = async () => {
      try {
        const userRole = sessionStorage.getItem('songstudio_auth_role') || 'public';
        
        // Get public IP (cached after first call)
        const publicIp = await getPublicIp();
        
        // Send tracking beacon (non-blocking)
        await fetch(`${API_BASE_URL}/analytics/track`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(userRole && { 'X-User-Role': userRole })
          },
          body: JSON.stringify({
            path: location.pathname,
            referrer: document.referrer,
            clientIp: publicIp // Send detected public IP
          }),
          // Use keepalive to ensure request completes even if user navigates away
          keepalive: true
        }).catch(() => {
          // Silently fail - don't disrupt user experience
        });
        
        // Mark this path as tracked
        lastTrackedPath.current = location.pathname;
      } catch (error) {
        // Ignore tracking errors
      } finally {
        trackingInProgress.current = false;
      }
    };

    trackPageView();

    // Cleanup: abort any in-flight requests when component unmounts or path changes
    return () => {
      abortControllersRef.current.forEach(controller => {
        controller.abort();
      });
      abortControllersRef.current = [];
    };
  }, [location.pathname]); // Only track on pathname change, not userRole
};

