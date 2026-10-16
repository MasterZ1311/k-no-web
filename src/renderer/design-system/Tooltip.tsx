import React, { useState } from 'react';

export interface TooltipProps {
  content: string;
  children: React.ReactElement;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delayMs?: number;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  delayMs = 200,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [timerId, setTimerId] = useState<NodeJS.Timeout | null>(null);

  const show = () => {
    const id = setTimeout(() => setIsVisible(true), delayMs);
    setTimerId(id);
  };

  const hide = () => {
    if (timerId) clearTimeout(timerId);
    setIsVisible(false);
  };

  const positionStyles = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
    left: 'right-full top-1/2 -translate-y-1/2 mr-1.5',
    right: 'left-full top-1/2 -translate-y-1/2 ml-1.5',
  };

  return (
    <div className="relative inline-flex" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {children}
      {isVisible && (
        <div
          role="tooltip"
          className={`absolute z-50 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded shadow-md whitespace-nowrap pointer-events-none ${positionStyles[position]}`}
        >
          {content}
        </div>
      )}
    </div>
  );
};
