import React, { useState, useEffect, useRef } from 'react';

interface SmartSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  suggestions?: string[];
  placeholder?: string;
  onSuggestionClick?: (suggestion: string) => void;
  showExamples?: boolean;
}

export const SmartSearchInput: React.FC<SmartSearchInputProps> = ({
  value,
  onChange,
  suggestions = [],
  placeholder = 'Try: "sai songs in sanskrit" or "fast tempo devi"...',
  onSuggestionClick,
  showExamples = true,
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showExamplesPanel, setShowExamplesPanel] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
        setShowExamplesPanel(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    setShowSuggestions(newValue.length > 0 && suggestions.length > 0);
  };

  const handleSuggestionClick = (suggestion: string) => {
    onChange(suggestion);
    setShowSuggestions(false);
    if (onSuggestionClick) {
      onSuggestionClick(suggestion);
    }
  };

  const handleFocus = () => {
    if (value.length > 0 && suggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  const examples = [
    { query: 'sai songs', description: 'All songs for a deity' },
    { query: 'devi in sanskrit', description: 'Deity + language filter' },
    { query: 'fast tempo', description: 'By tempo' },
    { query: 'hamsadhwani raga', description: 'By raga' },
    { query: 'simple level', description: 'By difficulty' },
    { query: 'C# pitch', description: 'Specific pitch' },
  ];

  return (
    <div ref={wrapperRef} className="relative flex-1 lg:min-w-[300px]">
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={handleFocus}
          placeholder={placeholder}
          className="w-full pl-10 pr-20 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
        />
        <i className="fas fa-search text-base text-gray-400 absolute left-3 top-2.5"></i>
        
        {showExamples && (
          <button
            type="button"
            onClick={() => setShowExamplesPanel(!showExamplesPanel)}
            className="absolute right-3 top-1.5 p-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
            title="Show search examples"
          >
            ?
          </button>
        )}

        {value && (
          <button
            type="button"
            onClick={() => {
              onChange('');
              setShowSuggestions(false);
            }}
            className="absolute right-10 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            title="Clear search"
          >
            <i className="fas fa-times text-base"></i>
          </button>
        )}
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
          <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
            Suggestions
          </div>
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => handleSuggestionClick(suggestion)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
            >
              <i className="fas fa-search text-base text-gray-400"></i>
              <span className="text-gray-900 dark:text-gray-100">{suggestion}</span>
            </button>
          ))}
        </div>
      )}

      {/* Examples Panel */}
      {showExamplesPanel && (
        <div className="absolute z-10 mt-1 w-full bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md shadow-lg p-4 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100">
              Smart Search Examples
            </h4>
            <button
              onClick={() => setShowExamplesPanel(false)}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
            >
              <i className="fas fa-times text-base"></i>
            </button>
          </div>
          <div className="space-y-2">
            {examples.map((example, index) => (
              <button
                key={index}
                onClick={() => {
                  handleSuggestionClick(example.query);
                  setShowExamplesPanel(false);
                }}
                className="w-full text-left p-2 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors group"
              >
                <div className="flex items-start gap-2">
                  <code className="flex-shrink-0 px-2 py-0.5 bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 rounded text-xs font-mono">
                    {example.query}
                  </code>
                  <span className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                    {example.description}
                  </span>
                </div>
              </button>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300">
            <strong>Pro tip:</strong> Mix keywords like "sai songs fast tempo" or "C# devi sanskrit"
          </div>
        </div>
      )}
    </div>
  );
};


