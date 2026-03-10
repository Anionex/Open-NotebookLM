import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'accent';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<HTMLMotionProps<"button">, 'size'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
  className?: string;
}

/**
 * Editorial Workspace Button Component
 *
 * Features:
 * - Lifted shadow effect (signature editorial style)
 * - Warm neutral palette with coral accent
 * - Refined typography and spacing
 * - Smooth hover/tap animations
 * - Accessible focus states
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', children, className = '', disabled, ...props }, ref) => {
    // Base styles - shared across all variants
    const baseStyles = 'inline-flex items-center justify-center font-sans font-medium tracking-tight transition-all duration-200 focus-editorial disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none';

    // Variant styles
    const variantStyles: Record<ButtonVariant, string> = {
      primary: 'bg-neutral-900 text-white hover:bg-neutral-800 lifted-hover',
      secondary: 'bg-neutral-100 text-neutral-900 hover:bg-neutral-200 border border-neutral-200',
      ghost: 'bg-transparent text-neutral-700 hover:bg-neutral-50 border border-neutral-300 hover:border-neutral-400',
      accent: 'bg-accent-500 text-white hover:bg-accent-600 lifted-hover',
    };

    // Size styles
    const sizeStyles: Record<ButtonSize, string> = {
      sm: 'px-3 py-1.5 text-sm rounded-md gap-1.5',
      md: 'px-4 py-2.5 text-base rounded-lg gap-2',
      lg: 'px-6 py-3 text-lg rounded-lg gap-2.5',
    };

    // Combine all styles
    const combinedStyles = `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`;

    return (
      <motion.button
        ref={ref}
        className={combinedStyles}
        disabled={disabled}
        whileHover={disabled ? {} : { scale: 1.02, y: -1 }}
        whileTap={disabled ? {} : { scale: 0.98, y: 0 }}
        {...props}
      >
        {children}
      </motion.button>
    );
  }
);

Button.displayName = 'Button';
