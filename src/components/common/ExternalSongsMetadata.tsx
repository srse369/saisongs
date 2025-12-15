import React from 'react';
import { useExternalSongsData } from '../../hooks/useExternalSongsMetadata';

interface ExternalSongsMetadataProps {
  externalsongsUrl?: string;
  compact?: boolean;
}

/**
 * Component to display song data fetched from ExternalSongs.org
 * All data is fetched dynamically and not stored in the database
 */
export const ExternalSongsMetadata: React.FC<ExternalSongsMetadataProps> = ({ 
  externalsongsUrl, 
  compact = false 
}) => {
  const { data, isLoading, error } = useExternalSongsData(externalsongsUrl);

  if (!externalsongsUrl) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
        <i className="fas fa-spinner fa-spin text-xs mr-1"></i>
        Loading metadata...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
        <i className="fas fa-info-circle text-xs mr-1"></i>
        <a 
          href={externalsongsUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="hover:text-blue-600 dark:hover:text-blue-400 underline"
        >
          View on ExternalSongs.org
        </a>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2 text-xs">
        {data.deity && (
          <span className="inline-flex items-center px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
            {data.deity}
          </span>
        )}
        {data.languages && data.languages.length > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
            {data.languages.join(', ')}
          </span>
        )}
        {data.raga && (
          <span className="inline-flex items-center px-2 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
            {data.raga}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center text-gray-600 dark:text-gray-400">
        <i className="fas fa-link text-base mr-2"></i>
        <a 
          href={externalsongsUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 hover:underline"
        >
          View on ExternalSongs.org
        </a>
      </div>

      {data.deity && (
        <div className="flex items-start">
          <span className="font-medium text-gray-700 dark:text-gray-300 w-20">Deity:</span>
          <span className="text-gray-600 dark:text-gray-400">{data.deity}</span>
        </div>
      )}

      {data.languages && data.languages.length > 0 && (
        <div className="flex items-start">
          <span className="font-medium text-gray-700 dark:text-gray-300 w-20">Languages:</span>
          <span className="text-gray-600 dark:text-gray-400">{data.languages.join(', ')}</span>
        </div>
      )}

      {data.tempo && (
        <div className="flex items-start">
          <span className="font-medium text-gray-700 dark:text-gray-300 w-20">Tempo:</span>
          <span className="text-gray-600 dark:text-gray-400">{data.tempo}</span>
        </div>
      )}

      {data.beat && (
        <div className="flex items-start">
          <span className="font-medium text-gray-700 dark:text-gray-300 w-20">Beat:</span>
          <span className="text-gray-600 dark:text-gray-400">{data.beat}</span>
        </div>
      )}

      {data.raga && (
        <div className="flex items-start">
          <span className="font-medium text-gray-700 dark:text-gray-300 w-20">Raga:</span>
          <span className="text-gray-600 dark:text-gray-400">{data.raga}</span>
        </div>
      )}
    </div>
  );
};
