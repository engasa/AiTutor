import React, { useState } from 'react';

export function PromptInput({ onSubmit, children }: { onSubmit: () => void; children: React.ReactNode }) {
  return (
    <div className="mt-3">{children}</div>
  );
}

export function PromptInputTextarea({ value, onChange, placeholder, onEnter }: { value: string; onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void; placeholder?: string; onEnter?: () => void }) {
  return (
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={2}
      className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-transparent"
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          onEnter?.();
        }
      }}
    />
  );
}

export function PromptInputToolbar({ children }: { children: React.ReactNode }) {
  return <div className="mt-2 flex items-center justify-end">{children}</div>;
}

export function PromptInputSubmit({ disabled, onClick }: { disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="px-4 py-2 rounded-xl font-semibold text-white bg-gradient-to-r from-amber-600 to-orange-600 disabled:opacity-50 shadow"
    >
      Send
    </button>
  );
}
