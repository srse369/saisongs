import React, { useState, useEffect } from 'react';

interface Center {
  id: number;
  name: string;
  badge_text_color: string;
}

interface CenterMultiSelectProps {
  selectedCenterIds: number[];
  onChange: (centerIds: number[]) => void;
  label?: string;
  disabled?: boolean;
  editableOnly?: boolean; // If true, only fetch centers the user can edit
  onCentersLoaded?: (centers: Center[]) => void; // Callback when centers are loaded
  readOnlyCenterIds?: number[]; // Centers to display as read-only (non-removable)
}

const API_BASE_URL = import.meta.env.VITE_API_URL || (
  import.meta.env.DEV ? '/api' : 'http://localhost:3111/api'
);

export const CenterMultiSelect: React.FC<CenterMultiSelectProps> = ({
  selectedCenterIds,
  onChange,
  label = 'Centers',
  disabled = false,
  editableOnly = false,
  onCentersLoaded,
  readOnlyCenterIds = [],
}) => {
  const [centers, setCenters] = useState<Center[]>([]);
  const [allCenters, setAllCenters] = useState<Center[]>([]); // For fetching read-only centers
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    fetchCenters();
  }, [editableOnly]);

  // Fetch all centers to get names/colors for read-only centers
  useEffect(() => {
    if (readOnlyCenterIds.length > 0) {
      fetchAllCenters();
    }
  }, [readOnlyCenterIds.length]);

  const fetchCenters = async () => {
    try {
      setLoading(true);
      setError(null);
      const timestamp = Date.now();
      const endpoint = editableOnly ? '/centers/editable' : '/centers';
      const response = await fetch(`${API_BASE_URL}${endpoint}?_t=${timestamp}`, {
        credentials: 'include',
        cache: 'no-store',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to fetch centers' }));
        throw new Error(errorData.error || errorData.message || 'Failed to fetch centers');
      }

      const data = await response.json();
      setCenters(data);
      if (onCentersLoaded) {
        onCentersLoaded(data);
      }
    } catch (err) {
      console.error('Error fetching centers:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch centers');
      setCenters([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllCenters = async () => {
    try {
      const timestamp = Date.now();
      const response = await fetch(`${API_BASE_URL}/centers?_t=${timestamp}`, {
        credentials: 'include',
        cache: 'no-store',
      });

      if (response.ok) {
        const data = await response.json();
        setAllCenters(data);
      }
    } catch (err) {
      console.error('Error fetching all centers:', err);
    }
  };

  const toggleCenter = (centerId: number) => {
    // Don't allow toggling read-only centers
    if (readOnlyCenterIds.includes(centerId)) {
      return;
    }
    
    if (selectedCenterIds.includes(centerId)) {
      onChange(selectedCenterIds.filter(id => id !== centerId));
    } else {
      onChange([...selectedCenterIds, centerId]);
    }
  };

  // Combine editable centers with read-only centers for display
  const allCentersForDisplay = [...centers];
  readOnlyCenterIds.forEach(id => {
    if (!allCentersForDisplay.find(c => c.id === id)) {
      const readOnlyCenter = allCenters.find(c => c.id === id);
      if (readOnlyCenter) {
        allCentersForDisplay.push(readOnlyCenter);
      }
    }
  });

  const selectedCenters = allCentersForDisplay.filter(c => selectedCenterIds.includes(c.id));

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label}
      </label>

      {/* Selected badges display */}
      <div className="mb-2 flex flex-wrap gap-2 min-h-[32px]">
        {selectedCenters.length === 0 ? (
          <span className="text-sm text-gray-400 dark:text-gray-500 italic">
            No centers selected
          </span>
        ) : (
          selectedCenters.map(center => {
            const isReadOnly = readOnlyCenterIds.includes(center.id);
            return (
              <span
                key={center.id}
                className={`inline-flex items-center gap-1 px-3 py-1 text-sm font-medium rounded-full ${
                  isReadOnly 
                    ? 'bg-gray-200 dark:bg-gray-600 opacity-75' 
                    : 'bg-gray-100 dark:bg-gray-700'
                }`}
                style={{ color: center.badge_text_color }}
                title={isReadOnly ? 'Managed by another center - cannot remove' : ''}
              >
                {center.name}
                {isReadOnly && (
                  <span className="text-xs opacity-60 ml-1">(read-only)</span>
                )}
                {!disabled && !isReadOnly && (
                  <button
                    type="button"
                    onClick={() => toggleCenter(center.id)}
                    className="ml-1 hover:text-red-500 dark:hover:text-red-400"
                  >
                    ×
                  </button>
                )}
              </span>
            );
          })
        )}
      </div>

      {/* Dropdown button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled || loading}
        className="w-full px-4 py-2 text-left bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {loading ? 'Loading centers...' : error ? 'Error loading centers' : `Select centers (${selectedCenters.length} selected)`}
        </span>
      </button>

      {/* Error message */}
      {error && !loading && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
          {error} - <button type="button" onClick={fetchCenters} className="underline hover:no-underline">Retry</button>
        </p>
      )}

      {/* Dropdown menu */}
      {isOpen && !loading && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[60]"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown content */}
          <div className="absolute z-[70] mt-1 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-auto">
            {centers.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                No centers available
              </div>
            ) : (
              centers.map(center => (
                <button
                  key={center.id}
                  type="button"
                  onClick={() => toggleCenter(center.id)}
                  className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  <input
                    type="checkbox"
                    checked={selectedCenterIds.includes(center.id)}
                    onChange={() => {}}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span
                    className="text-sm font-medium"
                    style={{ color: center.badge_text_color }}
                  >
                    {center.name}
                  </span>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
};
