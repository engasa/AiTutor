import type { Progress } from '~/lib/types';

interface ProgressBarProps {
  completed: number;
  total: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export function ProgressBar({
  completed,
  total,
  size = 'md',
  showLabel = true,
  className = '',
}: ProgressBarProps) {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  const heights = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3',
  };

  return (
    <div className={`space-y-1 ${className}`}>
      {showLabel && (
        <div className="flex justify-between items-center text-xs text-gray-600 dark:text-gray-400">
          <span>
            {completed} / {total} completed
          </span>
          <span className="font-semibold">{percentage}%</span>
        </div>
      )}
      <div
        className={`w-full bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden ${heights[size]}`}
      >
        <div
          className="h-full bg-gradient-to-r from-purple-600 to-pink-600 transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export function ProgressBarFromData({
  progress,
  size,
  showLabel,
  className,
}: {
  progress?: Progress;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}) {
  if (!progress) {
    return null;
  }

  return (
    <ProgressBar
      completed={progress.completed}
      total={progress.total}
      size={size}
      showLabel={showLabel}
      className={className}
    />
  );
}