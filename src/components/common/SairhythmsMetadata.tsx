import React from 'react';
import { useSairhythmsData } from '../../hooks/useSairhythmsMetadata';

interface SairhythmsMetadataProps {
  sairhythmsUrl?: string;
  compact?: boolean;
}

/**
 * Component to display song data fetched from Sairhythms.org
 * All data is fetched dynamically and not stored in the database
 */
export const SairhythmsMetadata: React.FC<SairhythmsMetadataProps> = ({ 
  sairhythmsUrl, 
  compact = false 
}) => {
  const { data, isLoading, error } = useSairhythmsData(sairhythmsUrl);

  if (!sairhythmsUrl) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
        <svg className="animate-spin h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Loading metadata...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <a 
          href={sairhythmsUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="hover:text-blue-600 dark:hover:text-blue-400 underline"
        >
          View on Sairhythms.org
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
        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
        <a 
          href={sairhythmsUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 hover:underline"
        >
          View on Sairhythms.org
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
