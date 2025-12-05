import React, { useState, useEffect } from 'react';

interface User {
  id: string;
  name: string;
  email?: string;
}

interface UserMultiSelectProps {
  selectedUserIds: string[];
  onChange: (userIds: string[]) => void;
  label?: string;
  disabled?: boolean;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || (
  import.meta.env.DEV ? '/api' : 'http://localhost:3111/api'
);

export const UserMultiSelect: React.FC<UserMultiSelectProps> = ({
  selectedUserIds,
  onChange,
  label = 'Editors',
  disabled = false,
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const timestamp = Date.now();
      const response = await fetch(`${API_BASE_URL}/singers?_t=${timestamp}`, {
        credentials: 'include',
        cache: 'no-store',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to fetch users' }));
        throw new Error(errorData.error || errorData.message || 'Failed to fetch users');
      }

      const data = await response.json();
      // Filter to only show users with email addresses
      const usersWithEmail = data.filter((user: User) => user.email && user.email.trim());
      setUsers(usersWithEmail);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleUser = (userId: string) => {
    if (selectedUserIds.includes(userId)) {
      onChange(selectedUserIds.filter(id => id !== userId));
    } else {
      onChange([...selectedUserIds, userId]);
    }
  };

  const selectedUsers = users.filter(u => selectedUserIds.includes(u.id));

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label}
      </label>

      {/* Selected users display */}
      <div className="mb-2 flex flex-wrap gap-2 min-h-[32px]">
        {selectedUsers.length === 0 ? (
          <span className="text-sm text-gray-400 dark:text-gray-500 italic">
            No editors selected
          </span>
        ) : (
          selectedUsers.map(user => (
            <span
              key={user.id}
              className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-sm"
            >
              <span>
                {user.name}
                {user.email && (
                  <span className="text-blue-600 dark:text-blue-300 ml-1">
                    ({user.email})
                  </span>
                )}
              </span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => toggleUser(user.id)}
                  className="hover:text-blue-600 dark:hover:text-blue-400"
                  aria-label={`Remove ${user.name}`}
                >
                  ×
                </button>
              )}
            </span>
          ))
        )}
      </div>

      {/* Dropdown */}
      {!disabled && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            disabled={loading}
            className="w-full px-3 py-2 text-left bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300"
          >
            {loading ? 'Loading users...' : 'Select editors...'}
          </button>

          {isOpen && !loading && (
            <>
              {/* Backdrop to close dropdown */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setIsOpen(false)}
              />

              {/* Dropdown menu */}
              <div className="absolute z-20 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto">
                {error ? (
                  <div className="px-3 py-2 text-sm text-red-600 dark:text-red-400">
                    {error}
                  </div>
                ) : users.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                    No users available
                  </div>
                ) : (
                  users.map(user => {
                    const userIdNum = parseInt(user.id, 16);
                    const isSelected = selectedUserIds.includes(userIdNum);
                    return (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => toggleUser(user.id)}
                        className={`w-full px-3 py-2 text-left text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between ${
                          isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                        }`}
                      >
                        <span className="flex-1">
                          {user.name}
                          {user.email && user.email.trim() && (
                            <span className="text-gray-500 dark:text-gray-400 ml-1 text-xs">
                              ({user.email})
                            </span>
                          )}
                        </span>
                        {isSelected && (
                          <svg
                            className="w-4 h-4 text-blue-600 dark:text-blue-400 ml-2 flex-shrink-0"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
