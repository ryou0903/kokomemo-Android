import { forwardRef, type TextareaHTMLAttributes } from 'react';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className = '', id, ...props }, ref) => {
    const textareaId = id || `textarea-${Math.random().toString(36).slice(2)}`;

    return (
      <div className="flex flex-col gap-2">
        {label && (
          <label htmlFor={textareaId} className="text-lg font-bold text-text">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={`
            w-full rounded-xl border-2 border-border bg-white px-4 py-3
            text-lg text-text placeholder:text-text-secondary/60
            focus:border-primary focus:outline-none resize-y min-h-[120px]
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

Textarea.displayName = 'Textarea';
