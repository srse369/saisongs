import React from 'react';

interface FilterInputProps {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}

/**
 * Reusable input field for filter searches
 * Provides consistent styling across all filter inputs
 */
export const FilterInput: React.FC<FilterInputProps> = ({
  label,
  value,
  placeholder,
  onChange,
}) => {
  const inputClassName = "w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500";
  
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={inputClassName}
      />
    </div>
  );
};
