/**
 * Cloud Storage Service
 * Handles uploading media files to various cloud storage providers
 */

export type CloudProvider = 'google-drive' | 'onedrive' | 'dropbox' | 'local';

export interface CloudStorageConfig {
  provider: CloudProvider;
  destinationPath: string;
  accessToken?: string;
  clientId?: string;
  clientSecret?: string;
}

export interface UploadResult {
  url: string;
  filename: string;
  provider: CloudProvider;
}

class CloudStorageService {
  /**
   * Upload a file to the specified cloud storage provider
   */
  async uploadFile(
    file: Blob,
    filename: string,
    config: CloudStorageConfig
  ): Promise<UploadResult> {
    switch (config.provider) {
      case 'google-drive':
        return this.uploadToGoogleDrive(file, filename, config);
      case 'onedrive':
        return this.uploadToOneDrive(file, filename, config);
      case 'dropbox':
        return this.uploadToDropbox(file, filename, config);
      case 'local':
        return this.uploadToLocal(file, filename, config);
      default:
        throw new Error(`Unsupported cloud provider: ${config.provider}`);
    }
  }

  /**
   * Upload multiple files to cloud storage
   */
  async uploadFiles(
    files: Array<{ blob: Blob; filename: string }>,
    config: CloudStorageConfig,
    onProgress?: (uploaded: number, total: number) => void
  ): Promise<UploadResult[]> {
    const results: UploadResult[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const { blob, filename } = files[i];
      const result = await this.uploadFile(blob, filename, config);
      results.push(result);
      
      if (onProgress) {
        onProgress(i + 1, files.length);
      }
    }
    
    return results;
  }

  /**
   * Upload to Google Drive
   */
  private async uploadToGoogleDrive(
    file: Blob,
    filename: string,
    config: CloudStorageConfig
  ): Promise<UploadResult> {
    if (!config.accessToken) {
      throw new Error('Google Drive access token is required');
    }

    // Create metadata
    const metadata = {
      name: filename,
      parents: config.destinationPath ? [config.destinationPath] : undefined,
    };

    // Create form data for multipart upload
    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    formData.append('file', file);

    const response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error(`Google Drive upload failed: ${response.statusText}`);
    }

    const result = await response.json();
    
    // Make the file publicly accessible (optional - depends on requirements)
    // await this.makeGoogleDriveFilePublic(result.id, config.accessToken);
    
    // Return the web view link
    const url = `https://drive.google.com/file/d/${result.id}/view`;

    return {
      url,
      filename,
      provider: 'google-drive',
    };
  }

  /**
   * Upload to OneDrive
   */
  private async uploadToOneDrive(
    file: Blob,
    filename: string,
    config: CloudStorageConfig
  ): Promise<UploadResult> {
    if (!config.accessToken) {
      throw new Error('OneDrive access token is required');
    }

    const path = config.destinationPath || '';
    const uploadUrl = `https://graph.microsoft.com/v1.0/me/drive/root:/${path}/${filename}:/content`;

    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': file.type || 'application/octet-stream',
      },
      body: file,
    });

    if (!response.ok) {
      throw new Error(`OneDrive upload failed: ${response.statusText}`);
    }

    const result = await response.json();

    return {
      url: result.webUrl,
      filename,
      provider: 'onedrive',
    };
  }

  /**
   * Upload to Dropbox
   */
  private async uploadToDropbox(
    file: Blob,
    filename: string,
    config: CloudStorageConfig
  ): Promise<UploadResult> {
    if (!config.accessToken) {
      throw new Error('Dropbox access token is required');
    }

    const path = config.destinationPath || '';
    const fullPath = `${path}/${filename}`.replace(/\/+/g, '/');

    const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({
          path: fullPath,
          mode: 'add',
          autorename: true,
          mute: false,
        }),
      },
      body: file,
    });

    if (!response.ok) {
      throw new Error(`Dropbox upload failed: ${response.statusText}`);
    }

    const result = await response.json();

    // Get a shareable link
    const linkResponse = await fetch('https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path: result.path_display,
        settings: {
          requested_visibility: 'public',
        },
      }),
    });

    const linkResult = await linkResponse.json();
    const url = linkResult.url || result.path_display;

    return {
      url,
      filename,
      provider: 'dropbox',
    };
  }

  /**
   * Upload to local server (backend endpoint)
   */
  private async uploadToLocal(
    file: Blob,
    filename: string,
    config: CloudStorageConfig
  ): Promise<UploadResult> {
    const formData = new FormData();
    // IMPORTANT: Append destinationPath BEFORE file so multer can access it in destination callback
    formData.append('destinationPath', config.destinationPath || '');
    formData.append('file', file, filename);

    const response = await fetch('/api/upload-media', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 501) {
        throw new Error(
          'Local server storage is not configured. Please install multer package (npm install multer @types/multer) or skip upload to use embedded media.'
        );
      }
      throw new Error(`Local upload failed: ${errorData.message || response.statusText}`);
    }

    const result = await response.json();

    return {
      url: result.url,
      filename,
      provider: 'local',
    };
  }

  /**
   * Validate cloud storage configuration
   */
  validateConfig(config: CloudStorageConfig): { valid: boolean; error?: string } {
    if (!config.provider) {
      return { valid: false, error: 'Provider is required' };
    }

    // Destination path is optional (defaults to root directory)
    // if (!config.destinationPath) {
    //   return { valid: false, error: 'Destination path is required' };
    // }

    if (config.provider !== 'local' && !config.accessToken) {
      return { valid: false, error: 'Access token is required for cloud storage' };
    }

    return { valid: true };
  }

  /**
   * Get OAuth authorization URL for a provider
   */
  getAuthUrl(provider: CloudProvider, clientId: string, redirectUri: string): string {
    switch (provider) {
      case 'google-drive':
        return `https://accounts.google.com/o/oauth2/v2/auth?` +
          `client_id=${encodeURIComponent(clientId)}&` +
          `redirect_uri=${encodeURIComponent(redirectUri)}&` +
          `response_type=token&` +
          `scope=${encodeURIComponent('https://www.googleapis.com/auth/drive.file')}`;
      
      case 'onedrive':
        return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
          `client_id=${encodeURIComponent(clientId)}&` +
          `redirect_uri=${encodeURIComponent(redirectUri)}&` +
          `response_type=token&` +
          `scope=${encodeURIComponent('Files.ReadWrite')}`;
      
      case 'dropbox':
        return `https://www.dropbox.com/oauth2/authorize?` +
          `client_id=${encodeURIComponent(clientId)}&` +
          `redirect_uri=${encodeURIComponent(redirectUri)}&` +
          `response_type=token`;
      
      default:
        throw new Error(`OAuth not supported for provider: ${provider}`);
    }
  }
}

export const cloudStorageService = new CloudStorageService();
