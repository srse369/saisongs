import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSongs } from '../contexts/SongContext';
import { useSingers } from '../contexts/SingerContext';
import { getWebLLMService } from '../services/WebLLMService';
import { WebLLMService } from '../services/WebLLMService';

export const LLMPage: React.FC = () => {
  const navigate = useNavigate();
  const { songs } = useSongs();
  const { singers } = useSingers();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [reply, setReply] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: string; path?: string; filters?: Record<string, string> } | null>(null);

  const availableValues = React.useMemo(
    () => WebLLMService.extractAvailableValues(songs, singers),
    [songs, singers]
  );

  useEffect(() => {
    const service = getWebLLMService();
    service.setAvailableValues(availableValues);
  }, [availableValues]);

  const sendToLLM = useCallback(async () => {
    const text = message.trim();
    if (!text) return;
    const service = getWebLLMService();
    service.setAvailableValues(availableValues);
    setError(null);
    setReply('');
    setPendingAction(null);
    setIsSending(true);
    try {
      const { reply: r, action } = await service.chatWithAppContext(text);
      setReply(r || 'Done.');
      if (action?.type === 'navigate' && action.path) {
        if (action.filters) {
          navigate(action.path, { state: { llmFilters: action.filters } });
        } else {
          setPendingAction({ type: 'navigate', path: action.path });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setError(msg);
    } finally {
      setIsSending(false);
    }
  }, [message, availableValues, navigate]);

  const executeAction = useCallback(() => {
    if (pendingAction?.type === 'navigate' && pendingAction.path) {
      navigate(pendingAction.path, pendingAction.filters ? { state: { llmFilters: pendingAction.filters } } : undefined);
      setPendingAction(null);
    }
  }, [pendingAction, navigate]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 animate-fade-in">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
        Talk to the app
      </h1>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
        Type your message below. Examples: &quot;Show Shiva songs&quot;, &quot;Fast devi bhajans&quot;, &quot;Go to Songs&quot;.
      </p>

      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-800 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="llm-message" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Your message
          </label>
          <textarea
            id="llm-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="e.g. Take me to the Songs tab … or Show me devi songs in Sanskrit"
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y min-h-[80px]"
          />
        </div>

        <button
          type="button"
          onClick={sendToLLM}
          disabled={!message.trim() || isSending}
          className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
            <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{reply}</p>
            {pendingAction?.path && (
              <button
                type="button"
                onClick={executeAction}
                className="mt-3 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Go to {pendingAction.path}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LLMPage;
