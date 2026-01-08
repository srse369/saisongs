import React, { useState, useEffect, Suspense, lazy, useCallback } from 'react';
import { useLocation, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

// Lazy load manager components
const SongManager = lazy(() => import('./SongManager').then(module => ({ default: module.SongManager })));
const SingerManager = lazy(() => import('./SingerManager').then(module => ({ default: module.SingerManager })));
const PitchManager = lazy(() => import('./PitchManager').then(module => ({ default: module.PitchManager })));
const TemplateManager = lazy(() => import('./TemplateManager'));
const CentersManager = lazy(() => import('./CentersManager'));
const Analytics = lazy(() => import('./Analytics'));
const FeedbackManager = lazy(() => import('./FeedbackManager'));

// Loading fallback component
function LoadingFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Loading...</p>
      </div>
    </div>
  );
}

export type AdminTab = 'songs' | 'singers' | 'pitches' | 'templates' | 'centers' | 'analytics' | 'feedback';

interface AdminTabsProps {
  initialTab?: AdminTab;
}

export const AdminTabs: React.FC<AdminTabsProps> = ({ initialTab }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const { isAuthenticated, userRole, isAdmin } = useAuth();
  
  // Get tab from URL query param, or use initialTab, or default to 'songs'
  const getTabFromUrl = (): AdminTab => {
    const tabParam = searchParams.get('tab') as AdminTab;
    if (tabParam && ['songs', 'singers', 'pitches', 'templates', 'centers', 'analytics', 'feedback'].includes(tabParam)) {
      return tabParam;
    }
    // If no tab param, try to infer from pathname
    const pathTab = location.pathname.replace('/admin/', '') as AdminTab;
    if (pathTab && ['songs', 'singers', 'pitches', 'templates', 'centers', 'analytics', 'feedback'].includes(pathTab)) {
      return pathTab;
    }
    return initialTab || 'songs';
  };

  const [activeTab, setActiveTab] = useState<AdminTab>(() => getTabFromUrl());

  // Update active tab when URL changes (for deep linking)
  useEffect(() => {
    const tabFromUrl = getTabFromUrl();
    setActiveTab(prevTab => {
      if (tabFromUrl !== prevTab) {
        return tabFromUrl;
      }
      return prevTab;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, location.pathname]);

  // Update URL when tab changes (for bookmarking and back button)
  const handleTabChange = (tab: AdminTab) => {
    setActiveTab(tab);
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('tab', tab);
    // Preserve other query params like songId
    setSearchParams(newSearchParams, { replace: true });
  };

  // Expose tab change function via context or prop if needed
  // For now, we'll handle it internally

  return (
    <div className="w-full">
      {/* Songs Tab */}
      <div style={{ display: activeTab === 'songs' ? 'block' : 'none' }}>
        <Suspense fallback={<LoadingFallback />}>
          <SongManager isActive={activeTab === 'songs'} />
        </Suspense>
      </div>

      {/* Singers Tab - Only for authenticated users */}
      <div style={{ display: (isAuthenticated && activeTab === 'singers') ? 'block' : 'none' }}>
        {isAuthenticated && (
          <Suspense fallback={<LoadingFallback />}>
            <SingerManager isActive={activeTab === 'singers'} />
          </Suspense>
        )}
      </div>

      {/* Pitches Tab - Only for authenticated users */}
      <div style={{ display: (isAuthenticated && activeTab === 'pitches') ? 'block' : 'none' }}>
        {isAuthenticated && (
          <Suspense fallback={<LoadingFallback />}>
            <PitchManager isActive={activeTab === 'pitches'} />
          </Suspense>
        )}
      </div>

      {/* Templates Tab - Only for editors/admins */}
      <div style={{ display: ((userRole === 'admin' || userRole === 'editor') && activeTab === 'templates') ? 'block' : 'none' }}>
        {(userRole === 'admin' || userRole === 'editor') && (
          <Suspense fallback={<LoadingFallback />}>
            <TemplateManager isActive={activeTab === 'templates'} />
          </Suspense>
        )}
      </div>

      {/* Centers Tab - Only for admins */}
      <div style={{ display: (isAdmin && activeTab === 'centers') ? 'block' : 'none' }}>
        {isAdmin && (
          <Suspense fallback={<LoadingFallback />}>
            <CentersManager isActive={activeTab === 'centers'} />
          </Suspense>
        )}
      </div>

      {/* Analytics Tab - Only for admins */}
      <div style={{ display: (isAdmin && activeTab === 'analytics') ? 'block' : 'none' }}>
        {isAdmin && (
          <Suspense fallback={<LoadingFallback />}>
            <Analytics isActive={activeTab === 'analytics'} />
          </Suspense>
        )}
      </div>

      {/* Feedback Tab - Only for admins */}
      <div style={{ display: (isAdmin && activeTab === 'feedback') ? 'block' : 'none' }}>
        {isAdmin && (
          <Suspense fallback={<LoadingFallback />}>
            <FeedbackManager isActive={activeTab === 'feedback'} />
          </Suspense>
        )}
      </div>
    </div>
  );
};

// Export a hook to change tabs from outside
export const useAdminTabs = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const changeTab = useCallback((tab: AdminTab) => {
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('tab', tab);
    // Preserve other query params like songId
    // Update the URL path and query params together
    const newUrl = `/admin/${tab}${newSearchParams.toString() ? `?${newSearchParams.toString()}` : ''}`;
    navigate(newUrl, { replace: true });
  }, [searchParams, navigate]);

  return { changeTab };
};

