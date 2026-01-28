import { forwardRef, type HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ hoverable = false, className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`
          bg-surface rounded-2xl shadow-sm border border-border p-4
          ${hoverable ? 'transition-shadow hover:shadow-md' : ''}
          ${className}
        `}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
