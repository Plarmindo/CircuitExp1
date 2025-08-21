import React from 'react';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'destructive';
  className?: string;
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const baseClasses = 'relative w-full rounded-lg border p-4';
    const variantClasses = {
      default: 'bg-gray-50 text-gray-950 border-gray-200',
      destructive: 'border-red-200 text-red-900 bg-red-50'
    };

    return (
      <div
        ref={ref}
        role="alert"
        className={`${baseClasses} ${variantClasses[variant]} ${className || ''}`}
        {...props}
      />
    );
  }
);
Alert.displayName = 'Alert';

export interface AlertDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  className?: string;
}

export const AlertDescription = React.forwardRef<HTMLParagraphElement, AlertDescriptionProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={`text-sm [&_p]:leading-relaxed ${className || ''}`}
      {...props}
    />
  )
);
AlertDescription.displayName = 'AlertDescription';