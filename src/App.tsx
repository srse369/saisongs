import { BrowserRouter, Routes, Route, Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { SongManager, SingerManager, PitchManager, PasswordDialog, BulkImportUI, CsvImportManager, Analytics, FeedbackManager, TemplateManager } from './components/admin';
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
import { NamedSessionProvider } from './contexts/NamedSessionContext';
import { useAdminShortcut } from './hooks';
import { usePageTracking } from './hooks/usePageTracking';
import { useState, useEffect, useRef } from 'react';
import './App.css';

function AppContent() {
  // Initialize admin keyboard shortcut (Ctrl+Shift+I or Cmd+Shift+I)
  const { isPasswordDialogOpen, closePasswordDialog } = useAdminShortcut();
  const { isAuthenticated } = useAuth();
  const { fetchSongs } = useSongs();
  const { fetchSingers } = useSingers();
  const { fetchAllPitches } = usePitches();
  const { fetchTemplates } = useTemplates();
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

  return (
    <>
      <ToastContainer />
      
      {/* Password Dialog - triggered by keyboard shortcut */}
      <PasswordDialog
        isOpen={isPasswordDialogOpen}
        onClose={closePasswordDialog}
        onSuccess={() => {
          // Successful admin login – nothing else automatic
        }}
      />
      
      <Routes>
                  {/* Public Routes with Layout */}
                  <Route path="/" element={<Layout><HomePage /></Layout>} />
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
                  <Route path="/admin/songs" element={<Layout><SongManager /></Layout>} />
                  
                  {/* Protected routes - Singer and pitch data requires authentication */}
                  <Route 
                    path="/admin/singers" 
                    element={
                      <ProtectedRoute>
                        <Layout><SingerManager /></Layout>
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/admin/pitches" 
                    element={
                      <ProtectedRoute>
                        <Layout><PitchManager /></Layout>
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/admin/analytics" 
                    element={
                      <ProtectedRoute requireAdmin={true}>
                        <Layout><Analytics /></Layout>
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/admin/feedback" 
                    element={
                      <ProtectedRoute requireAdmin={true}>
                        <Layout><FeedbackManager /></Layout>
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/admin/templates" 
                    element={
                      <ProtectedRoute requireAdmin={true}>
                        <Layout><TemplateManager /></Layout>
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
  const [isImportOpen, setIsImportOpen] = useState(false);

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
      <div>
        <button
          type="button"
          onClick={() => setIsImportOpen(true)}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        >
          Open Bulk Import Tool
        </button>
      </div>
      <BulkImportUI
        isOpen={isImportOpen}
        onClose={() => {
          setIsImportOpen(false);
        }}
      />
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
      <AuthProvider>
        <ToastProvider>
          <SongProvider>
            <SingerProvider>
              <PitchProvider>
                <TemplateProvider>
                  <NamedSessionProvider>
                    <SessionProvider>
                      <BrowserRouter>
                        <AppContent />
                      </BrowserRouter>
                    </SessionProvider>
                  </NamedSessionProvider>
                </TemplateProvider>
              </PitchProvider>
            </SingerProvider>
          </SongProvider>
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

// Home Page Component
function HomePage() {
  const { isAuthenticated, isAdmin } = useAuth();

  return (
    <div className="px-4 py-8 sm:py-12 animate-fade-in">
      <div className="text-center max-w-4xl mx-auto">
        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-8 sm:mb-12">
          Sai Devotional Song Studio
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 mt-8 sm:mt-12 max-w-6xl mx-auto">
        <Link
          to="/session"
          className="group block p-6 sm:p-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-md hover:scale-105 transition-all duration-200"
        >
          <div className="flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-blue-100 dark:bg-blue-900 rounded-full mb-4 group-hover:bg-blue-200 dark:group-hover:bg-blue-800 transition-colors">
            <svg className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white mb-2">
            Start Session
          </h2>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            Browse and present songs in full-screen slideshow mode
          </p>
        </Link>

        <Link
          to="/admin/songs"
          className="group block p-6 sm:p-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-md hover:scale-105 transition-all duration-200"
        >
          <div className="flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-purple-100 dark:bg-purple-900 rounded-full mb-4 group-hover:bg-purple-200 dark:group-hover:bg-purple-800 transition-colors">
            <svg className="w-6 h-6 sm:w-8 sm:h-8 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white mb-2">
            Manage Content
          </h2>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            Add, edit, and organize songs, singers, and pitch information
          </p>
        </Link>

        {isAuthenticated && (
          <>
            {isAdmin && (
              <>
                <Link
                  to="/admin/import"
                  className="group block p-6 sm:p-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-md hover:scale-105 transition-all duration-200"
                >
                  <div className="flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-amber-100 dark:bg-amber-900 rounded-full mb-4 group-hover:bg-amber-200 dark:group-hover:bg-amber-800 transition-colors">
                    <svg className="w-6 h-6 sm:w-8 sm:h-8 text-amber-600 dark:text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582M20 4v5h-.581M4 12h16M10 16l2 2 2-2M12 14v4" />
                    </svg>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                    Import Songs
                  </h2>
                  <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                    Import or update songs in bulk from external sources
                  </p>
                </Link>
                <Link
                  to="/admin/import-csv"
                  className="group block p-6 sm:p-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-md hover:scale-105 transition-all duration-200"
                >
                  <div className="flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-green-100 dark:bg-green-900 rounded-full mb-4 group-hover:bg-green-200 dark:group-hover:bg-green-800 transition-colors">
                    <svg className="w-6 h-6 sm:w-8 sm:h-8 text-green-600 dark:text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                    Import Singers and Pitches
                  </h2>
                  <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                    Import singers and pitches from external source
                  </p>
                </Link>
              </>
            )}
          </>
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
