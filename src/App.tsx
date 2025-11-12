import { BrowserRouter, Routes, Route, Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { SongManager, SingerManager, PitchManager, PasswordDialog, BulkImportUI } from './components/admin';
import { SongList, PresentationMode } from './components/presentation';
import { ErrorBoundary, ToastContainer, ProtectedRoute } from './components/common';
import { Layout } from './components/Layout';
import { SongProvider } from './contexts/SongContext';
import { SingerProvider } from './contexts/SingerContext';
import { PitchProvider } from './contexts/PitchContext';
import { ToastProvider } from './contexts/ToastContext';
import { AuthProvider } from './contexts/AuthContext';
import { useAdminShortcut } from './hooks';
import { useState } from 'react';
import './App.css';

function AppContent() {
  // Initialize admin keyboard shortcut (Ctrl+Shift+I or Cmd+Shift+I)
  const { isPasswordDialogOpen, closePasswordDialog } = useAdminShortcut();
  
  // State for controlling Import UI visibility
  const [isImportUIOpen, setIsImportUIOpen] = useState(false);

  const handlePasswordSuccess = () => {
    // Open Import UI after successful authentication
    setIsImportUIOpen(true);
  };

  return (
    <>
      <ToastContainer />
      
      {/* Password Dialog - triggered by keyboard shortcut */}
      <PasswordDialog
        isOpen={isPasswordDialogOpen}
        onClose={closePasswordDialog}
        onSuccess={handlePasswordSuccess}
      />
      
      {/* Bulk Import UI - opened after successful authentication */}
      <BulkImportUI
        isOpen={isImportUIOpen}
        onClose={() => setIsImportUIOpen(false)}
      />
      
      <Routes>
                  {/* Public Routes with Layout */}
                  <Route path="/" element={<Layout><HomePage /></Layout>} />
                  <Route path="/presentation" element={<Layout><PresentationSongListPage /></Layout>} />
                  
                  {/* Protected Admin Routes with Layout */}
                  <Route path="/admin/songs" element={<ProtectedRoute><Layout><SongManager /></Layout></ProtectedRoute>} />
                  <Route path="/admin/singers" element={<ProtectedRoute><Layout><SingerManager /></Layout></ProtectedRoute>} />
                  <Route path="/admin/pitches" element={<ProtectedRoute><Layout><PitchManager /></Layout></ProtectedRoute>} />
                  
                  {/* Presentation Mode without Layout (full-screen) */}
                  <Route path="/presentation/:songId" element={<PresentationModePage />} />

                  {/* Redirect unknown routes to home */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
    </>
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
                <BrowserRouter>
                  <AppContent />
                </BrowserRouter>
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
  return (
    <div className="px-4 py-8 sm:py-12 animate-fade-in">
      <div className="text-center max-w-4xl mx-auto">
        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6">
          Song Studio
        </h1>
        <p className="text-lg sm:text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-8 sm:mb-12">
          Manage and present devotional songs in a beautiful slideshow format
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 mt-8 sm:mt-12 max-w-5xl mx-auto">
        <Link
          to="/presentation"
          className="group block p-6 sm:p-8 card hover:scale-105 transition-all duration-200"
        >
          <div className="flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-blue-100 dark:bg-blue-900 rounded-full mb-4 group-hover:bg-blue-200 dark:group-hover:bg-blue-800 transition-colors">
            <svg className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white mb-2">
            Start Presentation
          </h2>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            Browse and present songs in full-screen slideshow mode
          </p>
        </Link>

        <Link
          to="/admin/songs"
          className="group block p-6 sm:p-8 card hover:scale-105 transition-all duration-200"
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
      </div>

      <div className="mt-8 sm:mt-12 lg:mt-16 bg-blue-50 dark:bg-gray-800 rounded-lg p-6 sm:p-8 max-w-4xl mx-auto border border-blue-100 dark:border-gray-700">
        <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-4 sm:mb-6">Quick Start Guide</h3>
        <ul className="space-y-3 text-sm sm:text-base text-gray-700 dark:text-gray-300">
          <li className="flex items-start">
            <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-blue-600 text-white rounded-full text-xs font-bold mr-3 mt-0.5">1</span>
            <span>Add songs with lyrics and translations in the Manage Songs section</span>
          </li>
          <li className="flex items-start">
            <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-blue-600 text-white rounded-full text-xs font-bold mr-3 mt-0.5">2</span>
            <span>Create singer profiles in the Manage Singers section</span>
          </li>
          <li className="flex items-start">
            <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-blue-600 text-white rounded-full text-xs font-bold mr-3 mt-0.5">3</span>
            <span>Associate pitch information with songs and singers</span>
          </li>
          <li className="flex items-start">
            <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-blue-600 text-white rounded-full text-xs font-bold mr-3 mt-0.5">4</span>
            <span>Start presenting songs with keyboard navigation support (← → arrows)</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

// Presentation Song List Page - wraps SongList with navigation
function PresentationSongListPage() {
  const navigate = useNavigate();

  const handleSongSelect = (songId: string) => {
    navigate(`/presentation/${songId}`);
  };

  return <SongList onSongSelect={handleSongSelect} />;
}

// Presentation Mode Page - wraps PresentationMode with route params
function PresentationModePage() {
  const { songId } = useParams<{ songId: string }>();
  const navigate = useNavigate();

  const handleExit = () => {
    navigate('/presentation');
  };

  if (!songId) {
    return <Navigate to="/presentation" replace />;
  }

  return <PresentationMode songId={songId} onExit={handleExit} />;
}

export default App;
