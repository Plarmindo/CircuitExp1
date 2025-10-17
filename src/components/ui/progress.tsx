import React from 'react';
import '../styles/progress.css';

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  className?: string;
  fillClassName?: string;
}

export const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ value, className, fillClassName, ...props }, ref) => {
    const pctRaw = Math.min(100, Math.max(0, value || 0));
    const pct = Math.round(pctRaw);
    const widthClass = `w-pct-${pct}`;

    return (
      <div
        ref={ref}
        className={`progress-bar ${className || ''}`}
        {...props}
      >
        <div
          className={`progress-fill ${widthClass} ${fillClassName || ''}`}
        />
      </div>
    );
  }
);
Progress.displayName = 'Progress';
