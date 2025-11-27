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

  // API key state
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

  const currentProvider = getProviderFromModelId(selectedModelId);
  const currentApiKey = providerApiKeys[currentProvider] || '';
  const hasApiKey = apiKeysLoaded && Boolean(currentApiKey);
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
    <div className="space-y-4">
      {chatState[tab].messages.map((msg) => (
        <Message from={msg.role} key={msg.id}>
          <MessageContent
            className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
              msg.role === 'user'
                ? 'ml-auto bg-primary text-primary-foreground shadow-sm'
                : 'bg-secondary text-secondary-foreground border border-border'
            }`}
          >
            <MessageResponse>{msg.content}</MessageResponse>
          </MessageContent>
        </Message>
      ))}
    </div>
  );

  const renderSetupCard = () => (
    <div className="mx-auto max-w-sm card-editorial p-6 space-y-5 animate-scale-in">
      <div className="text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
        </div>
        <h3 className="font-display text-lg font-bold text-foreground">Set up your AI Study Buddy</h3>
        <p className="text-xs text-muted-foreground mt-1">Complete these steps to start chatting</p>
      </div>

      {/* Step 1: Knowledge Level */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
            knowledgeLevel
              ? 'bg-accent text-accent-foreground'
              : 'bg-secondary text-muted-foreground'
          }`}>
            {knowledgeLevel ? (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            ) : '1'}
          </span>
          <span className="text-sm font-semibold text-foreground">Knowledge Level</span>
        </div>
        {knowledgeLevel ? (
          <button
            type="button"
            onClick={onAdjustKnowledgeLevel}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 border-border bg-card text-sm text-left hover:border-primary/30 transition group"
          >
            <span className="font-medium text-foreground">{titleCase(knowledgeLevel)}</span>
            <span className="text-xs text-muted-foreground group-hover:text-foreground transition">Change</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onRequestKnowledgeLevel}
            className="btn-primary w-full"
          >
            Select your level
          </button>
        )}
      </div>

      {/* Step 2: API Key */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
            hasApiKey
              ? 'bg-accent text-accent-foreground'
              : 'bg-secondary text-muted-foreground'
          }`}>
            {hasApiKey ? (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            ) : '2'}
          </span>
          <span className="text-sm font-semibold text-foreground">
            {getProviderLabel(currentProvider)} API Key
          </span>
        </div>
        {hasApiKey ? (
          <button
            type="button"
            onClick={handleOpenApiKeyDialog}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 border-border bg-card text-sm text-left hover:border-primary/30 transition group"
          >
            <span className="font-mono text-foreground">{maskApiKey(currentApiKey)}</span>
            <span className="text-xs text-muted-foreground group-hover:text-foreground transition">Change</span>
          </button>
        ) : (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="password"
                value={setupApiKeyInput}
                onChange={(e) => {
                  setSetupApiKeyInput(e.target.value);
                  setApiKeyError(null);
                }}
                placeholder="Enter API key"
                className={`input-field flex-1 font-mono text-sm ${
                  apiKeyError ? 'border-destructive' : ''
                }`}
                disabled={apiKeyValidating}
              />
              <button
                type="button"
                onClick={handleSetupSaveApiKey}
                disabled={!setupApiKeyInput.trim() || apiKeyValidating}
                className="btn-primary px-4"
              >
                {apiKeyValidating ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : 'Save'}
              </button>
            </div>
            {apiKeyError && (
              <p className="text-xs text-destructive pl-1">{apiKeyError}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <aside className="flex h-[700px] flex-col card-editorial overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-5 border-b border-border">
        <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display font-bold text-foreground">AI Study Buddy</div>
          <div className="text-xs text-muted-foreground">Hints, not answers</div>
        </div>
        {/* Status badges when setup complete */}
        {setupComplete && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={onAdjustKnowledgeLevel}
              className="tag hover:bg-muted transition"
            >
              {titleCase(knowledgeLevel!)}
            </button>
            <button
              type="button"
              onClick={handleOpenApiKeyDialog}
              className="tag font-mono hover:bg-muted transition"
            >
              {maskApiKey(currentApiKey)}
            </button>
          </div>
        )}
      </div>

      {/* Tab toggle + topic selector */}
      {setupComplete && (
        <div className="px-5 pt-4 space-y-3">
          <div className="flex items-center gap-3">
            {showTabToggle ? (
              <div className="flex rounded-xl bg-secondary p-1">
                {availableTabs.map((tab) => (
                  <button
                    key={tab.value}
                    onClick={() => setActiveTab(tab.value)}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      activeTab === tab.value
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            ) : availableTabs.length === 1 ? (
              <div className="tag">
                {availableTabs[0].label}
              </div>
            ) : null}
          </div>

          {/* Topic selector for teach mode */}
          {activeTab === 'teach' && topicOptions.length > 1 && (
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Focus topic
              </label>
              <select
                value={currentTopicId ?? ''}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  if (Number.isFinite(value)) onSelectTopic(value);
                }}
                disabled={topicOptions.length <= 1}
                className="input-field py-2 text-sm"
              >
                {topicOptions.map((topic) => (
                  <option key={topic.value} value={topic.value}>{topic.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Conversation area */}
      <Conversation className="flex-1 min-h-0">
        <ConversationContent className="px-5 py-4">
          {!activity ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
              </div>
              <p className="text-sm text-muted-foreground">Select an activity to begin.</p>
            </div>
          ) : !setupComplete ? (
            renderSetupCard()
          ) : (
            <>
              {renderMessages(activeTab)}
              {chatState[activeTab].loading && (
                <div className="flex items-center gap-2 mt-4 text-muted-foreground animate-pulse-soft">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-current animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 rounded-full bg-current animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 rounded-full bg-current animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-xs">Thinking...</span>
                </div>
              )}
              {chatState[activeTab].messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <div className="w-12 h-12 rounded-xl bg-accent/50 flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-accent-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
                    </svg>
                  </div>
                  <p className="text-sm text-muted-foreground max-w-[200px]">
                    Ask your study buddy anything about this topic!
                  </p>
                </div>
              )}
            </>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* Input area */}
      <div className="border-t border-border p-4 space-y-3">
        <PromptInput
          onSubmit={handlePromptSubmit}
          className="shadow-none [&_[data-slot=input-group]]:rounded-xl [&_[data-slot=input-group]]:border-2 [&_[data-slot=input-group]]:border-border [&_[data-slot=input-group]]:bg-card [&_[data-slot=input-group]]:px-0 [&_[data-slot=input-group]]:py-0"
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
                  ? 'Ask about the topic...'
                  : 'Describe where you need guidance...'
              }
              disabled={chatDisabled}
              className="px-4 pb-3 pt-4 text-sm"
            />
          </PromptInputBody>
          <PromptInputFooter className="flex-col gap-3 border-t border-border px-4 pb-3 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <PromptInputTools className="flex items-center gap-2">
              <PromptInputModelSelect
                value={selectedModelId}
                onValueChange={setSelectedModelId}
                disabled={!availableModels.length}
              >
                <PromptInputModelSelectTrigger className="min-w-[140px] h-8 text-xs">
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
          <div className="flex items-center gap-2 text-xs text-destructive">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            Unable to load AI models.
          </div>
        )}
        {modelsFetched && !modelLoadError && !availableModels.length && (
          <div className="text-xs text-muted-foreground">No AI models configured.</div>
        )}
      </div>

      {/* API Key Edit Dialog */}
      <Dialog open={showApiKeyDialog} onOpenChange={setShowApiKeyDialog}>
        <DialogContent className="sm:max-w-md card-editorial">
          <DialogHeader>
            <DialogTitle className="font-display">{getProviderLabel(currentProvider)} API Key</DialogTitle>
            <DialogDescription>
              Update your API key for {getProviderLabel(currentProvider)} models.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <input
              type="password"
              value={tempApiKey}
              onChange={(e) => {
                setTempApiKey(e.target.value);
                setApiKeyError(null);
              }}
              placeholder={`Enter your ${getProviderLabel(currentProvider)} API key`}
              className={`input-field font-mono text-sm ${
                apiKeyError ? 'border-destructive' : ''
              }`}
              autoFocus
              disabled={apiKeyValidating}
            />
            {apiKeyError && (
              <p className="text-xs text-destructive">{apiKeyError}</p>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <button
              type="button"
              onClick={() => {
                setShowApiKeyDialog(false);
                setApiKeyError(null);
              }}
              disabled={apiKeyValidating}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveApiKeyDialog}
              disabled={!tempApiKey.trim() || apiKeyValidating}
              className="btn-primary"
            >
              {apiKeyValidating ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Validating...
                </>
              ) : 'Save'}
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
