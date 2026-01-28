import { forwardRef, type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', id, ...props }, ref) => {
    const inputId = id || `input-${Math.random().toString(36).slice(2)}`;

    return (
      <div className="flex flex-col gap-2">
        {label && (
          <label htmlFor={inputId} className="text-lg font-bold text-text">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            w-full rounded-xl border-2 border-border bg-white px-4 py-3
            text-lg text-text placeholder:text-text-secondary/60
            focus:border-primary focus:outline-none
            disabled:bg-gray-100 disabled:cursor-not-allowed
            ${error ? 'border-danger' : ''}
            ${className}
          `}
          {...props}
        />
        {error && <p className="text-base text-danger">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
