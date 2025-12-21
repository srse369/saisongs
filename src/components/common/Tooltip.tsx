import React, { useState, useRef, useEffect } from 'react';

interface TooltipProps {
  content: string | React.ReactNode;
  children: React.ReactElement;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  disabled?: boolean;
}

export const Tooltip: React.FC<TooltipProps> = ({ 
  content, 
  children, 
  position = 'top',
  delay = 300,
  disabled = false 
}) => {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleMouseEnter = () => {
    if (disabled) return;
    
    timeoutRef.current = setTimeout(() => {
      setVisible(true);
      updatePosition();
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setVisible(false);
  };

  const updatePosition = () => {
    if (!containerRef.current || !tooltipRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const offset = 8; // Gap between element and tooltip

    let top = 0;
    let left = 0;

    switch (position) {
      case 'top':
        top = containerRect.top - tooltipRect.height - offset;
        left = containerRect.left + (containerRect.width - tooltipRect.width) / 2;
        break;
      case 'bottom':
        top = containerRect.bottom + offset;
        left = containerRect.left + (containerRect.width - tooltipRect.width) / 2;
        break;
      case 'left':
        top = containerRect.top + (containerRect.height - tooltipRect.height) / 2;
        left = containerRect.left - tooltipRect.width - offset;
        break;
      case 'right':
        top = containerRect.top + (containerRect.height - tooltipRect.height) / 2;
        left = containerRect.right + offset;
        break;
    }

    // Keep tooltip within viewport
    const padding = 8;
    if (left < padding) left = padding;
    if (left + tooltipRect.width > window.innerWidth - padding) {
      left = window.innerWidth - tooltipRect.width - padding;
    }
    if (top < padding) top = padding;
    if (top + tooltipRect.height > window.innerHeight - padding) {
      top = window.innerHeight - tooltipRect.height - padding;
    }

    setCoords({ top, left });
  };

  useEffect(() => {
    if (visible) {
      updatePosition();
    }
  }, [visible]);

  if (!content) return children;

  return (
    <>
      <div
        ref={containerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="inline-block"
      >
        {children}
      </div>

      {visible && (
        <div
          ref={tooltipRef}
          className="fixed z-[9999] px-3 py-2 text-sm text-white bg-gray-900 dark:bg-gray-800 rounded-lg shadow-lg border border-gray-700 dark:border-gray-600 pointer-events-none animate-fade-in"
          style={{
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            maxWidth: '320px',
          }}
        >
          <div className="relative">
            {typeof content === 'string' ? (
              <p className="leading-relaxed">{content}</p>
            ) : (
              content
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default Tooltip;
