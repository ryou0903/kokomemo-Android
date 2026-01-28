import { forwardRef, type ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'small' | 'normal' | 'large';
  icon?: string;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'normal',
      icon,
      iconPosition = 'left',
      loading,
      disabled,
      children,
      className = '',
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-bold rounded-xl transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 gap-2';

    const variantStyles = {
      primary: 'bg-primary text-white hover:bg-primary-hover shadow-md',
      secondary: 'bg-white text-text border-2 border-border hover:bg-gray-50 shadow-sm',
      danger: 'bg-danger text-white hover:bg-danger-hover shadow-md',
      ghost: 'bg-transparent text-primary hover:bg-primary/10',
    };

    const sizeStyles = {
      small: 'min-h-[40px] px-4 py-2 text-base',
      normal: 'min-h-[44px] px-5 py-2.5 text-base',
      large: 'min-h-[52px] px-6 py-3 text-lg',
    };

    const iconElement = icon && (
      <span className="flex-shrink-0 text-[1.1em] leading-none">{icon}</span>
    );

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {loading ? (
          <>
            <span className="flex-shrink-0 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            <span>読み込み中...</span>
          </>
        ) : (
          <>
            {iconPosition === 'left' && iconElement}
            {children && <span>{children}</span>}
            {iconPosition === 'right' && iconElement}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
