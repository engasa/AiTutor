import React from 'react';

export function Message({ from, children }: { from: 'user' | 'assistant'; children: React.ReactNode }) {
  return (
    <div className={from === 'user' ? 'ml-8' : 'mr-8'}>
      <div className={from === 'user'
        ? 'text-sm bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3'
        : 'text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3'}>
        {children}
      </div>
    </div>
  );
}

export function MessageContent({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}

export function MessageAvatar({ name }: { name?: string }) {
  return (
    <div className="mt-1 text-[11px] text-gray-500">{name || ''}</div>
  );
}
