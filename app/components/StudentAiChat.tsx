import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react';
import type { KeyboardEvent } from 'react';
import api from '../lib/api';
import type { Activity } from '../lib/types';

type ChatTab = 'teach' | 'guide';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type ChatState = Record<ChatTab, { messages: ChatMessage[]; input: string; loading: boolean }>;

type TopicOption = { label: string; value: number };

export type StudentAiChatHandle = {
  sendGuidePrompt: () => void;
  pushGuideMessage: (content: string) => void;
};

type StudentAiChatProps = {
  activity: Activity | undefined;
  isUserReady: boolean;
  knowledgeLevel: string | null;
  onRequestKnowledgeLevel: () => void;
  onAdjustKnowledgeLevel: () => void;
  topicOptions: TopicOption[];
  currentTopicId: number | null;
  onSelectTopic: (topicId: number) => void;
  studentAnswer: number | string | null;
};

const tabs: { value: ChatTab; label: string }[] = [
  { value: 'teach', label: 'Teach me' },
  { value: 'guide', label: 'Guide me' },
];

function getInitialChatState(): ChatState {
  return {
    teach: { messages: [], input: '', loading: false },
    guide: { messages: [], input: '', loading: false },
  };
}

const StudentAiChat = forwardRef<StudentAiChatHandle, StudentAiChatProps>(function StudentAiChat(
  {
    activity,
    isUserReady,
    knowledgeLevel,
    onRequestKnowledgeLevel,
    onAdjustKnowledgeLevel,
    topicOptions,
    currentTopicId,
    onSelectTopic,
    studentAnswer,
  },
  ref,
) {
  const [activeTab, setActiveTab] = useState<ChatTab>('teach');
  const [chatState, setChatState] = useState<ChatState>(() => getInitialChatState());
  useEffect(() => {
    setChatState(getInitialChatState());
    setActiveTab('teach');
  }, [activity?.id]);

  const ensureKnowledgeLevel = useCallback(() => {
    if (!activity) {
      return false;
    }
    if (knowledgeLevel) {
      return true;
    }
    onRequestKnowledgeLevel();
    return false;
  }, [activity, knowledgeLevel, onRequestKnowledgeLevel]);

  const appendMessage = useCallback((tab: ChatTab, role: ChatMessage['role'], content: string) => {
    setChatState((prev) => ({
      ...prev,
      [tab]: {
        ...prev[tab],
        messages: [...prev[tab].messages, { id: generateMessageId(), role, content }],
      },
    }));
  }, []);

  const sendChat = useCallback(
    async (tab: ChatTab, overrideMessage?: string) => {
      if (!activity || !isUserReady) {
        return;
      }

      const message = (overrideMessage ?? chatState[tab].input).trim();
      if (!message) {
        return;
      }

      if (!ensureKnowledgeLevel()) {
        return;
      }

      const level = knowledgeLevel;
      if (!level) {
        return;
      }

      const topicId = typeof currentTopicId === 'number' ? currentTopicId : undefined;
      const normalizedStudentAnswer =
        typeof studentAnswer === 'number'
          ? studentAnswer
          : typeof studentAnswer === 'string' && studentAnswer.trim()
          ? studentAnswer.trim()
          : undefined;

      setChatState((prev) => ({
        ...prev,
        [tab]: {
          ...prev[tab],
          input: overrideMessage ? prev[tab].input : '',
          loading: true,
        },
      }));

      appendMessage(tab, 'user', message);

      try {
        let response;
        if (tab === 'teach') {
          response = await api.sendTeachMessage(activity.id, {
            knowledgeLevel: level,
            topicId,
            message,
          });
        } else {
          response = await api.sendGuideMessage(activity.id, {
            knowledgeLevel: level,
            message,
            studentAnswer: normalizedStudentAnswer,
          });
        }
        appendMessage(tab, 'assistant', response.message);
      } catch (error) {
        console.error('AI chat failed:', error);
        appendMessage(
          tab,
          'assistant',
          'AI study buddy not available right now. Please try again later.',
        );
      } finally {
        setChatState((prev) => ({
          ...prev,
          [tab]: { ...prev[tab], loading: false },
        }));
      }
    },
    [
      activity,
      appendMessage,
      chatState,
      currentTopicId,
      ensureKnowledgeLevel,
      isUserReady,
      knowledgeLevel,
      studentAnswer,
    ],
  );

  const guideInput = chatState.guide.input;

  useImperativeHandle(
    ref,
    () => ({
      sendGuidePrompt: () => {
        if (!activity) {
          return;
        }
        const fallback = guideInput.trim() || 'I would like guidance on this question.';
        setActiveTab('guide');
        void sendChat('guide', fallback);
      },
      pushGuideMessage: (content: string) => {
        if (!activity || !content) {
          return;
        }
        appendMessage('guide', 'assistant', content);
      },
    }),
    [activity, appendMessage, guideInput, sendChat],
  );

  const textAreaDisabled = !activity || !knowledgeLevel || !isUserReady;
  const activeChat = chatState[activeTab];
  const canSend =
    !!activeChat &&
    !activeChat.loading &&
    !textAreaDisabled &&
    Boolean(activeChat.input.trim());

  const handleTextareaKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== 'Enter') {
        return;
      }
      if (event.metaKey || event.shiftKey) {
        return;
      }
      event.preventDefault();
      if (!canSend) {
        return;
      }
      void sendChat(activeTab);
    },
    [activeTab, canSend, sendChat],
  );

  const renderMessages = (tab: ChatTab) => (
    <div className="space-y-3">
      {chatState[tab].messages.map((msg) => (
        <div
          key={msg.id}
          className={`w-fit max-w-full rounded-3xl px-5 py-3 text-sm ${
            msg.role === 'user'
              ? 'ml-auto bg-amber-500 text-white shadow'
              : 'bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-800'
          }`}
        >
          {msg.content}
        </div>
      ))}
    </div>
  );

  return (
    <aside className="flex h-[720px] flex-col rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
      <div className="flex items-center gap-3 p-5 border-b border-gray-200 dark:border-gray-800">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-500 via-pink-500 to-rose-500" />
        <div>
          <div className="font-bold">AI Study Buddy</div>
          <div className="text-xs text-gray-500">Hints, not answers</div>
        </div>
      </div>

      <div className="flex items-center gap-2 px-5 pt-4">
        <div className="flex rounded-full bg-gray-100 dark:bg-gray-900 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`px-3 py-1 text-xs font-semibold rounded-full transition ${
                activeTab === tab.value
                  ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow'
                  : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="text-[10px] uppercase tracking-wide text-gray-400">
          {knowledgeLevel ? `Level: ${titleCase(knowledgeLevel)}` : 'Set your level'}
        </div>
      </div>

      {activeTab === 'teach' && (
        <div className="px-5 pt-3">
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
            Focus topic
          </label>
          <select
            value={currentTopicId ?? ''}
            onChange={(e) => {
              const value = Number(e.target.value);
              if (Number.isFinite(value)) {
                onSelectTopic(value);
              }
            }}
            disabled={topicOptions.length <= 1}
            className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm disabled:opacity-50"
          >
            {topicOptions.map((topic) => (
              <option key={topic.value} value={topic.value}>
                {topic.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex-1 px-5 py-4">
        <div className="h-full overflow-y-auto pr-3">
          {renderMessages(activeTab)}
          {chatState[activeTab].loading && <div className="mt-2 text-xs text-gray-400">Thinking…</div>}
          {!activity && <div className="text-sm text-gray-500">Select an activity to begin.</div>}
        </div>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-800 p-5 space-y-2">
        <textarea
          value={chatState[activeTab].input}
          onChange={(e) =>
            setChatState((prev) => ({
              ...prev,
              [activeTab]: { ...prev[activeTab], input: e.target.value },
            }))
          }
          onKeyDown={handleTextareaKeyDown}
          placeholder={
            activeTab === 'teach' ? 'Ask about the topic…' : 'Describe where you need guidance…'
          }
          rows={3}
          disabled={textAreaDisabled}
          className="w-full resize-none rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 text-sm disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 dark:disabled:bg-gray-800 dark:disabled:text-gray-500"
        />
        {activity && !knowledgeLevel && (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Set your knowledge level to start chatting with your study buddy.
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={() => void sendChat(activeTab)}
            disabled={!canSend}
            className="px-4 py-2 rounded-xl font-semibold text-white bg-gradient-to-r from-amber-600 to-orange-600 disabled:opacity-50 shadow"
          >
            Send
          </button>
          <button
            onClick={onAdjustKnowledgeLevel}
            className="ml-auto text-xs font-semibold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
          >
            {knowledgeLevel ? 'Adjust level' : 'Set level'}
          </button>
        </div>
      </div>
    </aside>
  );
});

export default StudentAiChat;

function generateMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
