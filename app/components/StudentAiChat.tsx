import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import type { ChangeEvent, FormEvent, KeyboardEvent } from 'react';
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '~/components/ai-elements/conversation';
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputModelSelect,
  PromptInputModelSelectContent,
  PromptInputModelSelectItem,
  PromptInputModelSelectTrigger,
  PromptInputModelSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  type PromptInputMessage,
} from '~/components/ai-elements/prompt-input';
import { Message, MessageContent, MessageResponse } from '~/components/ai-elements/message';
import api from '../lib/api';
import type { Activity, AiModel } from '../lib/types';

type ChatTab = 'teach' | 'guide';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type ChatState = Record<
  ChatTab,
  { messages: ChatMessage[]; input: string; loading: boolean; chatId: string | null }
>;

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

const DEFAULT_MODEL_ID = 'google:gemini-2.5-flash';
const API_KEYS_STORAGE_KEY = 'ai-provider-keys';

const PROVIDER_LABELS: Record<string, string> = {
  google: 'Gemini',
  openai: 'OpenAI',
};

function getProviderFromModelId(modelId: string): string {
  return modelId.split(':')[0] || 'google';
}

function getProviderLabel(provider: string): string {
  return PROVIDER_LABELS[provider] || provider;
}

function maskApiKey(key: string): string {
  if (key.length <= 8) return '••••••••';
  return `••••••${key.slice(-4)}`;
}

