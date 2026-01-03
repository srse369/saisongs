import React, { useState, useEffect } from 'react';
import { useSession } from '../../contexts/SessionContext';
import { useSongs } from '../../contexts/SongContext';
import { useSingers } from '../../contexts/SingerContext';
import { useNamedSessions } from '../../contexts/NamedSessionContext';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import type { Song, PresentationTemplate } from '../../types';
import { Modal } from '../common/Modal';
import { CenterBadges } from '../common/CenterBadges';
import { CenterMultiSelect } from '../common/CenterMultiSelect';
import { MobileBottomActionBar, type MobileAction } from '../common';
import { SongMetadataCard } from '../common/SongMetadataCard';
import { SongDetails } from '../admin/SongDetails';
import { formatNormalizedPitch } from '../../utils/pitchNormalization';
import { generateSessionPresentationSlides } from '../../utils/slideUtils';
import TemplateSelector from '../presentation/TemplateSelector';
import templateService from '../../services/TemplateService';
import { pptxExportService } from '../../services/PptxExportService';
import ApiClient from '../../services/ApiClient';
import { getSelectedTemplateId, setSelectedTemplateId } from '../../utils/cacheUtils';

export const SessionManager: React.FC = () => {
  const { entries, removeSong, clearSession, reorderSession, addSong } = useSession();
  const { songs, fetchSongs } = useSongs();
  const { singers, fetchSingers } = useSingers();
  const { sessions, createSession, setSessionItems, loadSession, currentSession, loadSessions, loading, deleteSession } = useNamedSessions();
  const { isEditor, isAuthenticated, userEmail, userRole } = useAuth();
  const navigate = useNavigate();

  const [viewingSong, setViewingSong] = useState<Song | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<PresentationTemplate | null>(null);
  const [sessionName, setSessionName] = useState('');
  const [sessionDescription, setSessionDescription] = useState('');
  const [sessionCenterIds, setSessionCenterIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingSession, setLoadingSession] = useState(false);
  const [sessionToLoad, setSessionToLoad] = useState<string | null>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [selectedSessionItemKey, setSelectedSessionItemKey] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch songs on mount (public data)
  // Fetch singers only when authenticated (protected data)
  useEffect(() => {
    fetchSongs();
    if (isAuthenticated) {
      fetchSingers();
    }
  }, [fetchSongs, fetchSingers, isAuthenticated]);

  // Restore previously selected template from localStorage (always, even if session is empty)
  useEffect(() => {
    const restoreTemplate = async () => {
      // Only load default if no template is currently selected
      if (selectedTemplate) {
        return;
      }

      const savedTemplateId = getSelectedTemplateId();
      if (savedTemplateId) {
        try {
          const template = await templateService.getTemplate(savedTemplateId);
          if (template) {
            setSelectedTemplate(template);
            return;
          }
        } catch (error) {
          console.error('Error restoring template:', error);
          // Clear invalid template ID from storage
          // Note: The invalid ID will be overwritten when a valid template is selected
        }
      }

      // If no saved template or error loading it, load default template
      try {
        const defaultTemplate = await templateService.getDefaultTemplate();
        if (defaultTemplate && defaultTemplate.id) {
          setSelectedTemplate(defaultTemplate);
          setSelectedTemplateId(defaultTemplate.id);
        }
      } catch (error) {
        console.error('Error loading default template:', error);
      }
    };
    restoreTemplate();
  }, [selectedTemplate]);

  // Listen for template changes from presentation mode (via localStorage)
  // This handles cross-tab synchronization
  useEffect(() => {
    const handleStorageChange = async (e: StorageEvent) => {
      if (e.key === 'selectedSessionTemplateId' && e.newValue) {
        try {
          const template = await templateService.getTemplate(e.newValue);
          if (template) {
            setSelectedTemplate(template);
          }
        } catch (error) {
          console.error('Error loading template from storage event:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Re-sync template when returning to the Live tab (handles same-tab navigation)
  useEffect(() => {
    const syncTemplateFromStorage = async () => {
      const savedTemplateId = getSelectedTemplateId();
      if (savedTemplateId && savedTemplateId !== selectedTemplate?.id) {
        try {
          const template = await templateService.getTemplate(savedTemplateId);
          if (template) {
            setSelectedTemplate(template);
          }
        } catch (error) {
          console.error('Error syncing template:', error);
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncTemplateFromStorage();
      }
    };

    const handleFocus = () => {
      syncTemplateFromStorage();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [selectedTemplate?.id]);

  const sessionItems = entries
    .map((entry) => {
      const song = songs.find((s) => s.id === entry.songId);
      if (!song) return null;
      const singer = entry.singerId ? singers.find((si) => si.id === entry.singerId) : undefined;
      return { entry, song, singer };
    })
    .filter(
      (item): item is { entry: (typeof entries)[number]; song: (typeof songs)[number]; singer?: (typeof singers)[number] } =>
        Boolean(item),
    );

  const handlePresentSession = () => {
    if (sessionItems.length === 0) return;
    // Template will be loaded from localStorage, no need to pass in URL
    navigate('/session/present');
  };

  const handleExportToPowerPoint = async () => {
    if (sessionItems.length === 0 || exporting) return;

    setExporting(true);

    try {
      // Fetch full song data with lyrics - same logic as SessionPresentationMode
      const songPromises = sessionItems.map(async ({ entry, song: cachedSong }) => {
        // Check if cached song has full details (lyrics are loaded)
        if (cachedSong && cachedSong.lyrics !== null && cachedSong.lyrics !== undefined) {
          return cachedSong;
        }
        // Fetch from API to get full details (includes CLOB fields like lyrics)
        return ApiClient.get<Song>(`/songs/${entry.songId}`);
      });
      const songsWithLyrics = await Promise.all(songPromises);

      // Build songs array with metadata - same as presentation mode
      const songsWithMetadata = sessionItems.map(({ entry, singer }, index) => {
        const song = songsWithLyrics[index];
        return {
          song,
          singerName: singer?.name,
          pitch: entry.pitch,
        };
      });

      // Generate slides using the same logic as presentation mode
      const slides = generateSessionPresentationSlides(songsWithMetadata, selectedTemplate);

      // Export to PowerPoint
      const exportName = currentSession?.name || 'Session';
      await pptxExportService.exportSession(slides, selectedTemplate, exportName);

      console.log('Session exported successfully');
    } catch (error) {
      console.error('Failed to export session:', error);
      alert('Failed to export session to PowerPoint. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleTemplateSelect = (template: PresentationTemplate) => {
    setSelectedTemplate(template);
    // Save selected template ID to localStorage for persistence
    if (template.id) {
      setSelectedTemplateId(template.id);
    }
  };

  const handlePreviewSong = (songId: string) => {
    const item = sessionItems.find(({ entry }) => entry.songId === songId);
    if (!item) {
      navigate(`/presentation/${songId}`);
      return;
    }

    const params = new URLSearchParams();
    if (item.singer?.name) {
      params.set('singerName', item.singer.name);
    }
    if (item.entry.pitch) {
      params.set('pitch', item.entry.pitch);
    }
    // Template will be loaded from localStorage, no need to pass in URL
    const query = params.toString();
    navigate(`/presentation/${songId}${query ? `?${query}` : ''}`);
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, fromIndex: number) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(fromIndex));
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, toIndex: number) => {
    e.preventDefault();
    const fromIndexRaw = e.dataTransfer.getData('text/plain');
    const fromIndex = parseInt(fromIndexRaw, 10);
    if (Number.isNaN(fromIndex) || fromIndex === toIndex) {
      return;
    }

    const order = sessionItems.map(({ entry }) => entry.songId);
    const [moved] = order.splice(fromIndex, 1);
    order.splice(toIndex, 0, moved);
    reorderSession(order);
  };

  const handleSaveSession = async () => {
    if (!sessionName.trim()) {
      alert('Please enter a session name');
      return;
    }

    setSaving(true);
    try {
      // Create the named session
      const newSession = await createSession({
        name: sessionName.trim(),
        description: sessionDescription.trim() || undefined,
        centerIds: sessionCenterIds,
      });

      if (!newSession) {
        return;
      }

      // Prepare session items from current session entries
      const items = sessionItems.map(({ entry, singer }) => ({
        songId: entry.songId,
        singerId: singer?.id,
        pitch: entry.pitch,
      }));

      // Save the items to the session
      await setSessionItems(newSession.id, items);

      // Reset form and close modal
      setSessionName('');
      setSessionDescription('');
      setSessionCenterIds([]);
      setShowSaveModal(false);
    } catch (error) {
      console.error('Error saving session:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleLoadSession = async (sessionId: string) => {
    setLoadingSession(true);
    setSessionToLoad(sessionId);
    try {
      await loadSession(sessionId);
    } catch (error) {
      console.error('Error loading session:', error);
      // Check if it's an access denied error
      if (error instanceof Error && error.message.includes('Access denied')) {
        alert('Access denied: You do not have permission to load this session.');
      } else {
        alert('Failed to load session. Please try again.');
      }
      setSessionToLoad(null);
      setLoadingSession(false);
    }
  };

  const handleRefreshSessions = async () => {
    try {
      await loadSessions();
    } catch (error) {
      console.error('Error refreshing sessions:', error);
    }
  };

  const handleDeleteSession = async (sessionId: string, sessionName: string) => {
    if (!window.confirm(`Are you sure you want to delete the session "${sessionName}"? This action cannot be undone.`)) {
      return;
    }

    setDeletingSessionId(sessionId);
    try {
      const success = await deleteSession(sessionId);
      if (success) {
        // Session was deleted successfully
        await loadSessions(); // Refresh the list
      } else {
        alert('Failed to delete session. Please try again.');
      }
    } catch (error) {
      console.error('Error deleting session:', error);
      alert('Failed to delete session. Please try again.');
    } finally {
      setDeletingSessionId(null);
    }
  };

  // Effect to handle loading session items into live session
  useEffect(() => {
    if (sessionToLoad && currentSession && currentSession.id === sessionToLoad && currentSession.items) {
      // Clear existing session first
      clearSession();

      // Load songs into the active session context
      currentSession.items.forEach(item => {
        // All authenticated users (editors and viewers) can see singer and pitch info
        // from sessions that belong to their centers
        addSong(item.songId, item.singerId, item.pitch);
      });

      setShowLoadModal(false);
      setLoadingSession(false);

      // Clear after successful load
      setSessionToLoad(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToLoad, currentSession]);


  // Mobile actions for bottom bar
  const mobileActions: MobileAction[] = [
    {
      label: 'Load',
      icon: 'fas fa-folder-open',
      onClick: () => setShowLoadModal(true),
      variant: 'secondary',
    },
    ...(isAuthenticated ? [{
      label: 'Save',
      icon: 'fas fa-save',
      onClick: () => setShowSaveModal(true),
      variant: 'primary' as const,
    }] : []),
    {
      label: 'Clear',
      icon: 'fas fa-trash-alt',
      onClick: clearSession,
      variant: 'secondary',
      disabled: sessionItems.length === 0,
    },
    {
      label: 'Present',
      icon: 'fas fa-play',
      onClick: handlePresentSession,
      variant: 'primary' as const,
      disabled: sessionItems.length === 0,
    },
    {
      label: 'Export',
      icon: 'fas fa-download',
      onClick: handleExportToPowerPoint,
      variant: 'secondary',
      disabled: exporting || sessionItems.length === 0,
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-1.5 sm:px-6 lg:px-8 py-2 sm:py-4 md:py-8">
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="min-w-60 flex-shrink">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Session</h1>
            <a
              href="/help#live"
              className="text-gray-400 hover:text-blue-600 dark:text-gray-500 dark:hover:text-blue-400 transition-colors"
              title="View help documentation for this tab"
            >
              <i className="fas fa-question-circle text-lg sm:text-xl"></i>
            </a>
          </div>
          <p className="hidden sm:block mt-2 text-sm text-gray-600 dark:text-gray-400">
            Build a set of songs to present together. Add songs from the Songs or Pitches tabs, then
            present them as a continuous slideshow.
          </p>
        </div>

        {/* Action buttons - Hidden on mobile, shown on desktop */}
        <div className="grid grid-cols-3 gap-2 w-full md:w-auto flex-shrink-0">
          {/* When session is empty, only show Load Session */}
          {sessionItems.length === 0 ? (
            <>
              {isAuthenticated && (
                <button
                  type="button"
                  onClick={() => setShowLoadModal(true)}
                  title="Load a previously saved session into this list"
                  className="hidden md:block min-h-[16px] sm:min-h-0 px-4 py-3 sm:py-2 text-sm font-medium text-gray-900 bg-yellow-400 rounded-lg sm:rounded-md hover:bg-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-500 transition-colors text-center flex items-center justify-center gap-1.5"
                >
                  <i className="fas fa-folder-open mr-2"></i>
                  Load
                </button>
              )}
            </>
          ) : (
            <>
              {/* Load Session */}
              {isAuthenticated && (
                <button
                  type="button"
                  onClick={() => setShowLoadModal(true)}
                  title="Load a previously saved session into this list"
                  className="hidden md:flex min-h-[16px] sm:min-h-0 px-3 sm:px-4 py-3 sm:py-2 text-sm font-medium text-gray-900 bg-yellow-400 rounded-lg sm:rounded-md hover:bg-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-500 transition-colors text-center flex items-center justify-center gap-1.5"
                >
                  <i className="fas fa-folder-open mr-1"></i>
                  <span>Load</span>
                </button>
              )}

              {/* Save Session (only for authenticated users) */}
              {isAuthenticated && (
                <button
                  type="button"
                  onClick={() => setShowSaveModal(true)}
                  title="Save the current session with all songs, singers, and pitches for later use"
                  className="hidden md:flex min-h-[16px] sm:min-h-0 px-3 sm:px-4 py-3 sm:py-2 text-sm font-medium text-white bg-blue-600 rounded-lg sm:rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors flex items-center justify-center gap-1.5"
                >
                  <i className="fas fa-save mr-1"></i>
                  <span>Save</span>
                </button>
              )}

              {/* Clear Session */}
              <button
                type="button"
                onClick={clearSession}
                title="Remove all songs from the current session"
                className="hidden md:flex min-h-[16px] sm:min-h-0 px-3 sm:px-4 py-3 sm:py-2 text-sm font-medium text-white bg-blue-600 rounded-lg sm:rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors flex items-center justify-center gap-1.5"
              >
                <i className="fas fa-trash-alt mr-1"></i>
                <span>Clear</span>
              </button>

              {/* Template */}
              <div className="hidden md:flex min-h-[16px] sm:min-h-0">
                <TemplateSelector onTemplateSelect={handleTemplateSelect} currentTemplateId={selectedTemplate?.id} />
              </div>

              {/* Present Session */}
              <div>
                <button
                  type="button"
                  onClick={handlePresentSession}
                  title="Start full-screen presentation with all songs in order"
                  className="w-full hidden md:flex min-h-[16px] sm:min-h-0 px-3 sm:px-4 py-3 sm:py-2 text-sm font-medium text-white bg-blue-600 rounded-lg sm:rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors flex items-center justify-center gap-1.5"
                >
                  <i className="fas fa-play"></i>
                  <span>Present</span>
                </button>
              </div>

              {/* Export to PowerPoint */}
              <div>
                <button
                  type="button"
                  onClick={handleExportToPowerPoint}
                  disabled={exporting}
                  title="Export session to PowerPoint file with all song slides"
                  className="w-full hidden md:flex min-h-[16px] sm:min-h-0 px-3 sm:px-4 py-3 sm:py-2 text-sm font-medium text-white bg-blue-600 rounded-lg sm:rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors flex items-center justify-center gap-1.5"
                >
                  <i className={`fas ${exporting ? 'fa-spinner fa-spin' : 'fa-download'}`}></i>
                  <span>{exporting ? 'Exporting...' : 'Export'}</span>
                </button>
              </div>
            </>
          )}
        </div>
        {/* Template selector for mobile - shown above bottom bar */}
        <div className="md:hidden w-full">
          <TemplateSelector onTemplateSelect={handleTemplateSelect} currentTemplateId={selectedTemplate?.id} />
        </div>
      </div>

      {/* Session song count */}
      {sessionItems.length > 0 && (
        <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          {sessionItems.length} song{sessionItems.length !== 1 ? 's' : ''} in session
        </div>
      )}

      {sessionItems.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">
            No songs in the session yet. Use the <span className="font-semibold">Add to Session</span>{' '}
            buttons in the Songs or Pitches tabs to build your set list.
          </p>
        </div>
      ) : (
        <div className="space-y-0 md:space-y-3">
          {sessionItems.map(({ entry, song, singer }, index) => {
            const itemKey = `${entry.songId}-${entry.singerId ?? 'none'}`;
            const isSelected = selectedSessionItemKey === itemKey;
            return (
              <div
                key={itemKey}
                onClick={() => {
                  // On mobile, toggle selection on row click
                  if (isMobile) {
                    setSelectedSessionItemKey(isSelected ? null : itemKey);
                  }
                }}
                className={`bg-white dark:bg-gray-800 p-2 md:p-4 transition-all duration-200 ${
                  isMobile 
                    ? `cursor-pointer ${index > 0 ? 'border-t border-gray-300 dark:border-gray-600' : ''} ${
                        isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                      }`
                    : `border rounded-lg shadow-md hover:shadow-lg cursor-move ${
                        isSelected
                          ? 'border-blue-500 dark:border-blue-400 ring-2 ring-blue-200 dark:ring-blue-800'
                          : 'border-gray-200 dark:border-gray-700'
                      }`
                }`}
                draggable={!isMobile}
                onDragStart={(e) => !isMobile && handleDragStart(e, index)}
                onDragOver={(e) => !isMobile && e.preventDefault()}
                onDrop={(e) => !isMobile && handleDrop(e, index)}
              >
                <div className="flex flex-col gap-1.5 md:gap-3">
                  {/* Header with song number */}
                  <div className="flex items-start gap-1.5 md:gap-3">
                    <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-full font-bold text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      {/* Song Metadata Section - Reusable component */}
                      <SongMetadataCard
                        song={song}
                        onNameClick={isMobile ? undefined : () => handlePreviewSong(song.id)}
                        nameClickTitle={isMobile ? undefined : song.name}
                        showBackground={!isMobile}
                        isSelected={isSelected}
                        alwaysShowDeityLanguage={true}
                        onPreviewClick={() => handlePreviewSong(song.id)}
                      />

                      {/* Singer and Pitch */}
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {singer && (
                          <>
                            <span className="hidden md:inline font-medium">Singer: </span>
                            <span className={`font-bold text-base ${singer.gender?.toLowerCase() === 'male'
                              ? 'text-blue-600 dark:text-blue-400'
                              : singer.gender?.toLowerCase() === 'boy'
                                ? 'text-blue-400 dark:text-blue-300'
                                : singer.gender?.toLowerCase() === 'female'
                                  ? 'text-pink-600 dark:text-pink-400'
                                  : singer.gender?.toLowerCase() === 'girl'
                                    ? 'text-pink-400 dark:text-pink-300'
                                    : 'text-gray-600 dark:text-gray-400'
                              }`}>
                              {singer.name}
                            </span>
                            <span className="mx-2">•</span>
                          </>
                        )}
                        {entry.pitch && (
                          <>
                            <span className="hidden md:inline">Pitch: </span>
                            <span className="font-bold text-gray-700 dark:text-gray-200">{formatNormalizedPitch(entry.pitch)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action buttons - Icon-only on mobile, text on desktop - Hidden on mobile until row is selected */}
                  <div className={`flex flex-wrap items-center gap-1.5 sm:gap-2 pt-1 md:pt-3 md:border-t md:border-gray-200 md:dark:border-gray-700 ml-11 ${isMobile && !isSelected ? 'hidden' : ''}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {song.externalSourceUrl && (
                      <a
                        href={song.externalSourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="View song on external source (YouTube, etc.)"
                        className="min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center sm:justify-start gap-2 p-2.5 sm:p-2 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg sm:rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors"
                      >
                        <i className="fas fa-external-link-alt text-lg text-blue-600 dark:text-blue-400"></i>
                        <span className="hidden sm:inline text-sm font-medium whitespace-nowrap">External URL</span>
                      </a>
                    )}
                    <button
                      onClick={() => removeSong(entry.songId, entry.singerId)}
                      title="Remove"
                      className="min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center sm:justify-start gap-2 p-2.5 sm:p-2 rounded-lg sm:rounded-md text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors"
                    >
                      <i className="fas fa-times text-lg text-red-600 dark:text-red-400"></i>
                      <span className="hidden sm:inline text-sm font-medium whitespace-nowrap">Remove</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {viewingSong && (
        <Modal
          isOpen={!!viewingSong}
          onClose={() => setViewingSong(null)}
          title="Song Details"
        >
          <SongDetails song={viewingSong} />
        </Modal>
      )}

      {/* Save Session Modal */}
      <Modal
        isOpen={showSaveModal}
        onClose={() => {
          setShowSaveModal(false);
          setSessionName('');
          setSessionDescription('');
          setSessionCenterIds([]);
        }}
        title="Save Session"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Save the current session ({sessionItems.length} {sessionItems.length === 1 ? 'song' : 'songs'})
            as a named session for easy reuse later.
          </p>

          <div>
            <label htmlFor="session-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Session Name *
            </label>
            <input
              id="session-name"
              type="text"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder="e.g., Sunday Bhajans, Festival Songs"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              disabled={saving}
            />
          </div>

          <div>
            <label htmlFor="session-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description (optional)
            </label>
            <textarea
              id="session-description"
              value={sessionDescription}
              onChange={(e) => setSessionDescription(e.target.value)}
              placeholder="Add notes about this session..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              disabled={saving}
            />
          </div>

          <div>
            <CenterMultiSelect
              selectedCenterIds={sessionCenterIds}
              onChange={setSessionCenterIds}
              label="Restrict to Centers (optional)"
              disabled={saving}
              editableOnly={true}
            />
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <button
              type="button"
              onClick={() => {
                setShowSaveModal(false);
                setSessionName('');
                setSessionDescription('');
                setSessionCenterIds([]);
              }}
              disabled={saving}
              className="px-4 py-2 text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveSession}
              disabled={saving || !sessionName.trim()}
              className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Save Session'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Load Session Modal */}
      <Modal
        isOpen={showLoadModal}
        onClose={() => setShowLoadModal(false)}
        title="Load Session"
        titleActions={
          <button
            onClick={handleRefreshSessions}
            disabled={loading}
            className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:opacity-50"
            title="Refresh sessions"
            aria-label="Refresh sessions"
          >
            <i className={`fas fa-redo text-lg ${loading ? 'animate-spin' : ''}`}></i>
          </button>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Select a saved session to load into your current live session. This will replace any songs currently in the live session.
          </p>

          {/* Session count */}
          {sessions.length > 0 && (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {sessions.length} saved session{sessions.length !== 1 ? 's' : ''}
            </div>
          )}

          {sessions.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No saved sessions found. Save your current session to create one.
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto space-y-2">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center gap-2 p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group"
                >
                  <button
                    onClick={() => handleLoadSession(session.id)}
                    disabled={loadingSession || deletingSessionId === session.id}
                    className="flex-1 text-left disabled:opacity-50"
                  >
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {session.name}
                    </div>
                    {session.description && (
                      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {session.description}
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        Created: {new Date(session.createdAt).toLocaleString()}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        Updated: {new Date(session.updatedAt).toLocaleString()}
                      </span>
                      <CenterBadges centerIds={session.centerIds || []} showAllIfEmpty={true} />
                    </div>
                  </button>

                  {isAuthenticated && (userRole !== 'viewer' || session.created_by === userEmail) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSession(session.id, session.name);
                      }}
                      disabled={deletingSessionId === session.id || loadingSession}
                      className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors disabled:opacity-50 opacity-0 group-hover:opacity-100 focus:opacity-100"
                      title="Delete session"
                      aria-label={`Delete ${session.name}`}
                    >
                      {deletingSessionId === session.id ? (
                        <i className="fas fa-spinner text-lg animate-spin"></i>
                      ) : (
                        <i className="fas fa-trash text-lg"></i>
                      )}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 justify-end pt-4 border-t dark:border-gray-600">
            <button
              type="button"
              onClick={() => setShowLoadModal(false)}
              disabled={loadingSession}
              className="px-4 py-2 text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
            >
              {loadingSession ? 'Loading...' : 'Cancel'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Mobile Bottom Action Bar - Always show so users can access Load button */}
      <MobileBottomActionBar
        actions={mobileActions}
      />
    </div>
  );
};




