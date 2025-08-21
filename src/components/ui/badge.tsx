import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  className?: string;
}

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const baseClasses = 'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2';
    
    const variantClasses = {
      default: 'border-transparent bg-blue-600 text-white hover:bg-blue-600/80',
      secondary: 'border-transparent bg-gray-100 text-gray-900 hover:bg-gray-100/80',
      destructive: 'border-transparent bg-red-500 text-white hover:bg-red-500/80',
      outline: 'text-gray-900'
    };

    return (
      <div
        ref={ref}
        className={`${baseClasses} ${variantClasses[variant]} ${className || ''}`}
        {...props}
      />
    );
  }
);
Badge.displayName = 'Badge';