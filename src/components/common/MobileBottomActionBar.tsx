import React from 'react';

export interface MobileAction {
  label: string;
  icon: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  badge?: number | string;
}

interface MobileBottomActionBarProps {
  actions: MobileAction[];
  filterCount?: number;
}

export const MobileBottomActionBar: React.FC<MobileBottomActionBarProps> = ({
  actions,
  filterCount = 0,
}) => {


  return (
    <div
      className="fixed bottom-0 left-0 right-0 md:hidden z-40 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg"
      style={{
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
      }}
    >
      {/* Actions */}
      <div className="px-2 py-1">
        <div className="flex items-center gap-1 overflow-x-auto">
          {actions.map((action, index) => (
            <button
              key={index}
              onClick={action.onClick}
              disabled={action.disabled}
              className={`
                flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-md
                transition-colors touch-target
                bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 active:bg-gray-300 dark:active:bg-gray-500 disabled:bg-gray-100 disabled:text-gray-400
                ${action.disabled ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              aria-label={action.label}
            >
              <div className="relative">
                <i className={`${action.icon} text-sm`} />
                {action.badge !== undefined && action.badge !== 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] flex items-center justify-center px-0.5 bg-red-500 text-white text-[10px] font-semibold rounded-full">
                    {action.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium truncate w-full text-center leading-tight">
                {action.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

