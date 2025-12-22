import { BrowserRouter, Routes, Route, Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { OTPLoginDialog } from './components/admin';
import { SongList, PresentationMode } from './components/presentation';
import { SessionManager } from './components/session/SessionManager';
import { SessionPresentationMode } from './components/session/SessionPresentationMode';
import { ErrorBoundary, ToastContainer, ProtectedRoute } from './components/common';
import { Layout } from './components/Layout';
import { SongProvider, useSongs } from './contexts/SongContext';
import { SingerProvider, useSingers } from './contexts/SingerContext';
import { PitchProvider, usePitches } from './contexts/PitchContext';
import { TemplateProvider, useTemplates } from './contexts/TemplateContext';
import { ToastProvider } from './contexts/ToastContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SessionProvider } from './contexts/SessionContext';
import { NamedSessionProvider, useNamedSessions } from './contexts/NamedSessionContext';
import { useAdminShortcut } from './hooks';
import { usePageTracking } from './hooks/usePageTracking';

// Lazy load admin components for better initial load performance
const SongManager = lazy(() => import('./components/admin/SongManager'));
const SingerManager = lazy(() => import('./components/admin/SingerManager'));
const PitchManager = lazy(() => import('./components/admin/PitchManager'));
const TemplateManager = lazy(() => import('./components/admin/TemplateManager'));
const CentersManager = lazy(() => import('./components/admin/CentersManager'));
const Analytics = lazy(() => import('./components/admin/Analytics'));
const FeedbackManager = lazy(() => import('./components/admin/FeedbackManager'));
const BulkImportUI = lazy(() => import('./components/admin/BulkImportUI'));
const CsvImportManager = lazy(() => import('./components/admin/CsvImportManager'));
const Help = lazy(() => import('./components/Help'));
import './App.css';

// Loading fallback component for lazy-loaded routes
// This is a minimal spinner that fits within the existing layout
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

function AppContent() {
  // Initialize admin keyboard shortcut (Ctrl+Shift+I or Cmd+Shift+I)
  const { isPasswordDialogOpen, closePasswordDialog } = useAdminShortcut();
  const { isAuthenticated, isLoading, setAuthenticatedUser } = useAuth();
  const { fetchSongs } = useSongs();
  const { fetchSingers } = useSingers();
  const { fetchAllPitches } = usePitches();
  const { fetchTemplates } = useTemplates();
  const { loadSessions } = useNamedSessions();
  const initialLoadDone = useRef(false);
  
  // Track page views for analytics
  usePageTracking();

  // Warm up cache for public data (songs) on mount
  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      fetchSongs(); // Always fetch public data
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run once on mount

  // Warm up cache for protected data (singers, pitches, templates) when user authenticates
  useEffect(() => {
    if (isAuthenticated) {
      fetchSingers();
      fetchAllPitches();
      fetchTemplates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]); // Fetch when authentication status changes

  // Show loading state during initial auth check
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <ToastContainer />
      
      {/* OTP Login Dialog - triggered by keyboard shortcut */}
      <OTPLoginDialog
        isOpen={isPasswordDialogOpen}
        onClose={closePasswordDialog}
        onSuccess={(role, userId, userEmail, userName, centerIds, editorFor) => {
          setAuthenticatedUser(role, userId, userEmail, userName, centerIds, editorFor);
          closePasswordDialog();
          
          // Pre-populate caches with fresh data after login
          fetchSongs();
          fetchSingers();
          fetchAllPitches();
          fetchTemplates();
          loadSessions();
        }}
      />
      
      <Routes>
                  {/* Public Routes with Layout */}
                  <Route path="/" element={<Layout><HomePage /></Layout>} />
                  <Route path="/help" element={
                    <Layout>
                      <Suspense fallback={<LoadingFallback />}>
                        <Help />
                      </Suspense>
                    </Layout>
                  } />
                  <Route path="/session" element={<Layout><SessionManager /></Layout>} />
                  <Route
                    path="/admin/import"
                    element={
                      <ProtectedRoute requireAdmin={true}>
                        <Layout>
                          <BulkImportPage />
                        </Layout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/import-csv"
                    element={
                      <ProtectedRoute requireAdmin={true}>
                        <Layout>
                          <CsvImportPage />
                        </Layout>
                      </ProtectedRoute>
                    }
                  />
                  
                  {/* Public route - Song list (no singer/pitch info) */}
                  <Route path="/admin/songs" element={
                    <Layout>
                      <Suspense fallback={<LoadingFallback />}>
                        <SongManager />
                      </Suspense>
                    </Layout>
                  } />
                  
                  {/* Protected routes - Singer and pitch data requires authentication */}
                  <Route 
                    path="/admin/singers" 
                    element={
                      <ProtectedRoute>
                        <Layout>
                          <Suspense fallback={<LoadingFallback />}>
                            <SingerManager />
                          </Suspense>
                        </Layout>
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/admin/pitches" 
                    element={
                      <ProtectedRoute>
                        <Layout>
                          <Suspense fallback={<LoadingFallback />}>
                            <PitchManager />
                          </Suspense>
                        </Layout>
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/admin/analytics" 
                    element={
                      <ProtectedRoute requireAdmin={true}>
                        <Layout>
                          <Suspense fallback={<LoadingFallback />}>
                            <Analytics />
                          </Suspense>
                        </Layout>
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/admin/feedback" 
                    element={
                      <ProtectedRoute requireAdmin={true}>
                        <Layout>
                          <Suspense fallback={<LoadingFallback />}>
                            <FeedbackManager />
                          </Suspense>
                        </Layout>
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/admin/templates" 
                    element={
                      <ProtectedRoute requireEditor={true}>
                        <Layout>
                          <Suspense fallback={<LoadingFallback />}>
                            <TemplateManager />
                          </Suspense>
                        </Layout>
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/admin/centers" 
                    element={
                      <ProtectedRoute requireAdmin={true}>
                        <Layout>
                          <Suspense fallback={<LoadingFallback />}>
                            <CentersManager />
                          </Suspense>
                        </Layout>
                      </ProtectedRoute>
                    } 
                  />
                  
                  {/* Presentation Mode without Layout (full-screen) */}
                  <Route path="/presentation/:songId" element={<PresentationModePage />} />
                  <Route path="/session/present" element={<SessionPresentationPage />} />

                  {/* Redirect unknown routes to home */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
    </>
  );
}

// Bulk Import Page - wraps BulkImportUI with layout and explanation
function BulkImportPage() {
  return (
    <div className="px-4 py-6 sm:py-8 space-y-4 sm:space-y-6">
      <div className="max-w-3xl">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Import Songs
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
          Use this tool to import or update songs in bulk from external sources. You can paste JSON manually
          or run a full discovery and import process. Admin authentication is required.
        </p>
      </div>
      <BulkImportUI inline={true} />
    </div>
  );
}

// CSV Import Page (Admin only)
function CsvImportPage() {
  return (
    <div className="px-4 py-6 sm:py-8 space-y-4 sm:space-y-6">
      <div className="max-w-3xl">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Import Singers and Pitches
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
          Import singers and their pitch data from external sources in CSV format.
          This tool will help match songs, normalize pitch formats, and create new singer entries as needed. Admin authentication is required.
        </p>
      </div>
      <CsvImportManager />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <SongProvider>
              <SingerProvider>
                <PitchProvider>
                  <TemplateProvider>
                    <NamedSessionProvider>
                      <SessionProvider>
                        <AppContent />
                      </SessionProvider>
                    </NamedSessionProvider>
                  </TemplateProvider>
                </PitchProvider>
              </SingerProvider>
            </SongProvider>
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

// Home Page Component
function HomePage() {
  const { isAuthenticated, userName } = useAuth();

  return (
    <div className="px-4 py-8 sm:py-12 animate-fade-in">
      <div className="text-center max-w-4xl mx-auto">
        {isAuthenticated ? (
          <div className="mt-8 space-y-4">
            <p className="text-xl sm:text-2xl text-gray-700 dark:text-gray-300">
              Welcome back, {userName}!
            </p>
            <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400">
              Use the navigation menu above to manage songs, singers, pitches, or start a live session.
            </p>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            <p className="text-xl sm:text-2xl text-gray-700 dark:text-gray-300">
              Welcome to Sai Devotional Song Studio
            </p>
            <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400">
              A comprehensive platform for managing and presenting devotional songs with lyrics, meanings, and pitch information.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Presentation Song List Page - wraps SongList with navigation
function PresentationSongListPage() {
  const navigate = useNavigate();

  const handleSongSelect = (songId: string) => {
    navigate(`/session/${songId}`);
  };

  return <SongList onSongSelect={handleSongSelect} />;
}

// Presentation Mode Page - wraps PresentationMode with route params for single-song presentation
function PresentationModePage() {
  const { songId } = useParams<{ songId: string }>();
  const navigate = useNavigate();

  const handleExit = () => {
    // When exiting presentation, go back to the previous page (Songs tab, Pitches tab, or Session list)
    // If there is no meaningful history, fall back to the session list
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/session');
    }
  };

  if (!songId) {
    return <Navigate to="/" replace />;
  }

  return <PresentationMode songId={songId} onExit={handleExit} />;
}

// Session Presentation Page - wraps SessionPresentationMode
function SessionPresentationPage() {
  const navigate = useNavigate();

  const handleExit = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/session');
    }
  };

  return <SessionPresentationMode onExit={handleExit} />;
}

export default App;
