import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import type { CloudProvider, CloudStorageConfig } from '../../services/CloudStorageService';
import { cloudStorageService } from '../../services/CloudStorageService';

interface MediaExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (config: CloudStorageConfig | undefined) => void;
}

export function MediaExportModal({ isOpen, onClose, onConfirm }: MediaExportModalProps) {
  const [provider, setProvider] = useState<CloudProvider>('local');
  const [destinationPath, setDestinationPath] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [error, setError] = useState('');
  const [showAuthWindow, setShowAuthWindow] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setProvider('local');
      setDestinationPath('');
      setAccessToken('');
      setError('');
      setShowAuthWindow(false);
    }
  }, [isOpen]);

  const handleProviderChange = (newProvider: CloudProvider) => {
    setProvider(newProvider);
    setAccessToken('');
    setError('');
    setShowAuthWindow(false);
  };

  const handleAuthenticate = () => {
    if (provider === 'local') {
      return;
    }

    try {
      // For demo purposes, using a placeholder client ID
      // In production, these should come from environment variables
      const clientIds: Record<string, string> = {
        'google-drive': 'YOUR_GOOGLE_CLIENT_ID',
        'onedrive': 'YOUR_MICROSOFT_CLIENT_ID',
        'dropbox': 'YOUR_DROPBOX_CLIENT_ID',
      };

      const clientId = clientIds[provider];
      if (!clientId || clientId.startsWith('YOUR_')) {
        setError(`OAuth not configured for ${provider}. Please set up client credentials.`);
        return;
      }

      const redirectUri = `${window.location.origin}/oauth-callback`;
      const authUrl = cloudStorageService.getAuthUrl(provider, clientId, redirectUri);

      // Open OAuth window
      const authWindow = window.open(
        authUrl,
        'OAuth Authentication',
        'width=600,height=700,scrollbars=yes'
      );

      setShowAuthWindow(true);

      // Listen for OAuth callback
      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        
        if (event.data.type === 'oauth-token') {
          setAccessToken(event.data.token);
          setShowAuthWindow(false);
          authWindow?.close();
          window.removeEventListener('message', handleMessage);
        }
      };

      window.addEventListener('message', handleMessage);

      // Check if window was closed
      const checkClosed = setInterval(() => {
        if (authWindow?.closed) {
          clearInterval(checkClosed);
          setShowAuthWindow(false);
          window.removeEventListener('message', handleMessage);
        }
      }, 500);
    } catch (err) {
      setError(`Authentication error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleSkipUpload = () => {
    // User wants to import without uploading to cloud storage
    onConfirm(undefined);
  };

  const handleConfirm = () => {
    const config: CloudStorageConfig = {
      provider,
      destinationPath,
      accessToken: provider === 'local' ? undefined : accessToken,
    };

    const validation = cloudStorageService.validateConfig(config);
    if (!validation.valid) {
      setError(validation.error || 'Invalid configuration');
      return;
    }

    onConfirm(config);
  };

  const requiresAuth = provider !== 'local';
  const isAuthenticated = !requiresAuth || !!accessToken;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Media Export Configuration">
      <div className="p-6 max-w-2xl">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          PowerPoint files may contain embedded media (images and videos). Choose where to store these media files:
        </p>

        {error && (
          <div className="mb-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 px-4 py-3 rounded-md">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* Storage Provider Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Storage Provider
            </label>
            <select
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value as CloudProvider)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="local">Local Server Storage</option>
              <option value="google-drive">Google Drive</option>
              <option value="onedrive">Microsoft OneDrive</option>
              <option value="dropbox">Dropbox</option>
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {provider === 'local' && 'Media files will be stored on your server'}
              {provider === 'google-drive' && 'Media files will be uploaded to your Google Drive'}
              {provider === 'onedrive' && 'Media files will be uploaded to your Microsoft OneDrive'}
              {provider === 'dropbox' && 'Media files will be uploaded to your Dropbox'}
            </p>
            {provider === 'local' && (
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-400 flex items-start gap-1">
                <i className="fas fa-exclamation-triangle mt-0.5"></i>
                <span>Note: Local server storage requires the <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">multer</code> package. If not installed, please skip upload or use cloud storage.</span>
              </p>
            )}
          </div>

          {/* Destination Path */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {provider === 'local' ? 'Subdirectory (optional)' : 'Destination Folder'}
            </label>
            <input
              type="text"
              value={destinationPath}
              onChange={(e) => setDestinationPath(e.target.value)}
              placeholder={
                provider === 'local' 
                  ? 'e.g., imports/2025-12 or leave empty' 
                  : provider === 'google-drive'
                  ? 'e.g., PowerPoint Media'
                  : 'e.g., /PowerPoint Media'
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {provider === 'local' && 'Optional subdirectory within pptx-media/ (leave empty for root)'}
              {provider !== 'local' && 'Folder path in your cloud storage (folder will be created if it doesn\'t exist)'}
            </p>
          </div>

          {/* Authentication for Cloud Providers */}
          {requiresAuth && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Authentication
              </label>
              {!isAuthenticated ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={handleAuthenticate}
                    disabled={showAuthWindow}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <i className="fas fa-sign-in-alt"></i>
                    {showAuthWindow ? 'Waiting for authentication...' : `Connect to ${provider}`}
                  </button>
                  {showAuthWindow && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Please complete the authentication in the popup window...
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <i className="fas fa-check-circle"></i>
                  <span>Connected successfully</span>
                  <button
                    type="button"
                    onClick={() => setAccessToken('')}
                    className="ml-auto text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  >
                    Disconnect
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-8 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          
          <button
            onClick={handleSkipUpload}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <i className="fas fa-forward mr-2"></i>
            Skip Upload (Use Data URLs)
          </button>
          
          <button
            onClick={handleConfirm}
            disabled={!isAuthenticated}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <i className="fas fa-cloud-upload-alt"></i>
            Continue with Upload
          </button>
        </div>

        {/* Information */}
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
          <div className="flex gap-2">
            <i className="fas fa-info-circle text-blue-600 dark:text-blue-400 mt-0.5"></i>
            <div className="text-sm text-blue-800 dark:text-blue-300">
              <p className="font-medium mb-1">Why upload media files?</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Reduces template file size by storing media separately</li>
                <li>Enables media file reuse across multiple templates</li>
                <li>Cloud storage makes media accessible from anywhere</li>
                <li>Improves presentation loading performance</li>
              </ul>
              <p className="mt-2 text-xs">
                If you skip upload, media will be embedded as data URLs (works but increases template size).
              </p>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
