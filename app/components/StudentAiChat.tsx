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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
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
const PROVIDER_LABELS: Record<string, string> = { google: 'Gemini', openai: 'OpenAI' };

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

  // API key state - initialize empty to avoid hydration mismatch, then load from localStorage
  const [providerApiKeys, setProviderApiKeys] = useState<Record<string, string>>({});
  const [apiKeysLoaded, setApiKeysLoaded] = useState(false);
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');
  const [setupApiKeyInput, setSetupApiKeyInput] = useState('');
  const [apiKeyValidating, setApiKeyValidating] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);

  // Load API keys from localStorage after hydration
  useEffect(() => {
    const stored = loadApiKeysFromStorage();
    setProviderApiKeys(stored);
    setApiKeysLoaded(true);
  }, []);

  // Derive current provider and its key
  const currentProvider = getProviderFromModelId(selectedModelId);
  const currentApiKey = providerApiKeys[currentProvider] || '';
  // Only consider API key present after we've loaded from localStorage (avoids hydration mismatch)
  const hasApiKey = apiKeysLoaded && Boolean(currentApiKey);

  // Setup complete when both API key and knowledge level are set
  const setupComplete = hasApiKey && Boolean(knowledgeLevel);

  const availableTabs = useMemo<{ value: ChatTab; label: string }[]>(() => {
    if (!activity) return [];
    const tabs = [];
    if (activity.enableTeachMode) tabs.push({ value: 'teach' as ChatTab, label: 'Teach me' });
    if (activity.enableGuideMode) tabs.push({ value: 'guide' as ChatTab, label: 'Guide me' });
    return tabs;
  }, [activity]);

  const showTabToggle = availableTabs.length > 1;
  const isTeachEnabled = activity?.enableTeachMode ?? false;
  const isGuideEnabled = activity?.enableGuideMode ?? false;
  const currentTabEnabled =
    (activeTab === 'teach' && isTeachEnabled) || (activeTab === 'guide' && isGuideEnabled);

  if (!currentTabEnabled) {
    if (isTeachEnabled) setActiveTab('teach');
    else if (isGuideEnabled) setActiveTab('guide');
    else if (activeTab !== 'teach') setActiveTab('teach');
  }

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const models = await api.listAiModels();
        if (!isMounted) return;
        setAvailableModels(models);
        setSelectedModelId((current) => {
          if (models.some((m) => m.modelId === current)) return current;
          const geminiModel = models.find((m) => m.modelId.includes('gemini-2.5-flash'));
          return geminiModel?.modelId ?? models[0]?.modelId ?? DEFAULT_MODEL_ID;
        });
        setModelLoadError(false);
      } catch (error) {
        if (!isMounted) return;
        console.error('Failed to load AI models:', error);
        setModelLoadError(true);
      } finally {
        if (isMounted) setModelsFetched(true);
      }
    })();
    return () => { isMounted = false; };
  }, []);

  const ensureKnowledgeLevel = useCallback(() => {
    if (!activity) return false;
    if (knowledgeLevel) return true;
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
      if (!activity || !isUserReady) return;

      const modeEnabled =
        (tab === 'teach' && activity.enableTeachMode) ||
        (tab === 'guide' && activity.enableGuideMode);
      if (!modeEnabled) {
        console.warn(`Cannot use disabled ${tab} mode for activity ${activity.id}`);
        return;
      }

      const message = (overrideMessage ?? chatState[tab].input).trim();
      if (!message) return;
      if (!ensureKnowledgeLevel()) return;

      const level = knowledgeLevel;
      if (!level) return;

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
        [tab]: { ...prev[tab], input: overrideMessage ? prev[tab].input : '', loading: true },
      }));

      appendMessage(tab, 'user', message, messageId);

      try {
        const modelId = selectedModelId || DEFAULT_MODEL_ID;
        const response = tab === 'teach'
          ? await api.sendTeachMessage(activity.id, {
              knowledgeLevel: level, topicId, message, modelId, apiKey,
              chatId: chatState[tab].chatId, messageId,
            })
          : await api.sendGuideMessage(activity.id, {
              knowledgeLevel: level, message, studentAnswer: normalizedStudentAnswer,
              modelId, apiKey, chatId: chatState[tab].chatId, messageId,
            });

        const nextChatId = response.chatId ?? chatState[tab].chatId ?? null;
        if (nextChatId) {
          setChatState((prev) => ({ ...prev, [tab]: { ...prev[tab], chatId: nextChatId } }));
        }
        appendMessage(tab, 'assistant', response.message);
      } catch (error) {
        console.error('AI chat failed:', error);
        appendMessage(tab, 'assistant', 'AI study buddy not available right now. Please try again later.');
      } finally {
        setChatState((prev) => ({ ...prev, [tab]: { ...prev[tab], loading: false } }));
      }
    },
    [activity, appendMessage, chatState, currentTopicId, ensureKnowledgeLevel, isUserReady, knowledgeLevel, providerApiKeys, selectedModelId, studentAnswer],
  );

  const guideInput = chatState.guide.input;

  useImperativeHandle(
    ref,
    () => ({
      sendGuidePrompt: () => {
        if (!activity || !activity.enableGuideMode) return;
        const provider = getProviderFromModelId(selectedModelId);
        if (!providerApiKeys[provider]) return;
        const fallback = guideInput.trim() || 'I would like guidance on this question.';
        setActiveTab('guide');
        void sendChat('guide', fallback);
      },
      pushGuideMessage: (content: string) => {
        if (!activity || !content || !activity.enableGuideMode) return;
        appendMessage('guide', 'assistant', content);
      },
    }),
    [activity, appendMessage, guideInput, providerApiKeys, selectedModelId, sendChat],
  );

  const chatDisabled = !activity || !knowledgeLevel || !hasApiKey || !isUserReady;
  const activeChat = chatState[activeTab];
  const canSend = !!activeChat && !activeChat.loading && !chatDisabled && Boolean(activeChat.input.trim());

  const handlePromptInputChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      setChatState((prev) => ({ ...prev, [activeTab]: { ...prev[activeTab], input: event.target.value } }));
    },
    [activeTab],
  );

  const handlePromptSubmit = useCallback(
    (message: PromptInputMessage, event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (canSend && message?.text?.trim()) void sendChat(activeTab);
    },
    [activeTab, canSend, sendChat],
  );

  const handleTextareaKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Enter' && !event.metaKey && !event.shiftKey) {
        event.preventDefault();
        if (canSend) void sendChat(activeTab);
      }
    },
    [activeTab, canSend, sendChat],
  );

  // Setup card: save API key inline with validation
  const handleSetupSaveApiKey = useCallback(async () => {
    if (!setupApiKeyInput.trim()) return;
    
    setApiKeyValidating(true);
    setApiKeyError(null);
    
    try {
      const result = await api.validateApiKey(currentProvider, setupApiKeyInput.trim());
      if (!result.valid) {
        setApiKeyError(result.error || 'Invalid API key');
        return;
      }
      const newKeys = { ...providerApiKeys, [currentProvider]: setupApiKeyInput.trim() };
      setProviderApiKeys(newKeys);
      saveApiKeysToStorage(newKeys);
      setSetupApiKeyInput('');
    } catch (err) {
      setApiKeyError('Could not validate API key');
    } finally {
      setApiKeyValidating(false);
    }
  }, [currentProvider, providerApiKeys, setupApiKeyInput]);

  // Dialog: edit existing API key with validation
  const handleOpenApiKeyDialog = useCallback(() => {
    setTempApiKey(currentApiKey);
    setApiKeyError(null);
    setShowApiKeyDialog(true);
  }, [currentApiKey]);

  const handleSaveApiKeyDialog = useCallback(async () => {
    if (!tempApiKey.trim()) return;
    
    setApiKeyValidating(true);
    setApiKeyError(null);
    
    try {
      const result = await api.validateApiKey(currentProvider, tempApiKey.trim());
      if (!result.valid) {
        setApiKeyError(result.error || 'Invalid API key');
        return;
      }
      const newKeys = { ...providerApiKeys, [currentProvider]: tempApiKey.trim() };
      setProviderApiKeys(newKeys);
      saveApiKeysToStorage(newKeys);
      setShowApiKeyDialog(false);
      setTempApiKey('');
    } catch (err) {
      setApiKeyError('Could not validate API key');
    } finally {
      setApiKeyValidating(false);
    }
  }, [currentProvider, providerApiKeys, tempApiKey]);

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

  // Setup card shown when setup incomplete
  const renderSetupCard = () => (
    <div className="mx-auto max-w-sm rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-5 space-y-4">
      <div className="text-center">
        <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-fuchsia-500 via-pink-500 to-rose-500" />
        <h3 className="font-bold text-gray-900 dark:text-gray-100">Set up your AI Study Buddy</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Complete these steps to start chatting</p>
      </div>

      {/* Step 1: Knowledge Level */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className={`flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${
            knowledgeLevel
              ? 'bg-green-500 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
          }`}>
            {knowledgeLevel ? '✓' : '1'}
          </span>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Knowledge Level</span>
        </div>
        {knowledgeLevel ? (
          <button
            type="button"
            onClick={onAdjustKnowledgeLevel}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-left hover:border-gray-300 dark:hover:border-gray-600 transition"
          >
            <span className="text-gray-900 dark:text-gray-100">{titleCase(knowledgeLevel)}</span>
            <span className="text-xs text-gray-400">Change</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onRequestKnowledgeLevel}
            className="w-full px-3 py-2 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 text-sm font-medium text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition"
          >
            Select your level
          </button>
        )}
      </div>

      {/* Step 2: API Key */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className={`flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${
            hasApiKey
              ? 'bg-green-500 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
          }`}>
            {hasApiKey ? '✓' : '2'}
          </span>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {getProviderLabel(currentProvider)} API Key
          </span>
        </div>
        {hasApiKey ? (
          <button
            type="button"
            onClick={handleOpenApiKeyDialog}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-left hover:border-gray-300 dark:hover:border-gray-600 transition"
          >
            <span className="font-mono text-gray-900 dark:text-gray-100">{maskApiKey(currentApiKey)}</span>
            <span className="text-xs text-gray-400">Change</span>
          </button>
        ) : (
          <div className="space-y-1.5">
            <div className="flex gap-2">
              <input
                type="password"
                value={setupApiKeyInput}
                onChange={(e) => {
                  setSetupApiKeyInput(e.target.value);
                  setApiKeyError(null);
                }}
                placeholder="Enter API key"
                className={`flex-1 px-3 py-2 rounded-xl border bg-white dark:bg-gray-800 text-sm font-mono ${
                  apiKeyError
                    ? 'border-red-400 dark:border-red-600'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
                disabled={apiKeyValidating}
              />
              <button
                type="button"
                onClick={handleSetupSaveApiKey}
                disabled={!setupApiKeyInput.trim() || apiKeyValidating}
                className="px-3 py-2 rounded-xl bg-amber-500 text-white text-sm font-semibold disabled:opacity-50 hover:bg-amber-600 transition"
              >
                {apiKeyValidating ? 'Validating...' : 'Save'}
              </button>
            </div>
            {apiKeyError && (
              <p className="text-xs text-red-500 dark:text-red-400 pl-1">{apiKeyError}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <aside className="flex h-[800px] flex-col rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
      {/* Header */}
      <div className="flex items-center gap-3 p-5 border-b border-gray-200 dark:border-gray-800">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-500 via-pink-500 to-rose-500" />
        <div className="flex-1">
          <div className="font-bold">AI Study Buddy</div>
          <div className="text-xs text-gray-500">Hints, not answers</div>
        </div>
        {/* Show status badges when setup complete */}
        {setupComplete && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onAdjustKnowledgeLevel}
              className="px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-[10px] font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
            >
              {titleCase(knowledgeLevel!)}
            </button>
            <button
              type="button"
              onClick={handleOpenApiKeyDialog}
              className="px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-[10px] font-mono text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
            >
              {maskApiKey(currentApiKey)}
            </button>
          </div>
        )}
      </div>

      {/* Tab toggle + topic selector (only when setup complete) */}
      {setupComplete && (
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
            <div className="px-3 py-1 text-xs font-semibold rounded-full bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
              {availableTabs[0].label}
            </div>
          ) : null}
        </div>
      )}

      {/* Topic selector for teach mode */}
      {setupComplete && activeTab === 'teach' && (
        <div className="px-5 pt-3">
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
            Focus topic
          </label>
          <select
            value={currentTopicId ?? ''}
            onChange={(e) => {
              const value = Number(e.target.value);
              if (Number.isFinite(value)) onSelectTopic(value);
            }}
            disabled={topicOptions.length <= 1}
            className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm disabled:opacity-50"
          >
            {topicOptions.map((topic) => (
              <option key={topic.value} value={topic.value}>{topic.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Conversation area */}
      <Conversation className="flex-1">
        <ConversationContent className="px-5 py-4 space-y-3">
          {!activity ? (
            <div className="text-sm text-gray-500 text-center py-8">Select an activity to begin.</div>
          ) : !setupComplete ? (
            renderSetupCard()
          ) : (
            <>
              {renderMessages(activeTab)}
              {chatState[activeTab].loading && <div className="mt-2 text-xs text-gray-400">Thinking…</div>}
              {chatState[activeTab].messages.length === 0 && (
                <div className="text-sm text-gray-500 text-center py-4">
                  Ask your study buddy anything about this topic!
                </div>
              )}
            </>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* Input area */}
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
                  ? 'Complete setup above to start chatting'
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
                onValueChange={setSelectedModelId}
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
            <PromptInputSubmit disabled={!canSend} status={activeChat.loading ? 'streaming' : 'ready'} />
          </PromptInputFooter>
        </PromptInput>

        {modelsFetched && modelLoadError && (
          <div className="px-1 text-xs text-red-500 dark:text-red-400">Unable to load AI models.</div>
        )}
        {modelsFetched && !modelLoadError && !availableModels.length && (
          <div className="px-1 text-xs text-gray-500 dark:text-gray-400">No AI models configured.</div>
        )}
      </div>

      {/* API Key Edit Dialog */}
      <Dialog open={showApiKeyDialog} onOpenChange={setShowApiKeyDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{getProviderLabel(currentProvider)} API Key</DialogTitle>
            <DialogDescription>
              Update your API key for {getProviderLabel(currentProvider)} models.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <input
              type="password"
              value={tempApiKey}
              onChange={(e) => {
                setTempApiKey(e.target.value);
                setApiKeyError(null);
              }}
              placeholder={`Enter your ${getProviderLabel(currentProvider)} API key`}
              className={`w-full px-4 py-3 rounded-xl border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm ${
                apiKeyError
                  ? 'border-red-400 dark:border-red-600'
                  : 'border-gray-300 dark:border-gray-700'
              }`}
              autoFocus
              disabled={apiKeyValidating}
            />
            {apiKeyError && (
              <p className="text-xs text-red-500 dark:text-red-400">{apiKeyError}</p>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <button
              type="button"
              onClick={() => {
                setShowApiKeyDialog(false);
                setApiKeyError(null);
              }}
              disabled={apiKeyValidating}
              className="px-4 py-2 rounded-xl font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveApiKeyDialog}
              disabled={!tempApiKey.trim() || apiKeyValidating}
              className="px-4 py-2 rounded-xl font-semibold text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed shadow"
            >
              {apiKeyValidating ? 'Validating...' : 'Save'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
