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
      className="fixed bottom-10 left-0 right-0 md:hidden z-40"
      style={{
        paddingBottom: 0,
      }}
    >
      {/* Actions */}
      <div className="px-0 py-0">
        <div className="flex items-center gap-0 overflow-x-auto">
          {actions.map((action, index) => (
            <button
              key={index}
              onClick={action.onClick}
              disabled={action.disabled}
              className={`
                flex-1 min-w-0 flex flex-row items-center justify-center gap-1 px-2 py-1 rounded
                transition-colors touch-target border border-gray-300 dark:border-gray-600
                g-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 active:bg-gray-300 dark:active:bg-gray-500 disabled:bg-gray-100 disabled:text-gray-400
                ${action.disabled ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              aria-label={action.label}
            >
              <div className="relative">
                <i className={`${action.icon} text-sm`} />
                {action.badge !== undefined && action.badge !== 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] flex items-center justify-center px-0.5 bg-red-500 text-white text-[10px] font-semibold rounded-full">
                    {action.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium truncate leading-tight">
                {action.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

