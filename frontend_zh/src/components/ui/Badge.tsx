import React from 'react';

type BadgeVariant = 'default' | 'accent' | 'success' | 'warning' | 'error' | 'neutral';
type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  className?: string;
  icon?: React.ReactNode;
  removable?: boolean;
  onRemove?: () => void;
}

/**
 * Editorial Workspace Badge Component
 *
 * Features:
 * - Multiple variants for different semantic meanings
 * - Clean, minimal pill-shaped design
 * - Optional icon support
 * - Optional removable (close button)
 * - Warm editorial color palette
 * - Proper accessibility (aria-label for remove button)
 */
export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  className = '',
  icon,
  removable = false,
  onRemove,
}) => {
  // Base styles
  const baseStyles =
    'inline-flex items-center font-sans font-medium rounded-full transition-colors';

  // Variant styles
  const variantStyles: Record<BadgeVariant, string> = {
    default: 'bg-neutral-100 text-neutral-700 border border-neutral-200',
    accent: 'bg-accent-100 text-accent-700 border border-accent-200',
    success: 'bg-success-50 text-success-600 border border-success-600/20',
    warning: 'bg-warning-50 text-warning-600 border border-warning-600/20',
    error: 'bg-error-50 text-error-600 border border-error-600/20',
    neutral: 'bg-neutral-800 text-white',
  };

  // Size styles
  const sizeStyles: Record<BadgeSize, string> = {
    sm: 'px-2 py-0.5 text-xs gap-1',
    md: 'px-2.5 py-1 text-sm gap-1.5',
    lg: 'px-3 py-1.5 text-base gap-2',
  };

  // Icon size based on badge size
  const iconSizeMap = {
    sm: 12,
    md: 14,
    lg: 16,
  };

  // Combine all styles
  const combinedStyles = `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`;

  return (
    <span className={combinedStyles}>
      {icon && (
        <span
          className="shrink-0"
          style={{ width: iconSizeMap[size], height: iconSizeMap[size] }}
        >
          {icon}
        </span>
      )}
      <span className="truncate">{children}</span>
      {removable && onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="shrink-0 ml-0.5 rounded-full hover:bg-black/10 transition-colors"
          aria-label="移除标签"
          style={{ padding: 2 }}
        >
          <svg
            width={iconSizeMap[size] - 2}
            height={iconSizeMap[size] - 2}
            viewBox="0 0 12 12"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M9 3L3 9M3 3L9 9"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
    </span>
  );
};

Badge.displayName = 'Badge';

/**
 * Badge Group Component
 * For displaying multiple badges with consistent spacing
 */
interface BadgeGroupProps {
  children: React.ReactNode;
  className?: string;
}

export const BadgeGroup: React.FC<BadgeGroupProps> = ({
  children,
  className = '',
}) => {
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {children}
    </div>
  );
};

BadgeGroup.displayName = 'BadgeGroup';
