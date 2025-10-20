import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

type ConversationCtx = {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  atBottom: boolean;
  scrollToBottom: () => void;
};

const Ctx = createContext<ConversationCtx | null>(null);

export function Conversation({ children, className }: { children: React.ReactNode; className?: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);

  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  // Track whether user is at bottom
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const threshold = 8; // px
      setAtBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - threshold);
    };
    el.addEventListener('scroll', onScroll);
    onScroll();
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const value = useMemo(() => ({ scrollRef, atBottom, scrollToBottom }), [atBottom]);

  return (
    <Ctx.Provider value={value}>
      <div className={['flex flex-col', className].filter(Boolean).join(' ')}>{children}</div>
    </Ctx.Provider>
  );
}

export function ConversationContent({ children }: { children: React.ReactNode }) {
  const ctx = useContext(Ctx);
  return (
    <div ref={ctx?.scrollRef || undefined} className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
      {children}
    </div>
  );
}

export function ConversationScrollButton() {
  const ctx = useContext(Ctx);
  if (!ctx) return null;
  return (
    <div className="mt-2 flex justify-center">
      {!ctx.atBottom && (
        <button
          type="button"
          onClick={ctx.scrollToBottom}
          className="px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
        >
          Jump to newest
        </button>
      )}
    </div>
  );
}
