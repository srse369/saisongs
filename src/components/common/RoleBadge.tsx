import React from 'react';
import type { UserRole } from '../../contexts/AuthContext';

interface RoleBadgeProps {
  role: UserRole;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

/**
 * Displays a colored badge for user roles
 * - admin: emerald/green
 * - editor: blue
 * - viewer: purple
 * - public: gray
 */
export const RoleBadge: React.FC<RoleBadgeProps> = ({ 
  role, 
  size = 'md',
  showIcon = true
}) => {
  const getRoleStyles = () => {
    switch (role) {
      case 'admin':
        return {
          bg: 'bg-emerald-100 dark:bg-emerald-900/30',
          text: 'text-emerald-700 dark:text-emerald-300',
          icon: <i className="fas fa-gear"></i>,
          label: 'Admin'
        };
      case 'editor':
        return {
          bg: 'bg-blue-100 dark:bg-blue-900/30',
          text: 'text-blue-700 dark:text-blue-300',
          icon: <i className="fas fa-pen"></i>,
          label: 'Editor'
        };
      case 'viewer':
        return {
          bg: 'bg-purple-100 dark:bg-purple-900/30',
          text: 'text-purple-700 dark:text-purple-300',
          icon: <i className="fas fa-eye"></i>,
          label: 'Viewer'
        };
      case 'public':
      default:
        return {
          bg: 'bg-gray-100 dark:bg-gray-700',
          text: 'text-gray-700 dark:text-gray-300',
          icon: <i className="fas fa-globe"></i>,
          label: 'Public'
        };
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'px-2 py-0.5 text-xs';
      case 'lg':
        return 'px-4 py-2 text-base';
      case 'md':
      default:
        return 'px-2.5 py-1 text-sm';
    }
  };

  const { bg, text, icon, label } = getRoleStyles();
  const sizeClasses = getSizeClasses();

  return (
    <span 
      className={`inline-flex items-center gap-1 font-medium rounded ${bg} ${text} ${sizeClasses}`}
    >
      {showIcon && <span>{icon}</span>}
      <span>{label}</span>
    </span>
  );
};
