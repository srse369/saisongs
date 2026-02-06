import React, { Suspense, lazy, useCallback } from 'react';
import { useLocation, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

// Lazy load manager components
const SongManager = lazy(() => import('./SongManagerRefactored').then(module => ({ default: module.SongManagerRefactored })));
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
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { isAuthenticated, userRole, isAdmin } = useAuth();
  
  // Get tab from URL - simplified
  const getTabFromUrl = (): AdminTab => {
    const tabParam = searchParams.get('tab') as AdminTab;
    if (tabParam && ['songs', 'singers', 'pitches', 'templates', 'centers', 'analytics', 'feedback'].includes(tabParam)) {
      return tabParam;
    }
    const pathTab = location.pathname.replace('/admin/', '') as AdminTab;
    if (pathTab && ['songs', 'singers', 'pitches', 'templates', 'centers', 'analytics', 'feedback'].includes(pathTab)) {
      return pathTab;
    }
    return initialTab || 'songs';
  };

  const activeTab = getTabFromUrl();

  // Simple conditional rendering - unmount inactive tabs for better performance
  return (
    <div className="w-full">
      {activeTab === 'songs' && (
        <Suspense fallback={<LoadingFallback />}>
          <SongManager isActive={true} />
        </Suspense>
      )}

      {isAuthenticated && activeTab === 'singers' && (
        <Suspense fallback={<LoadingFallback />}>
          <SingerManager isActive={true} />
        </Suspense>
      )}

      {isAuthenticated && activeTab === 'pitches' && (
        <Suspense fallback={<LoadingFallback />}>
          <PitchManager isActive={true} />
        </Suspense>
      )}

      {(userRole === 'admin' || userRole === 'editor') && activeTab === 'templates' && (
        <Suspense fallback={<LoadingFallback />}>
          <TemplateManager isActive={true} />
        </Suspense>
      )}

      {isAdmin && activeTab === 'centers' && (
        <Suspense fallback={<LoadingFallback />}>
          <CentersManager isActive={true} />
        </Suspense>
      )}

      {isAdmin && activeTab === 'analytics' && (
        <Suspense fallback={<LoadingFallback />}>
          <Analytics isActive={true} />
        </Suspense>
      )}

      {isAdmin && activeTab === 'feedback' && (
        <Suspense fallback={<LoadingFallback />}>
          <FeedbackManager isActive={true} />
        </Suspense>
      )}
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

