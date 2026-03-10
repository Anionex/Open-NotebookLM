import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

interface CardProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  className?: string;
  interactive?: boolean;
}

/**
 * Editorial Workspace Card Component
 *
 * Features:
 * - Clean, minimal container styling
 * - Lifted shadow effect for editorial feel
 * - Multiple variants (default, elevated, outlined)
 * - Flexible padding options
 * - Optional interactive state (hover/tap animations)
 * - Warm neutral backgrounds
 */
export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      children,
      variant = 'default',
      padding = 'md',
      className = '',
      interactive = false,
      ...props
    },
    ref
  ) => {
    // Base styles
    const baseStyles = 'bg-white rounded-xl transition-all duration-200';

    // Variant styles
    const variantStyles = {
      default: 'border border-neutral-200',
      elevated: 'lifted',
      outlined: 'border-2 border-neutral-300',
    };

    // Padding styles
    const paddingStyles = {
      none: '',
      sm: 'p-3',
      md: 'p-4',
      lg: 'p-6',
    };

    // Interactive styles
    const interactiveStyles = interactive
      ? 'cursor-pointer hover:border-neutral-300 hover:shadow-md'
      : '';

    // Combine all styles
    const combinedStyles = `${baseStyles} ${variantStyles[variant]} ${paddingStyles[padding]} ${interactiveStyles} ${className}`;

    if (interactive) {
      return (
        <motion.div
          ref={ref}
          className={combinedStyles}
          whileHover={{ scale: 1.01, y: -2 }}
          whileTap={{ scale: 0.99 }}
          {...props}
        >
          {children}
        </motion.div>
      );
    }

    return (
      <div ref={ref} className={combinedStyles} {...props}>
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

/**
 * Card Header Component
 * For consistent card header styling
 */
interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  title,
  subtitle,
  action,
  className = '',
}) => {
  return (
    <div className={`flex items-start justify-between gap-4 mb-4 ${className}`}>
      <div className="flex-1 min-w-0">
        <h3 className="font-display text-xl font-semibold text-neutral-800 tracking-tight">
          {title}
        </h3>
        {subtitle && (
          <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};

CardHeader.displayName = 'CardHeader';

/**
 * Card Content Component
 * For consistent card content spacing
 */
interface CardContentProps {
  children: React.ReactNode;
  className?: string;
}

export const CardContent: React.FC<CardContentProps> = ({
  children,
  className = '',
}) => {
  return <div className={`space-editorial ${className}`}>{children}</div>;
};

CardContent.displayName = 'CardContent';

/**
 * Card Footer Component
 * For consistent card footer actions
 */
interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export const CardFooter: React.FC<CardFooterProps> = ({
  children,
  className = '',
}) => {
  return (
    <div
      className={`flex items-center justify-end gap-2 mt-4 pt-4 border-t border-neutral-200 ${className}`}
    >
      {children}
    </div>
  );
};

CardFooter.displayName = 'CardFooter';
