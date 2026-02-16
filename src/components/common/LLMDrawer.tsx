import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSongs } from '../../contexts/SongContext';
import { useSingers } from '../../contexts/SingerContext';
import { getWebLLMService } from '../../services/WebLLMService';
import { WebLLMService } from '../../services/WebLLMService';
import { useAgentExecutor } from '../../hooks';
import type { Song } from '../../types';

interface LLMDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LLMDrawer: React.FC<LLMDrawerProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { songs } = useSongs();
  const { singers } = useSingers();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [reply, setReply] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: string; path?: string; filters?: Record<string, string>; songName?: string } | null>(null);
  const [playAudioSong, setPlayAudioSong] = useState<Song | null>(null);
  const [debugLogs, setDebugLogs] = useState<Array<{ message: string; data?: unknown }>>([]);
  const [debugLogOpen, setDebugLogOpen] = useState(false);

  const executeAction = useAgentExecutor();

  const availableValues = React.useMemo(
    () => WebLLMService.extractAvailableValues(songs, singers),
    [songs, singers]
  );

  useEffect(() => {
    if (isOpen) {
      const service = getWebLLMService();
      service.setAvailableValues(availableValues);
    }
  }, [isOpen, availableValues]);

  const sendToLLM = useCallback(async () => {
    const text = message.trim();
    if (!text) return;
    const service = getWebLLMService();
    service.setAvailableValues(availableValues);
    setError(null);
    setReply('');
    setPendingAction(null);
    setPlayAudioSong(null);
    setDebugLogs([]);
    setIsSending(true);
    try {
      const onDebugLog = (msg: string, data?: unknown) => {
        setDebugLogs((prev) => [...prev, { message: msg, data }]);
      };
      const { reply: r, action } = await service.chatWithAppContext(text, { onDebugLog });
      setReply(r || 'Done.');
      executeAction(action, {
        setReply,
        setPlayAudioSong,
        setPendingAction,
        navigate,
        onClose,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setError(msg);
    } finally {
      setIsSending(false);
    }
  }, [message, availableValues, executeAction, navigate, onClose]);

  const executePendingNavigate = useCallback(() => {
    if (pendingAction?.type === 'navigate' && pendingAction.path) {
      navigate(pendingAction.path, pendingAction.filters ? { state: { llmFilters: pendingAction.filters } } : undefined);
      setPendingAction(null);
      onClose();
    }
  }, [pendingAction, navigate, onClose]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Backdrop - only when open */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-xs z-40 transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      {/* Drawer - slides in from right (same as FeedbackDrawer) */}
      <div
        className={`fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-gray-800 shadow-2xl z-50 transition-transform duration-300 ease-in-out flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-label="Ask the app"
        aria-hidden={!isOpen}
      >
        <div className="bg-blue-600 dark:bg-blue-700 px-6 py-4 text-white flex items-center justify-between shrink-0">
          <h2 className="text-lg font-semibold">Ask the app</h2>
          <button
            onClick={onClose}
            className="text-white hover:text-blue-100 transition-colors focus:outline-none p-1"
            aria-label="Close"
          >
            <i className="fas fa-times text-xl" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Type your question or tap a suggestion below.
          </p>

          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Try these:</p>
            <ul className="space-y-1.5">
              {[
                'Show my shiva bhajans',
                'Show my fast shiva bhajans',
                'What is my scale for the song arunachala shiva',
                'Show me shiva songs',
                'Show me fast shiva songs',
                "What is ashwin's scale for song arunachala shiva",
                'Show me bhajans of deity hanuman',
                'Add the following song to live "arunachala shiva"',
                'Add the following bhajan for singer "John" to live "arunachala shiva"',
              ].map((suggestion) => (
                <li key={suggestion}>
                  <button
                    type="button"
                    onClick={() => setMessage(suggestion)}
                    className="w-full text-left px-3 py-2 text-sm rounded-lg bg-gray-100 dark:bg-gray-700/60 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 transition-colors"
                  >
                    {suggestion}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-800 dark:text-red-200">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="llm-drawer-message" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Your message
            </label>
            <textarea
              id="llm-drawer-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. Show fast Shiva bhajans … or Go to Songs"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y min-h-[80px]"
            />
          </div>

          <button
            type="button"
            onClick={sendToLLM}
            disabled={!message.trim() || isSending}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isSending ? (
              <>
                <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Sending…
              </>
            ) : (
              <>
                <i className="fas fa-paper-plane" />
                Send to app
              </>
            )}
          </button>

          {reply && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">Assistant</p>
              <p className="text-gray-900 dark:text-white whitespace-pre-wrap text-sm">{reply}</p>
              {playAudioSong?.audioLink && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Audio</p>
                  <audio
                    controls
                    src={playAudioSong.audioLink}
                    className="w-full max-w-full"
                    preload="metadata"
                  >
                    Your browser does not support the audio element.
                  </audio>
                </div>
              )}
              {pendingAction?.path && (
                <button
                  type="button"
                  onClick={executePendingNavigate}
                  className="mt-3 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                >
                  Go to {pendingAction.path}
                </button>
              )}
            </div>
          )}

          {debugLogs.length > 0 && (
            <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setDebugLogOpen((o) => !o)}
                className="w-full px-3 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700/50 hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-between"
              >
                Debug log ({debugLogs.length})
                <i className={`fas fa-chevron-${debugLogOpen ? 'up' : 'down'} text-gray-500`} />
              </button>
              {debugLogOpen && (
                <div className="max-h-64 overflow-y-auto bg-gray-50 dark:bg-gray-800/50 p-2 space-y-2 text-xs font-mono">
                  {debugLogs.map((entry, i) => (
                    <div key={i} className="border-l-2 border-gray-300 dark:border-gray-600 pl-2">
                      <div className="text-gray-700 dark:text-gray-300 font-medium">{entry.message}</div>
                      {entry.data !== undefined && (
                        <pre className="mt-1 whitespace-pre-wrap break-all text-gray-600 dark:text-gray-400">
                          {typeof entry.data === 'string' ? entry.data : JSON.stringify(entry.data, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};
