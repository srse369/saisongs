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

  useEffect(() => {
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

      for (const service of ipServices) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout
          
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
              console.log('[Analytics] Public IP detected:', ip);
              return ip;
            }
          }
        } catch (error) {
          // Try next service
          console.warn(`[Analytics] Failed to detect IP from ${service.url}:`, error);
          continue;
        }
      }
      
      console.warn('[Analytics] All IP detection services failed');
      return null;
    };

    // Track page view
    const trackPageView = async () => {
      try {
        const userRole = sessionStorage.getItem('songstudio_auth_role') || 'public';
        
        // Get public IP (cached after first call)
        const publicIp = await getPublicIp();
        
        // Send tracking beacon (non-blocking)
        fetch(`${API_BASE_URL}/analytics/track`, {
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
      } catch (error) {
        // Ignore tracking errors
      }
    };

    trackPageView();
  }, [location.pathname, userRole]); // Track on route change OR role change
};

