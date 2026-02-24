import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '../../contexts/SessionContext';
import { useSongs } from '../../contexts/SongContext';
import { useSingers } from '../../contexts/SingerContext';
import { useNamedSessions } from '../../contexts/NamedSessionContext';
import { useAuth } from '../../contexts/AuthContext';
import { useUserPreferences } from '../../contexts/UserPreferencesContext';
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
import { getSelectedTemplateId, setSelectedTemplateId, CACHE_KEYS } from '../../utils/cacheUtils';
import { buildSessionCsv, parseSessionCsv, downloadCsv } from '../../utils/sessionCsvUtils';

const SESSION_SCROLL_POSITION_KEY = 'saiSongs:sessionScrollPosition';

export const SessionManager: React.FC = () => {
  const location = useLocation();
  const { entries, removeSong, clearSession, reorderSession, addSong } = useSession();
  const { songs, fetchSongs, getSongById } = useSongs();
  const { singers, fetchSingers } = useSingers();
  const { sessions, createSession, setSessionItems, loadSession, currentSession, loadSessions, loading, deleteSession } = useNamedSessions();
  const { isEditor, isAuthenticated, userEmail, userRole } = useAuth();
  const { showSongDetailsInDesktop } = useUserPreferences();
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
  const [selectedSessionItemKeys, setSelectedSessionItemKeys] = useState<Set<string>>(new Set());
  const selectionAnchorKeyRef = React.useRef<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [importingCsv, setImportingCsv] = useState(false);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [draggingIndices, setDraggingIndices] = useState<number[]>([]);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragOverBlockCard, setDragOverBlockCard] = useState(false);
  const [movedOutOfBlock, setMovedOutOfBlock] = useState(false);
  const [previewFirstPosition, setPreviewFirstPosition] = useState<number | null>(null);
  const listContainerRef = React.useRef<HTMLDivElement | null>(null);
  const csvFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const scrollToItemKeyRef = React.useRef<string | null>(null);
  const scrollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastDragYRef = useRef<number>(0);
  const [dragPreviewPos, setDragPreviewPos] = useState<{ x: number; y: number } | null>(null);
  const [positionEdit, setPositionEdit] = useState<{ itemKey: string; value: string } | null>(null);

  const SCROLL_ZONE = 80;
  const SCROLL_SPEED = 12;

  // Auto-scroll when dragging near top/bottom of viewport
  useEffect(() => {
    if (draggingIndex === null) {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
        scrollIntervalRef.current = null;
      }
      return;
    }

    const scroll = () => {
      const y = lastDragYRef.current;
      const zone = SCROLL_ZONE;
      const viewportHeight = window.innerHeight;
      const isMobileView = window.innerWidth < 768;

      let delta = 0;
      if (y < zone) {
        delta = -SCROLL_SPEED * (1 - y / zone);
      } else if (y > viewportHeight - zone) {
        delta = SCROLL_SPEED * (1 - (viewportHeight - y) / zone);
      }

      if (delta === 0) return;

      if (isMobileView && listContainerRef.current) {
        const el = listContainerRef.current;
        el.scrollTop = Math.max(0, Math.min(el.scrollHeight - el.clientHeight, el.scrollTop + delta));
      } else {
        window.scrollTo({ top: Math.max(0, window.scrollY + delta), behavior: 'auto' });
      }
    };

    const handleDocumentDragOver = (e: DragEvent) => {
      e.preventDefault();
      lastDragYRef.current = e.clientY;
      setDragPreviewPos({ x: e.clientX, y: e.clientY });
      const y = e.clientY;
      const zone = SCROLL_ZONE;
      const viewportHeight = window.innerHeight;
      const inZone = y < zone || y > viewportHeight - zone;

      if (inZone && !scrollIntervalRef.current) {
        scrollIntervalRef.current = setInterval(scroll, 16);
      } else if (!inZone && scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
        scrollIntervalRef.current = null;
      }

      // Use elementsFromPoint to find the card under cursor - ensures "about to drop" updates
      // even when dragover fires on block cards (e.g. cursor over dragged cards)
      const elements = document.elementsFromPoint(e.clientX, e.clientY);
      const topEl = elements[0];
      const cardEl =
        topEl?.closest?.('[id^="session-card-"]') ??
        elements.find((el) => el.id?.startsWith('session-card-'));
      if (cardEl) {
        const itemKey = cardEl.id.replace('session-card-', '');
        const displayItems = displayItemsRef.current;
        const sessionItems = sessionItemsRef.current;
        const getItemKey = getItemKeyRef.current;
        const displayIndex = displayItems.findIndex((d) => d != null && getItemKey(d.entry) === itemKey);
        const originalIndex = sessionItems.findIndex((s) => s != null && getItemKey(s.entry) === itemKey);
        if (displayIndex >= 0 && originalIndex >= 0) {
          applyDragOverTargetRef.current(displayIndex, originalIndex, itemKey);
        }
      }
    };

    document.addEventListener('dragover', handleDocumentDragOver);
    return () => {
      document.removeEventListener('dragover', handleDocumentDragOver);
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
        scrollIntervalRef.current = null;
      }
    };
  }, [draggingIndex]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Prevent body scroll on mobile when on live tab
  useEffect(() => {
    if (isMobile && window.location.pathname === '/admin/live') {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isMobile]);

  // Track scroll position for scroll-to-top button
  useEffect(() => {
    if (!isMobile || !listContainerRef.current) return;

    const container = listContainerRef.current;
    const handleScroll = () => {
      setShowScrollToTop(container.scrollTop > 200);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [isMobile]);

  const scrollToTop = () => {
    if (listContainerRef.current) {
      listContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Save and restore scroll position (mobile: list container, desktop: window)
  useEffect(() => {
    // Restore scroll position when component mounts
    if (typeof window !== 'undefined' && (location.pathname === '/session' || location.pathname === '/admin/live')) {
      try {
        const savedScrollPosition = sessionStorage.getItem(SESSION_SCROLL_POSITION_KEY);
        if (savedScrollPosition) {
          const scrollTop = parseInt(savedScrollPosition, 10);
          if (!isNaN(scrollTop)) {
            // Wait for container to be ready, especially on mobile
            const restoreScroll = () => {
              if (isMobile && listContainerRef.current) {
                listContainerRef.current.scrollTop = scrollTop;
              } else {
                window.scrollTo({ top: scrollTop, behavior: 'instant' });
              }
            };
            
            // Try immediately, then retry if container not ready
            if (isMobile && !listContainerRef.current) {
              // Wait for container to be ready
              const checkInterval = setInterval(() => {
                if (listContainerRef.current) {
                  clearInterval(checkInterval);
                  restoreScroll();
                }
              }, 50);
              // Give up after 2 seconds
              setTimeout(() => clearInterval(checkInterval), 2000);
            } else {
              setTimeout(restoreScroll, 50);
            }
          }
        }
      } catch (error) {
        console.warn('Failed to restore scroll position:', error);
      }
    }
  }, [isMobile, location.pathname]); // Run when mobile state or path changes

  // Save scroll position when navigating away
  useEffect(() => {
    const handleScroll = () => {
      if (typeof window !== 'undefined' && (location.pathname === '/session' || location.pathname === '/admin/live')) {
        try {
          const scrollTop = isMobile && listContainerRef.current
            ? listContainerRef.current.scrollTop
            : window.scrollY;
          sessionStorage.setItem(SESSION_SCROLL_POSITION_KEY, String(scrollTop));
        } catch (error) {
          console.warn('Failed to save scroll position:', error);
        }
      }
    };

    // Save scroll position periodically while on session tab
    const scrollInterval = setInterval(handleScroll, 500); // Save every 500ms

    // Also save on scroll events (throttled)
    let scrollTimeout: NodeJS.Timeout;
    const throttledScroll = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(handleScroll, 100);
    };

    const container = listContainerRef.current;
    
    if (isMobile && container) {
      container.addEventListener('scroll', throttledScroll, { passive: true });
    } else {
      window.addEventListener('scroll', throttledScroll, { passive: true });
    }

    // Save scroll position on unmount or when navigating away
    return () => {
      clearInterval(scrollInterval);
      if (isMobile && container) {
        container.removeEventListener('scroll', throttledScroll);
      } else {
        window.removeEventListener('scroll', throttledScroll);
      }
      if (location.pathname === '/session' || location.pathname === '/admin/live') {
        handleScroll(); // Final save
      }
    };
  }, [location.pathname, isMobile]);

  // Fetch songs on mount (public data)
  // Fetch singers only when authenticated (protected data)
  useEffect(() => {
    fetchSongs();
    if (isAuthenticated) {
      fetchSingers();
    }
  }, [fetchSongs, fetchSingers, isAuthenticated]);

  // When returning from Present: templateId is passed via location.state (reliable, no localStorage)
  const templateIdFromState = (location.state as { templateId?: string } | null)?.templateId;
  useEffect(() => {
    if (!templateIdFromState) return;
    let cancelled = false;
    templateService.getTemplate(templateIdFromState).then((template) => {
      if (!cancelled && template?.id) {
        setSelectedTemplate(template);
        setSelectedTemplateId(template.id);
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [templateIdFromState]);

  // Restore previously selected template from localStorage (initial load, or when no state passed)
  useEffect(() => {
    const restoreTemplate = async () => {
      if (selectedTemplate) return;
      if (templateIdFromState) return; // state takes precedence, wait for it

      const savedTemplateId = await getSelectedTemplateId();
      if (savedTemplateId) {
        try {
          const template = await templateService.getTemplate(savedTemplateId);
          if (template?.id) {
            setSelectedTemplate(template);
            setSelectedTemplateId(template.id); // reinforce in storage
            return;
          }
        } catch (error) {
          console.error('Error restoring template:', error);
          return;
        }
      }

      try {
        const defaultTemplate = await templateService.getDefaultTemplate();
        if (defaultTemplate?.id) {
          setSelectedTemplate(defaultTemplate);
          setSelectedTemplateId(defaultTemplate.id);
        }
      } catch (error) {
        console.error('Error loading default template:', error);
      }
    };
    restoreTemplate();
  }, [selectedTemplate, templateIdFromState]);

  // Listen for template changes from presentation mode (via localStorage)
  // This handles cross-tab synchronization
  useEffect(() => {
    const handleStorageChange = async (e: StorageEvent) => {
      if (e.key === CACHE_KEYS.SELECTED_SESSION_TEMPLATE_ID && e.newValue) {
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

  // Sync from storage when navigating back to Live (e.g. from Songs, Help, or other app tabs)
  useEffect(() => {
    if (location.pathname !== '/session' && location.pathname !== '/admin/live') return;
    if (templateIdFromState) return; // state takes precedence
    let cancelled = false;
    getSelectedTemplateId().then((savedTemplateId) => {
      if (cancelled || !savedTemplateId) return;
      templateService.getTemplate(savedTemplateId).then((template) => {
        if (!cancelled && template?.id) {
          setSelectedTemplate(template);
          setSelectedTemplateId(template.id);
        }
      }).catch(() => {});
    });
    return () => { cancelled = true; };
  }, [location.pathname, templateIdFromState]);

  // Re-sync template when returning to the Live tab (browser tab visibility)
  // visibilitychange/focus fire when switching browser tabs
  useEffect(() => {
    const syncTemplateFromStorage = async () => {
      const savedTemplateId = await getSelectedTemplateId();
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

  // Persist template when navigating away (e.g. to Present) so it's restored on return
  // Use ref so cleanup only runs on unmount, not when template changes (which caused flickering)
  const selectedTemplateIdForUnmountRef = useRef<string | undefined>(selectedTemplate?.id);
  selectedTemplateIdForUnmountRef.current = selectedTemplate?.id;
  useEffect(() => {
    return () => {
      const id = selectedTemplateIdForUnmountRef.current;
      if (id) setSelectedTemplateId(id);
    };
  }, []);

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

  const getEntryKey = (entry: { songId: string; singerId?: string }) =>
    `${entry.songId}|${entry.singerId ?? 'none'}`;
  const getItemKey = (entry: { songId: string; singerId?: string }) =>
    `${entry.songId}-${entry.singerId ?? 'none'}`;

  // Scroll moved card into view after reorder
  useEffect(() => {
    const itemKey = scrollToItemKeyRef.current;
    if (!itemKey) return;
    scrollToItemKeyRef.current = null;
    setSelectedSessionItemKeys(new Set([itemKey]));
    requestAnimationFrame(() => {
      const el = document.getElementById(`session-card-${itemKey}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }, [sessionItems]);

  const handlePresentSession = () => {
    if (sessionItems.length === 0) return;
    // Persist template synchronously before navigating so it's restored when returning
    if (selectedTemplate?.id) {
      setSelectedTemplateId(selectedTemplate.id);
    }
    navigate('/session/present');
  };

  const handleExportToPowerPoint = async () => {
    if (sessionItems.length === 0 || exporting) return;

    setExporting(true);

    try {
      // Use getSongById (cache-first, offline-aware) - same as SessionPresentationMode
      const songPromises = sessionItems.map(async ({ entry, song: cachedSong }) => {
        if (cachedSong && cachedSong.lyrics !== null && cachedSong.lyrics !== undefined) {
          return cachedSong;
        }
        return getSongById(entry.songId);
      });
      const songsWithLyrics = await Promise.all(songPromises);

      // Build songs array with metadata - same as presentation mode
      const songsWithMetadata = sessionItems.map(({ entry, singer }, index) => {
        const song = songsWithLyrics[index];
        return {
          song,
          singerName: singer?.name,
          singerGender: singer?.gender,
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

  const handleExportCsv = () => {
    if (sessionItems.length === 0) return;
    const items = sessionItems.map(({ entry, song, singer }) => ({
      songId: entry.songId,
      songName: song.name,
      singerId: singer?.id ?? '',
      singerName: singer?.name ?? '',
      pitch: entry.pitch ?? '',
    }));
    const csv = buildSessionCsv(items);
    const filename = `session-${new Date().toISOString().slice(0, 10)}.csv`;
    downloadCsv(filename, csv);
  };

  const handleImportCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // Reset so same file can be selected again

    setImportingCsv(true);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result as string;
        const rows = parseSessionCsv(text);
        if (rows.length === 0) {
          alert('No valid rows found in CSV. Expected columns: songId, songName, singerId, singerName, pitch');
          setImportingCsv(false);
          return;
        }

        if (sessionItems.length > 0 && !window.confirm('Import will replace your current session. Continue?')) {
          setImportingCsv(false);
          return;
        }

        clearSession();
        let added = 0;
        let skipped = 0;
        const songByName = new Map(songs.map((s) => [s.name.toLowerCase().trim(), s]));
        const singerByName = new Map(singers.map((s) => [s.name.toLowerCase().trim(), s]));

        for (const row of rows) {
          let songId = row.songId?.trim();
          if (!songId && row.songName?.trim()) {
            const song = songByName.get(row.songName.toLowerCase().trim());
            songId = song?.id ?? '';
          }
          if (!songId) {
            skipped++;
            continue;
          }

          let singerId: string | undefined;
          if (row.singerId?.trim()) {
            singerId = singers.some((s) => s.id === row.singerId) ? row.singerId : undefined;
          }
          if (!singerId && row.singerName?.trim()) {
            singerId = singerByName.get(row.singerName.toLowerCase().trim())?.id;
          }

          addSong(songId, singerId, row.pitch?.trim() || undefined);
          added++;
        }

        setImportingCsv(false);
        if (skipped > 0) {
          alert(`Imported ${added} songs. ${skipped} rows skipped (song not found).`);
        }
      } catch (err) {
        console.error('Failed to import CSV:', err);
        alert('Failed to import CSV. Please check the file format.');
        setImportingCsv(false);
      }
    };
    reader.readAsText(file, 'UTF-8');
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
    const params = new URLSearchParams();
    params.set('closeOnExit', '1');
    if (item) {
      if (item.singer?.name) {
        params.set('singerName', item.singer.name);
      }
      if (item.entry.pitch) {
        params.set('pitch', item.entry.pitch);
      }
    }
    const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
    const path = `${base}/presentation/${songId}`.replace(/\/\/+/g, '/');
    window.open(`${window.location.origin}${path}?${params.toString()}`, '_blank', 'noopener,noreferrer');
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, fromIndex: number) => {
    e.dataTransfer.effectAllowed = 'move';
    const itemKey = getItemKey(sessionItems[fromIndex].entry);
    const indicesToMove = selectedSessionItemKeys.has(itemKey)
      ? sessionItems
          .map((s, i) => (selectedSessionItemKeys.has(getItemKey(s.entry)) ? i : -1))
          .filter((i) => i >= 0)
      : [fromIndex];
    e.dataTransfer.setData('text/plain', JSON.stringify(indicesToMove));
    const minIdx = Math.min(...indicesToMove);
    const maxIdx = Math.max(...indicesToMove);
    setDraggingIndex(fromIndex);
    setDraggingIndices(indicesToMove);
    setDragOverIndex(fromIndex);
    setDragOverBlockCard(indicesToMove.length > 1);
    setMovedOutOfBlock(false);
    setPreviewFirstPosition(indicesToMove.length > 1 ? minIdx : null);
    setDragPreviewPos({ x: e.clientX, y: e.clientY });
    console.log('[DragStart]', {
      cursor: { x: e.clientX, y: e.clientY },
      fromIndex,
      indicesToMove,
      originalFirstSelectedCardIndex: minIdx,
      originalLastSelectedCardIndex: maxIdx,
    });
    const img = new Image();
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    e.dataTransfer.setDragImage(img, 0, 0);
  };

  const handleDragEnd = () => {
    console.log('[DragEnd]');
    setDraggingIndex(null);
    setDraggingIndices([]);
    setDragOverIndex(null);
    setDragOverBlockCard(false);
    setMovedOutOfBlock(false);
    setPreviewFirstPosition(null);
    setDragPreviewPos(null);
  };

  const lastDragDebugRef = useRef<{ displayIndex: number; originalIndex: number; t: number } | null>(null);

  const applyDragOverTarget = useCallback(
    (displayIndex: number, originalIndex: number, hoveredItemKey: string) => {
      if (draggingIndex === null) return;
      const indices = draggingIndices.length > 0 ? draggingIndices : [draggingIndex];
      const minIdx = Math.min(...indices);
      const maxIdx = Math.max(...indices);
      const blockSize = indices.length;
      const draggingKeys = indices.map((i) => getItemKey(sessionItems[i].entry));
      const isOverBlockCard = draggingKeys.includes(hoveredItemKey);
      const cursorIndex = displayIndex;

      const computedFirstPos =
        indices.length > 1
          ? isOverBlockCard
            ? minIdx
            : cursorIndex > minIdx
              ? cursorIndex - minIdx + 1
              : Math.max(0, cursorIndex)
          : null;

      if (indices.length > 1) {
        if (isOverBlockCard) {
          setDragOverBlockCard(true);
          setPreviewFirstPosition(minIdx);
          return;
        }
        setDragOverBlockCard(false);
        if (!movedOutOfBlock) setMovedOutOfBlock(true);
        setPreviewFirstPosition(computedFirstPos);
      }

      const targetIndex =
        indices.length > 1 && originalIndex < minIdx ? displayIndex : indices.length > 1 ? originalIndex : displayIndex;
      if (targetIndex === dragOverIndex) return;
      setDragOverIndex(targetIndex);
    },
    [
      draggingIndex,
      draggingIndices,
      sessionItems,
      movedOutOfBlock,
      dragOverIndex,
      getItemKey,
    ]
  );

  const applyDragOverTargetRef = useRef(applyDragOverTarget);
  applyDragOverTargetRef.current = applyDragOverTarget;

  const handleDragOver = (
    e: React.DragEvent<HTMLDivElement>,
    displayIndex: number,
    originalIndex: number,
    hoveredItemKey: string
  ) => {
    e.preventDefault();
    if (draggingIndex === null) return;
    applyDragOverTargetRef.current(displayIndex, originalIndex, hoveredItemKey);
  };

  const handleListContainerDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (draggingIndex === null) return;
    const elements = document.elementsFromPoint(e.clientX, e.clientY);
    const topEl = elements[0];
    const cardEl =
      topEl?.closest?.('[id^="session-card-"]') ??
      elements.find((el) => el.id?.startsWith('session-card-'));
    if (cardEl) {
      const itemKey = cardEl.id.replace('session-card-', '');
      const displayItems = displayItemsRef.current;
      const sessionItems = sessionItemsRef.current;
      const getItemKey = getItemKeyRef.current;
      const displayIndex = displayItems.findIndex((d) => d != null && getItemKey(d.entry) === itemKey);
      const originalIndex = sessionItems.findIndex((s) => s != null && getItemKey(s.entry) === itemKey);
      if (displayIndex >= 0 && originalIndex >= 0) {
        applyDragOverTargetRef.current(displayIndex, originalIndex, itemKey);
      }
    }
  };

  const handleDrop = (
    e: React.DragEvent<HTMLDivElement>,
    displayIndex: number,
    originalIndex: number
  ) => {
    e.preventDefault();
    let indicesToMove: number[];
    try {
      const parsed = JSON.parse(e.dataTransfer.getData('text/plain'));
      indicesToMove = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      const raw = e.dataTransfer.getData('text/plain');
      const single = parseInt(raw, 10);
      indicesToMove = Number.isNaN(single) ? [] : [single];
    }
    if (indicesToMove.length === 0) {
      setDraggingIndex(null);
      setDragOverIndex(null);
      setDragOverBlockCard(false);
      setMovedOutOfBlock(false);
      setPreviewFirstPosition(null);
      return;
    }
    const sortedIndices = [...indicesToMove].sort((a, b) => a - b);
    const minIdx = sortedIndices[0];
    const maxIdx = sortedIndices[sortedIndices.length - 1];
    const order = sessionItems.map(({ entry }) => getEntryKey(entry));
    const movedKeys = sortedIndices.map((i) => order[i]);
    const remaining = order.filter((_, i) => !sortedIndices.includes(i));
    let insertAt: number;
    if (indicesToMove.length > 1) {
      // Multi-select: full move to drop target (match preview)
      const blockSize = sortedIndices.length;
      if (displayIndex <= minIdx) {
        insertAt = Math.max(0, displayIndex);
      } else if (displayIndex > maxIdx) {
        insertAt = Math.max(0, Math.min(displayIndex - blockSize + 1, remaining.length));
      } else {
        // Over a block card: insertAt = displayIndex (block stays or moves based on which card)
        insertAt = Math.max(0, Math.min(displayIndex, remaining.length));
      }
      // Only skip when first card would drop back to its original position
      if (insertAt === minIdx) {
        setDraggingIndex(null);
        setDragOverIndex(null);
        setDragOverBlockCard(false);
        setMovedOutOfBlock(false);
        setPreviewFirstPosition(null);
        return;
      }
    } else {
      const toIndex = displayIndex;
      if (sortedIndices.every((i) => i === toIndex)) {
        setDraggingIndex(null);
        setDragOverIndex(null);
        setDragOverBlockCard(false);
        setMovedOutOfBlock(false);
        setPreviewFirstPosition(null);
        return;
      }
      insertAt = Math.min(toIndex, remaining.length);
    }
    const newOrder = [...remaining.slice(0, insertAt), ...movedKeys, ...remaining.slice(insertAt)];
    reorderSession(newOrder);
    scrollToItemKeyRef.current = getItemKey(sessionItems[sortedIndices[0]].entry);
    setDraggingIndex(null);
    setDragOverIndex(null);
    setDragOverBlockCard(false);
    setMovedOutOfBlock(false);
    setPreviewFirstPosition(null);
  };

  // Preview order when dragging: show what the list will look like if dropped at dragOverIndex
  const displayItems = useMemo(() => {
    if (draggingIndex === null || dragOverIndex === null || draggingIndex === dragOverIndex) {
      return sessionItems;
    }
    const indicesToMove = draggingIndices.length > 0 ? draggingIndices : [draggingIndex];
    const sorted = [...indicesToMove].sort((a, b) => a - b);
    const minIdx = sorted[0];
    const maxIdx = sorted[sorted.length - 1];
    const indices = sessionItems.map((_, i) => i);
    const moved = [...sorted];
    [...sorted].reverse().forEach((i) => {
      const pos = indices.indexOf(i);
      if (pos >= 0) indices.splice(pos, 1);
    });
    let insertAt: number;
    if (indicesToMove.length > 1) {
      // Multi-select: preview shows block at hover target (full drag-to-target)
      const blockSize = sorted.length;
      if (dragOverIndex < minIdx) {
        insertAt = Math.max(0, dragOverIndex);
      } else if (dragOverIndex > maxIdx) {
        // Block goes just above the hovered card: insert after (dragOverIndex - blockSize) items
        insertAt = Math.max(0, Math.min(dragOverIndex - blockSize + 1, indices.length));
      } else {
        return sessionItems; // Within block: no preview change
      }
    } else {
      insertAt = Math.min(dragOverIndex, indices.length);
    }
    indices.splice(insertAt, 0, ...moved);
    return indices.map((i) => sessionItems[i]);
  }, [sessionItems, draggingIndex, draggingIndices, dragOverIndex]);

  const displayItemsRef = useRef(displayItems);
  const sessionItemsRef = useRef(sessionItems);
  const getItemKeyRef = useRef(getItemKey);
  displayItemsRef.current = displayItems;
  sessionItemsRef.current = sessionItems;
  getItemKeyRef.current = getItemKey;

  // Would-be positions for drag preview (user algorithm: FirstSelectedCardIndex = card under cursor when outside or moved back in)
  const dragPreviewNumbers = useMemo(() => {
    const indices = draggingIndices.length > 0 ? draggingIndices : (draggingIndex !== null ? [draggingIndex] : []);
    if (indices.length === 0) return [1];
    const sorted = [...indices].sort((a, b) => a - b);
    const minIdx = sorted[0] ?? 0;
    const blockSize = sorted.length;
    if (draggingIndex === null || (blockSize === 1 && draggingIndex === dragOverIndex)) {
      return indices.map((i) => i + 1);
    }
    // Multi-select: use previewFirstPosition (FirstSelectedCardIndex from user algorithm)
    const insertAt =
      blockSize > 1 && previewFirstPosition !== null
        ? previewFirstPosition
        : dragOverIndex !== null
          ? Math.min(dragOverIndex, sessionItems.length - 1)
          : minIdx;
    return Array.from({ length: blockSize }, (_, i) => insertAt + i + 1);
  }, [sessionItems.length, draggingIndex, dragOverIndex, previewFirstPosition, draggingIndices]);

  const getSelectedIndices = (index: number) => {
    const itemKey = getItemKey(sessionItems[index].entry);
    return selectedSessionItemKeys.has(itemKey)
      ? sessionItems
          .map((s, i) => (selectedSessionItemKeys.has(getItemKey(s.entry)) ? i : -1))
          .filter((i) => i >= 0)
          .sort((a, b) => a - b)
      : [index];
  };

  const handleMoveUp = (index: number) => {
    const indices = getSelectedIndices(index);
    const minIdx = Math.min(...indices);
    if (minIdx <= 0) return;
    const order = sessionItems.map(({ entry }) => getEntryKey(entry));
    for (const i of indices) {
      [order[i - 1], order[i]] = [order[i], order[i - 1]];
    }
    reorderSession(order);
    scrollToItemKeyRef.current = getItemKey(sessionItems[indices[0]].entry);
  };

  const handleMoveDown = (index: number) => {
    const indices = getSelectedIndices(index);
    const maxIdx = Math.max(...indices);
    if (maxIdx >= sessionItems.length - 1) return;
    const order = sessionItems.map(({ entry }) => getEntryKey(entry));
    for (const i of [...indices].reverse()) {
      [order[i], order[i + 1]] = [order[i + 1], order[i]];
    }
    reorderSession(order);
    scrollToItemKeyRef.current = getItemKey(sessionItems[indices[0]].entry);
  };

  const handleMoveToTop = (index: number) => {
    const indices = getSelectedIndices(index);
    if (Math.min(...indices) <= 0) return;
    const order = sessionItems.map(({ entry }) => getEntryKey(entry));
    const moved = indices.map((i) => order[i]);
    indices.reverse().forEach((i) => order.splice(i, 1));
    order.unshift(...moved);
    reorderSession(order);
    scrollToItemKeyRef.current = getItemKey(sessionItems[indices[0]].entry);
  };

  const handleMoveToBottom = (index: number) => {
    const indices = getSelectedIndices(index);
    if (Math.max(...indices) >= sessionItems.length - 1) return;
    const order = sessionItems.map(({ entry }) => getEntryKey(entry));
    const moved = indices.map((i) => order[i]);
    indices.reverse().forEach((i) => order.splice(i, 1));
    order.push(...moved);
    reorderSession(order);
    scrollToItemKeyRef.current = getItemKey(sessionItems[indices[0]].entry);
  };

  const handleMoveToPosition = (currentIndex: number, targetPosition: number) => {
    const target = Math.max(1, Math.min(Math.floor(targetPosition), sessionItems.length));
    const targetIndex = target - 1;
    if (targetIndex === currentIndex) return;
    const itemKey = getItemKey(sessionItems[currentIndex].entry);
    const order = sessionItems.map(({ entry }) => getEntryKey(entry));
    const key = order[currentIndex];
    order.splice(currentIndex, 1);
    order.splice(targetIndex, 0, key);
    reorderSession(order);
    scrollToItemKeyRef.current = itemKey;
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
    if (sessionToLoad && currentSession && currentSession.id === sessionToLoad) {
      // Clear existing session first
      clearSession();

      // Load songs into the active session context (items may be undefined from list cache)
      const items = Array.isArray(currentSession.items) ? currentSession.items : [];
      items.forEach(item => {
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
      label: 'Export PPT',
      icon: 'fas fa-download',
      onClick: handleExportToPowerPoint,
      variant: 'secondary',
      disabled: exporting || sessionItems.length === 0,
    },
    {
      label: 'Export CSV',
      icon: 'fas fa-file-csv',
      onClick: handleExportCsv,
      variant: 'secondary',
      disabled: sessionItems.length === 0,
    },
    {
      label: 'Import CSV',
      icon: 'fas fa-file-csv',
      onClick: () => csvFileInputRef.current?.click(),
      variant: 'secondary',
      disabled: importingCsv,
    },
    {
      label: 'Present',
      icon: 'fas fa-play',
      onClick: handlePresentSession,
      variant: 'primary' as const,
      disabled: sessionItems.length === 0,
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-1.5 sm:px-6 lg:px-8 py-2 sm:py-4 md:py-4">
      {/* Hidden file input for CSV import */}
      <input
        ref={csvFileInputRef}
        type="file"
        accept=".csv,text/csv"
        onChange={handleImportCsv}
        className="hidden"
        aria-hidden="true"
      />
      {/* Fixed Header on Mobile - Pinned below Layout header */}
      <div 
        className={`${isMobile ? 'fixed left-0 right-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700' : 'mb-6'}`}
        style={isMobile ? {
          top: 'calc(48px + var(--offline-banner-height, 0px))', // Below Layout header; + offline banner when visible
          paddingTop: 'env(safe-area-inset-top, 0px)',
        } : {}}
      >
        <div className={`max-w-7xl mx-auto px-1.5 sm:px-6 lg:px-8 ${isMobile ? 'py-2' : ''}`}>
          <div className={`flex flex-col md:flex-row md:items-center md:justify-between gap-4 ${isMobile ? '' : 'mb-6'}`}>
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
              <button
                type="button"
                onClick={() => csvFileInputRef.current?.click()}
                disabled={importingCsv}
                title="Import session from a CSV file"
                className="hidden md:flex min-h-[16px] sm:min-h-0 px-4 py-3 sm:py-2 text-sm font-medium text-gray-900 bg-gray-200 dark:bg-gray-600 rounded-lg sm:rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors text-center flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <i className={`fas ${importingCsv ? 'fa-spinner fa-spin' : 'fa-file-csv'} mr-2`}></i>
                Import CSV
              </button>
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
                  <span>{exporting ? 'Exporting...' : 'Export PPT'}</span>
                </button>
              </div>

              {/* Template */}
              <div className="hidden md:flex min-h-[16px] sm:min-h-0">
                <TemplateSelector onTemplateSelect={handleTemplateSelect} currentTemplateId={selectedTemplate?.id} disableAutoSelect />
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

              {/* Export CSV */}
              <div>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  title="Export session to CSV file for backup or sharing"
                  className="w-full hidden md:flex min-h-[16px] sm:min-h-0 px-3 sm:px-4 py-3 sm:py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-200 dark:bg-gray-600 rounded-lg sm:rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors flex items-center justify-center gap-1.5"
                >
                  <i className="fas fa-file-csv mr-1"></i>
                  <span>Export CSV</span>
                </button>
              </div>

              {/* Import CSV */}
              <button
                type="button"
                onClick={() => csvFileInputRef.current?.click()}
                disabled={importingCsv}
                title="Import session from a CSV file"
                className="hidden md:flex min-h-[16px] sm:min-h-0 px-3 sm:px-4 py-3 sm:py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-200 dark:bg-gray-600 rounded-lg sm:rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors text-center flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <i className={`fas ${importingCsv ? 'fa-spinner fa-spin' : 'fa-file-csv'} mr-1`}></i>
                <span>Import CSV</span>
              </button>
            </>
          )}
        </div>
            {/* Template selector for mobile - shown above bottom bar */}
            <div className="md:hidden w-full">
              <TemplateSelector onTemplateSelect={handleTemplateSelect} currentTemplateId={selectedTemplate?.id} disableAutoSelect />
            </div>
          </div>

          {/* Session song count - Fixed in header on mobile */}
          {sessionItems.length > 0 && (
            <div className={`text-sm text-gray-600 dark:text-gray-400 ${isMobile ? 'mb-2' : 'mb-4'}`}>
              {sessionItems.length} song{sessionItems.length !== 1 ? 's' : ''} in session
            </div>
          )}
        </div>
      </div>

      {/* List Container - Scrollable on mobile, normal on desktop */}
      <div
        ref={listContainerRef}
        className={isMobile ? 'overflow-y-auto' : ''}
        style={isMobile ? {
          // Space for Layout header (48px) + SessionManager header (~200px) + offline banner when visible
          marginTop: 'calc(128px + var(--offline-banner-height, 0px))',
          height: 'calc(100vh - 128px - 166px - var(--offline-banner-height, 0px))', // Viewport minus header, SessionManager header, bottom bar, offline banner
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain', // Prevent scroll chaining
        } : {}}
      >
      {sessionItems.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">
            No songs in the session yet. Use the <span className="font-semibold">Add to Session</span>{' '}
            buttons in the Songs or Pitches tabs to build your set list.
          </p>
        </div>
      ) : (
        <div
          className="space-y-0 md:space-y-3"
          onDragOver={!isMobile ? handleListContainerDragOver : undefined}
        >
          {displayItems.map(({ entry, song, singer }, index) => {
            const itemKey = getItemKey(entry);
            const isSelected = selectedSessionItemKeys.has(itemKey);
            const originalIndex = sessionItems.findIndex((s) => s.entry.songId === entry.songId && s.entry.singerId === entry.singerId);
            const isDragging = !isMobile && draggingIndex !== null && draggingIndices.includes(originalIndex);
            const selIndices = selectedSessionItemKeys.has(itemKey)
              ? sessionItems
                  .map((s, i) => (selectedSessionItemKeys.has(getItemKey(s.entry)) ? i : -1))
                  .filter((i) => i >= 0)
              : [originalIndex];
            const minSel = Math.min(...selIndices);
            const maxSel = Math.max(...selIndices);
            return (
              <div
                id={`session-card-${itemKey}`}
                key={itemKey}
                onClick={(e) => {
                  if (e.shiftKey) {
                    const anchor = selectionAnchorKeyRef.current;
                    const displayKeys = displayItems.map((d) => getItemKey(d.entry));
                    const clickedIdx = displayKeys.indexOf(itemKey);
                    if (anchor !== null && displayKeys.includes(anchor)) {
                      const anchorIdx = displayKeys.indexOf(anchor);
                      const start = Math.min(anchorIdx, clickedIdx);
                      const end = Math.max(anchorIdx, clickedIdx);
                      const range = new Set(displayKeys.slice(start, end + 1));
                      setSelectedSessionItemKeys(range);
                    } else {
                      selectionAnchorKeyRef.current = itemKey;
                      setSelectedSessionItemKeys(new Set([itemKey]));
                    }
                  } else {
                    selectionAnchorKeyRef.current = itemKey;
                    setSelectedSessionItemKeys(isSelected ? new Set() : new Set([itemKey]));
                  }
                }}
                className={`bg-white dark:bg-gray-800 p-2 py-[3px] md:px-4 md:py-[3px] transition-all duration-200 ${
                  isMobile 
                    ? `cursor-pointer ${
                        (isSelected || isDragging) ? 'bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500 dark:ring-blue-400' : ''
                      }`
                    : `border rounded-lg shadow-md hover:shadow-lg cursor-move ${
                        (isSelected || isDragging)
                          ? 'border-blue-500 dark:border-blue-400 ring-2 ring-blue-500 dark:ring-blue-400'
                          : 'border-gray-200 dark:border-gray-700'
                      }`
                } ${isDragging ? 'opacity-50' : ''}`}
                draggable={!isMobile}
                onDragStart={(e) => !isMobile && handleDragStart(e, originalIndex)}
                onDragOver={(e) => !isMobile && handleDragOver(e, index, originalIndex, itemKey)}
                onDrop={(e) => !isMobile && handleDrop(e, index, originalIndex)}
                onDragEnd={!isMobile ? handleDragEnd : undefined}
              >
                <div className="flex items-start gap-1.5 md:gap-3">
                  {/* Song number and move buttons */}
                  <div className="flex flex-col gap-0 flex-shrink-0">
                    <div
                      className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full font-bold text-sm bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 ${positionEdit?.itemKey === itemKey ? 'ring-2 ring-blue-500' : 'cursor-text'}`}
                      onClick={(e) => { e.stopPropagation(); setPositionEdit({ itemKey, value: String(originalIndex + 1) }); }}
                      title={`Click to edit position (1–${sessionItems.length})`}
                    >
                      {positionEdit?.itemKey === itemKey ? (
                        <input
                          type="number"
                          min={1}
                          max={sessionItems.length}
                          value={positionEdit.value}
                          onChange={(e) => setPositionEdit({ itemKey, value: e.target.value })}
                          onBlur={() => {
                            const num = parseInt(positionEdit.value, 10);
                            if (!Number.isNaN(num)) handleMoveToPosition(originalIndex, num);
                            setPositionEdit(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const num = parseInt(positionEdit.value, 10);
                              if (!Number.isNaN(num)) handleMoveToPosition(originalIndex, num);
                              setPositionEdit(null);
                              (e.target as HTMLInputElement).blur();
                            } else if (e.key === 'Escape') {
                              setPositionEdit(null);
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-6 h-6 text-center text-sm bg-transparent border-none p-0 font-bold text-blue-700 dark:text-blue-300 focus:outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          autoFocus
                        />
                      ) : (
                        index + 1
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-0 justify-items-center">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleMoveUp(originalIndex); }}
                        disabled={minSel === 0}
                        title="Move up"
                        aria-label="Move up"
                        className="p-0.5 -m-0.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                      >
                        <i className="fas fa-chevron-up text-xs"></i>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleMoveToTop(originalIndex); }}
                        disabled={minSel === 0}
                        title="Move to top"
                        aria-label="Move to top"
                        className="p-0.5 -m-0.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                      >
                        <i className="fas fa-angle-double-up text-xs"></i>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleMoveDown(originalIndex); }}
                        disabled={maxSel === sessionItems.length - 1}
                        title="Move down"
                        aria-label="Move down"
                        className="p-0.5 -m-0.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                      >
                        <i className="fas fa-chevron-down text-xs"></i>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleMoveToBottom(originalIndex); }}
                        disabled={maxSel === sessionItems.length - 1}
                        title="Move to bottom"
                        aria-label="Move to bottom"
                        className="p-0.5 -m-0.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                      >
                        <i className="fas fa-angle-double-down text-xs"></i>
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col gap-[3px]">
                    {/* Song Metadata Section - Reusable component */}
                    <SongMetadataCard
                      song={song}
                      onNameClick={isMobile ? undefined : () => handlePreviewSong(song.id)}
                      showBackground={!isMobile}
                      isSelected={isSelected}
                      alwaysShowDeityLanguage={true}
                      onPreviewClick={() => handlePreviewSong(song.id)}
                      lyricsHover={{ songId: song.id, songName: song.name, song }}
                      compactInDesktop={!showSongDetailsInDesktop}
                      iconsNextToNameOnDesktop={true}
                    />

                    {/* Singer and Pitch */}
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {singer && (
                        <>
                          <span className="hidden md:inline font-medium">Singer: </span>
                          <span className={`font-bold ${singer.gender?.toLowerCase() === 'male'
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
                          <span className="font-bold text-green-600 dark:text-green-400">{formatNormalizedPitch(entry.pitch)}</span>
                        </>
                      )}
                    </div>

                    {/* Action buttons - Icon-only on mobile, text on desktop - Hidden on mobile until row is selected */}
                    <div className={`flex flex-wrap items-center gap-1.5 sm:gap-1.5 ${isMobile && !isSelected ? 'hidden' : ''}`}>
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/admin/songs?songId=${entry.songId}`); }}
                      title="View song in Songs tab"
                      className="min-w-[33px] min-h-[33px] sm:min-w-0 sm:min-h-0 flex items-center justify-center sm:justify-start gap-1.5 p-2 sm:p-1.5 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg sm:rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors"
                    >
                      <i className="fas fa-external-link-alt text-base text-blue-600 dark:text-blue-400" style={{ transform: 'scaleX(-1)' }}></i>
                      <span className="hidden sm:inline text-xs font-medium whitespace-nowrap">Song</span>
                    </button>
                    {song.externalSourceUrl && (
                      <a
                        href={song.externalSourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="View song on external source (YouTube, etc.)"
                        onClick={(e) => e.stopPropagation()}
                        className="min-w-[33px] min-h-[33px] sm:min-w-0 sm:min-h-0 flex items-center justify-center sm:justify-start gap-1.5 p-2 sm:p-1.5 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg sm:rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors"
                      >
                        <i className="fas fa-external-link-alt text-base text-blue-600 dark:text-blue-400"></i>
                        <span className="hidden sm:inline text-xs font-medium whitespace-nowrap">External URL</span>
                      </a>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); removeSong(entry.songId, entry.singerId); }}
                      title="Remove"
                      className="min-w-[33px] min-h-[33px] sm:min-w-0 sm:min-h-0 flex items-center justify-center sm:justify-start gap-1.5 p-2 sm:p-1.5 rounded-lg sm:rounded-md text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors"
                    >
                      <i className="fas fa-times text-base text-red-600 dark:text-red-400"></i>
                      <span className="hidden sm:inline text-xs font-medium whitespace-nowrap">Remove</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}
      </div>

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

      {/* Scroll to Top Button - Mobile only */}
      {isMobile && showScrollToTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-24 right-4 z-50 w-12 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-200"
          title="Scroll to top"
          aria-label="Scroll to top"
        >
          <i className="fas fa-arrow-up text-lg"></i>
        </button>
      )}

      {/* Mobile Bottom Action Bar - Always show so users can access Load button */}
      <MobileBottomActionBar
        actions={mobileActions}
      />

      {/* Custom drag preview with dynamic number - follows cursor when dragging */}
      {!isMobile && draggingIndex !== null && dragPreviewPos && sessionItems[draggingIndex] && (
        <div
          className="fixed pointer-events-none z-[9999] -translate-x-1/2 -translate-y-1/2"
          style={{ left: dragPreviewPos.x, top: dragPreviewPos.y }}
        >
          <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border-2 border-blue-500 dark:border-blue-400 rounded-lg shadow-xl">
            <div className="flex items-center gap-1">
              {draggingIndices.length > 1 ? (
                <div className="flex-shrink-0 flex items-center justify-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-full font-bold text-sm">
                  <span>
                    {Math.min(...draggingIndices) + 1}-{Math.max(...draggingIndices) + 1}
                  </span>
                  <span className="opacity-70">→</span>
                  <span>
                    {dragPreviewNumbers[0] ?? ''}-{dragPreviewNumbers[dragPreviewNumbers.length - 1] ?? ''}
                  </span>
                </div>
              ) : (
                <div className="flex-shrink-0 flex items-center justify-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-full font-bold text-sm">
                  <span>{(draggingIndex ?? 0) + 1}</span>
                  <span className="opacity-70">→</span>
                  <span>{dragPreviewNumbers[0] ?? (draggingIndex ?? 0) + 1}</span>
                </div>
              )}
            </div>
            <span className="font-medium text-gray-900 dark:text-gray-100 truncate max-w-[200px]">
              {draggingIndices.length > 1
                ? `${draggingIndices.length} songs`
                : sessionItems[draggingIndex].song.name}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};




