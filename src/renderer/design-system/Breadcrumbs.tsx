import React from 'react';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
  current?: boolean;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items }) => {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center text-sm text-kano-text-muted">
      <ol className="flex items-center gap-1.5 list-none m-0 p-0">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <li key={idx} className="flex items-center gap-1.5">
              {item.onClick && !isLast ? (
                <button
                  type="button"
                  onClick={item.onClick}
                  className="hover:text-kano-text-primary transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-kano-accent rounded px-1 -mx-1 font-medium"
                >
                  {item.label}
                </button>
              ) : (
                <span
                  className={item.current || isLast ? 'font-semibold text-kano-text-primary' : ''}
                  aria-current={item.current || isLast ? 'page' : undefined}
                >
                  {item.label}
                </span>
              )}
              {!isLast && <ChevronRight className="w-4 h-4 text-kano-text-muted flex-shrink-0" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