function loadApiKeysFromStorage(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem(API_KEYS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveApiKeysToStorage(keys: Record<string, string>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(API_KEYS_STORAGE_KEY, JSON.stringify(keys));
  } catch {
    // Ignore storage errors
  }
}

function getInitialChatState(): ChatState {
  return {
    teach: { messages: [], input: '', loading: false, chatId: null },
    guide: { messages: [], input: '', loading: false, chatId: null },
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
  const [availableModels, setAvailableModels] = useState<AiModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>(DEFAULT_MODEL_ID);
  const [modelsFetched, setModelsFetched] = useState(false);
  const [modelLoadError, setModelLoadError] = useState(false);

  // API key state
  const [providerApiKeys, setProviderApiKeys] = useState<Record<string, string>>(() =>
    loadApiKeysFromStorage()
  );
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');

  // Derive current provider and its key
  const currentProvider = getProviderFromModelId(selectedModelId);
  const currentApiKey = providerApiKeys[currentProvider] || '';
  const hasApiKey = Boolean(currentApiKey);

  const availableTabs = useMemo<{ value: ChatTab; label: string }[]>(() => {
    if (!activity) return [];
    const tabs = [];
    if (activity.enableTeachMode) {
      tabs.push({ value: 'teach' as ChatTab, label: 'Teach me' });
    }
    if (activity.enableGuideMode) {
      tabs.push({ value: 'guide' as ChatTab, label: 'Guide me' });
    }
    return tabs;
  }, [activity]);

  const showTabToggle = availableTabs.length > 1;

  const isTeachEnabled = activity?.enableTeachMode ?? false;
  const isGuideEnabled = activity?.enableGuideMode ?? false;
  const currentTabEnabled =
    (activeTab === 'teach' && isTeachEnabled) || (activeTab === 'guide' && isGuideEnabled);

  if (!currentTabEnabled) {
    if (isTeachEnabled) {
      setActiveTab('teach');
    } else if (isGuideEnabled) {
      setActiveTab('guide');
    } else if (activeTab !== 'teach') {
      setActiveTab('teach');
    }
  }

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const models = await api.listAiModels();
        if (!isMounted) return;
        setAvailableModels(models);
        setSelectedModelId((current) => {
          if (models.some((m) => m.modelId === current)) {
            return current;
          }
          const geminiModel = models.find((m) => m.modelId.includes('gemini-2.5-flash'));
          return geminiModel?.modelId ?? models[0]?.modelId ?? DEFAULT_MODEL_ID;
        });
        setModelLoadError(false);
      } catch (error) {
        if (!isMounted) return;
        console.error('Failed to load AI models:', error);
        setModelLoadError(true);
      } finally {
        if (isMounted) {
          setModelsFetched(true);
        }
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

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

  const appendMessage = useCallback(
    (tab: ChatTab, role: ChatMessage['role'], content: string, id?: string) => {
      setChatState((prev) => ({
        ...prev,
        [tab]: {
          ...prev[tab],
          messages: [...prev[tab].messages, { id: id ?? generateMessageId(), role, content }],
        },
      }));
    },
    [],
  );

  const sendChat = useCallback(
    async (tab: ChatTab, overrideMessage?: string) => {
      if (!activity || !isUserReady) {
        return;
      }

      // Guard: Prevent sending if mode is disabled
      const modeEnabled = 
        (tab === 'teach' && activity.enableTeachMode) ||
        (tab === 'guide' && activity.enableGuideMode);
      
      if (!modeEnabled) {
        console.warn(`Cannot use disabled ${tab} mode for activity ${activity.id}`);
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

      // Check for API key
      const provider = getProviderFromModelId(selectedModelId);
      const apiKey = providerApiKeys[provider];
      if (!apiKey) {
        console.warn('No API key for provider:', provider);
        return;
      }

      const topicId = typeof currentTopicId === 'number' ? currentTopicId : undefined;
      const normalizedStudentAnswer =
        typeof studentAnswer === 'number'
          ? studentAnswer
          : typeof studentAnswer === 'string' && studentAnswer.trim()
          ? studentAnswer.trim()
          : undefined;

      const messageId = generateMessageId();

      setChatState((prev) => ({
        ...prev,
        [tab]: {
          ...prev[tab],
          input: overrideMessage ? prev[tab].input : '',
          loading: true,
        },
      }));

      appendMessage(tab, 'user', message, messageId);

      try {
        let response;
        const modelId = selectedModelId || DEFAULT_MODEL_ID;
        if (tab === 'teach') {
          response = await api.sendTeachMessage(activity.id, {
            knowledgeLevel: level,
            topicId,
            message,
            modelId,
            apiKey,
            chatId: chatState[tab].chatId,
            messageId,
          });
        } else {
          response = await api.sendGuideMessage(activity.id, {
            knowledgeLevel: level,
            message,
            studentAnswer: normalizedStudentAnswer,
            modelId,
            apiKey,
            chatId: chatState[tab].chatId,
            messageId,
          });
        }
        const nextChatId = response.chatId ?? chatState[tab].chatId ?? null;
        if (nextChatId) {
          setChatState((prev) => ({
            ...prev,
            [tab]: {
              ...prev[tab],
              chatId: nextChatId,
            },
          }));
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
      providerApiKeys,
      selectedModelId,
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
        // Guard: only proceed if guide mode is enabled
        if (!activity.enableGuideMode) {
          console.warn('Cannot use sendGuidePrompt when guide mode is disabled');
          return;
        }
        // Check API key exists for current provider
        const provider = getProviderFromModelId(selectedModelId);
        if (!providerApiKeys[provider]) {
          console.warn('No API key for provider:', provider);
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
        // Guard: only push if guide mode is enabled
        if (!activity.enableGuideMode) {
          console.warn('Cannot push guide message when guide mode is disabled');
          return;
        }
        appendMessage('guide', 'assistant', content);
      },
    }),
    [activity, appendMessage, guideInput, providerApiKeys, selectedModelId, sendChat],
  );

  // Chat is disabled if: no activity, no knowledge level, no API key, or user not ready
  const chatDisabled = !activity || !knowledgeLevel || !hasApiKey || !isUserReady;
  const activeChat = chatState[activeTab];
  const canSend =
    !!activeChat &&
    !activeChat.loading &&
    !chatDisabled &&
    Boolean(activeChat.input.trim());

  const handlePromptInputChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const { value } = event.target;
      setChatState((prev) => ({
        ...prev,
        [activeTab]: { ...prev[activeTab], input: value },
      }));
    },
    [activeTab],
  );

  const handlePromptSubmit = useCallback(
    (message: PromptInputMessage, event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!canSend || !message?.text?.trim()) {
        return;
      }
      void sendChat(activeTab);
    },
    [activeTab, canSend, sendChat],
  );

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

  // API key modal handlers
  const handleOpenApiKeyModal = useCallback(() => {
    setTempApiKey(currentApiKey);
    setShowApiKeyModal(true);
  }, [currentApiKey]);

  const handleSaveApiKey = useCallback(() => {
    if (!tempApiKey.trim()) return;
    const newKeys = { ...providerApiKeys, [currentProvider]: tempApiKey.trim() };
    setProviderApiKeys(newKeys);
    saveApiKeysToStorage(newKeys);
    setShowApiKeyModal(false);
    setTempApiKey('');
  }, [currentProvider, providerApiKeys, tempApiKey]);

  const handleCancelApiKeyModal = useCallback(() => {
    setShowApiKeyModal(false);
    setTempApiKey('');
  }, []);

  const renderMessages = (tab: ChatTab) => (
    <div className="space-y-3">
      {chatState[tab].messages.map((msg) => (
        <Message from={msg.role} key={msg.id}>
          <MessageContent
            className={`max-w-full rounded-3xl px-5 py-3 text-sm ${
              msg.role === 'user'
                ? 'ml-auto bg-amber-500 text-white shadow'
                : 'bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-800'
            }`}
          >
            <MessageResponse>{msg.content}</MessageResponse>
          </MessageContent>
        </Message>
      ))}
    </div>
  );

  // Determine what message to show in disabled state
  const getDisabledMessage = () => {
    if (!activity) return 'Select an activity to begin.';
    if (!hasApiKey) return `Enter your ${getProviderLabel(currentProvider)} API key to start chatting.`;
    if (!knowledgeLevel) return 'Set your knowledge level to start chatting.';
    return null;
  };

  const disabledMessage = getDisabledMessage();

  return (
    <aside className="flex h-[800px] flex-col rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
      <div className="flex items-center gap-3 p-5 border-b border-gray-200 dark:border-gray-800">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-500 via-pink-500 to-rose-500" />
        <div>
          <div className="font-bold">AI Study Buddy</div>
          <div className="text-xs text-gray-500">Hints, not answers</div>
        </div>
      </div>

      <div className="flex items-center gap-2 px-5 pt-4">
        {showTabToggle ? (
          <div className="flex rounded-full bg-gray-100 dark:bg-gray-900 p-1">
            {availableTabs.map((tab) => (
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
        ) : availableTabs.length === 1 ? (
          <div className="px-3 py-1 text-xs font-semibold rounded-full bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 cursor-not-allowed">
            {availableTabs[0].label}
          </div>
        ) : null}
        <button
          type="button"
          onClick={onAdjustKnowledgeLevel}
          className={`ml-auto inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-wide transition
            ${knowledgeLevel
              ? 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
              : 'border-amber-300 dark:border-amber-800 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900'}
          `}
          aria-label={knowledgeLevel ? 'Adjust knowledge level' : 'Set your knowledge level'}
        >
          {knowledgeLevel ? `Level: ${titleCase(knowledgeLevel)}` : 'Set your level'}
        </button>
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

      <Conversation className="flex-1">
        <ConversationContent className="px-5 py-4 space-y-3">
          {renderMessages(activeTab)}
          {chatState[activeTab].loading && <div className="mt-2 text-xs text-gray-400">Thinking…</div>}
          {disabledMessage && chatState[activeTab].messages.length === 0 && (
            <div className="text-sm text-gray-500">{disabledMessage}</div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t border-gray-200 dark:border-gray-800 p-5 space-y-3">
        <PromptInput
          onSubmit={handlePromptSubmit}
          className="shadow-none [&_[data-slot=input-group]]:rounded-2xl [&_[data-slot=input-group]]:border [&_[data-slot=input-group]]:border-gray-200 dark:[&_[data-slot=input-group]]:border-gray-800 [&_[data-slot=input-group]]:bg-white dark:[&_[data-slot=input-group]]:bg-gray-900 [&_[data-slot=input-group]]:px-0 [&_[data-slot=input-group]]:py-0"
        >
          <PromptInputBody>
            <PromptInputTextarea
              value={chatState[activeTab].input}
              onChange={handlePromptInputChange}
              onKeyDown={handleTextareaKeyDown}
              placeholder={
                chatDisabled
                  ? disabledMessage || 'Chat disabled'
                  : activeTab === 'teach'
                  ? 'Ask about the topic…'
                  : 'Describe where you need guidance…'
              }
              disabled={chatDisabled}
              className="px-4 pb-4 pt-5 text-sm"
            />
          </PromptInputBody>
          <PromptInputFooter className="flex-col gap-3 border-t border-gray-100 px-4 pb-4 pt-3 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800">
            <PromptInputTools className="flex items-center gap-2">
              <PromptInputModelSelect
                value={selectedModelId}
                onValueChange={(value: string) => setSelectedModelId(value)}
                disabled={!availableModels.length}
              >
                <PromptInputModelSelectTrigger className="min-w-[160px]">
                  <PromptInputModelSelectValue placeholder="Select model" />
                </PromptInputModelSelectTrigger>
                <PromptInputModelSelectContent>
                  {availableModels.map((model) => (
                    <PromptInputModelSelectItem key={model.id} value={model.modelId}>
                      {model.modelName}
                    </PromptInputModelSelectItem>
                  ))}
                </PromptInputModelSelectContent>
              </PromptInputModelSelect>
            </PromptInputTools>
            <PromptInputSubmit
              disabled={!canSend}
              status={activeChat.loading ? 'streaming' : 'ready'}
            />
          </PromptInputFooter>
        </PromptInput>

        {/* API Key Status / Button */}
        <div className="flex items-center justify-between">
          {hasApiKey ? (
            <button
              type="button"
              onClick={handleOpenApiKeyModal}
              className="inline-flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition"
            >
              <span className="font-mono">{maskApiKey(currentApiKey)}</span>
              <span className="text-[10px] uppercase font-semibold text-gray-400 dark:text-gray-500">
                {getProviderLabel(currentProvider)} key
              </span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 16 16"
                fill="currentColor"
                className="w-3 h-3"
              >
                <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L3.765 9.76a2.782 2.782 0 0 0-.758 1.368l-.442 1.878a.75.75 0 0 0 .896.896l1.878-.442a2.782 2.782 0 0 0 1.368-.758l7.248-7.248a1.75 1.75 0 0 0 0-2.475l-.467-.467Zm-1.415 1.06a.25.25 0 0 1 .354 0l.467.467a.25.25 0 0 1 0 .354L5.648 11.64a1.282 1.282 0 0 1-.631.349l-.895.211.211-.895c.054-.23.167-.44.349-.631l7.247-7.247Z" />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleOpenApiKeyModal}
              className="inline-flex items-center gap-2 rounded-full border border-amber-300 dark:border-amber-800 bg-amber-100 dark:bg-amber-900/40 px-3 py-1 text-xs font-semibold text-amber-800 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900 transition"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 16 16"
                fill="currentColor"
                className="w-3 h-3"
              >
                <path
                  fillRule="evenodd"
                  d="M8 1a3.5 3.5 0 0 0-3.5 3.5V7A1.5 1.5 0 0 0 3 8.5v5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11.5 7V4.5A3.5 3.5 0 0 0 8 1Zm2 6V4.5a2 2 0 1 0-4 0V7h4Z"
                  clipRule="evenodd"
                />
              </svg>
              Enter {getProviderLabel(currentProvider)} API key
            </button>
          )}
        </div>

        {modelsFetched && modelLoadError && (
          <div className="px-1 text-xs text-red-500 dark:text-red-400">
            Unable to load AI models. Please try again.
          </div>
        )}
        {modelsFetched && !modelLoadError && !availableModels.length && (
          <div className="px-1 text-xs text-gray-500 dark:text-gray-400">
            No AI models are configured yet.
          </div>
        )}
      </div>

      {/* API Key Modal */}
      {showApiKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-w-lg w-full bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 space-y-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {getProviderLabel(currentProvider)} API Key
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Enter your {getProviderLabel(currentProvider)} API key to use{' '}
                {currentProvider === 'google' ? 'Gemini' : 'OpenAI'} models.
                Your key is stored locally and sent directly to the AI service.
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                API Key
              </label>
              <input
                type="password"
                value={tempApiKey}
                onChange={(e) => setTempApiKey(e.target.value)}
                placeholder={`Enter your ${getProviderLabel(currentProvider)} API key`}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm"
                autoFocus
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleCancelApiKeyModal}
                className="flex-1 px-4 py-2 rounded-xl font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveApiKey}
                disabled={!tempApiKey.trim()}
                className="flex-1 px-4 py-2 rounded-xl font-semibold text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed shadow"
              >
                Save Key
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
});

export default StudentAiChat;

function generateMessageId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
