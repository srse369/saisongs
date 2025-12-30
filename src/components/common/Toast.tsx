import React from 'react';
import type { Toast as ToastType } from '../../contexts/ToastContext';
import { useToast } from '../../contexts/ToastContext';

interface ToastProps {
  toast: ToastType;
}

const Toast: React.FC<ToastProps> = ({ toast }) => {
  const { removeToast } = useToast();

  const getToastStyles = () => {
    const baseStyles = 'px-6 py-4 rounded-lg shadow-lg flex items-center gap-3 min-w-[300px] max-w-[500px] animate-slide-in';
    
    switch (toast.type) {
      case 'success':
        return `${baseStyles} bg-green-600 text-white`;
      case 'error':
        return `${baseStyles} bg-red-600 text-white`;
      case 'warning':
        return `${baseStyles} bg-yellow-500 text-gray-900`;
      case 'info':
        return `${baseStyles} bg-blue-600 text-white`;
      default:
        return `${baseStyles} bg-gray-800 text-white`;
    }
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return (
          <i className="fas fa-check-circle text-2xl flex-shrink-0"></i>
        );
      case 'error':
        return (
          <i className="fas fa-times-circle text-2xl flex-shrink-0"></i>
        );
      case 'warning':
        return (
          <i className="fas fa-exclamation-triangle text-2xl flex-shrink-0"></i>
        );
      case 'info':
        return (
          <i className="fas fa-info-circle text-2xl flex-shrink-0"></i>
        );
    }
  };

  return (
    <div className={getToastStyles()}>
      {getIcon()}
      <p className="flex-1 text-sm font-medium">{toast.message}</p>
      <button
        onClick={() => removeToast(toast.id)}
        className="flex-shrink-0 hover:opacity-75 transition-opacity"
        aria-label="Close notification"
      >
        <i className="fas fa-times text-lg"></i>
      </button>
    </div>
  );
};

export const ToastContainer: React.FC = () => {
  const { toasts } = useToast();

  // Don't render container if there are no toasts to avoid unnecessary DOM manipulation
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2">
      {toasts.map(toast => (
        <Toast key={toast.id} toast={toast} />
      ))}
    </div>
  );
};

export default Toast;
