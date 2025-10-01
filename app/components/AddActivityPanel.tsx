import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import api from '../lib/api';
import { useCourseTopicsContext } from '../hooks/useCourseTopics';
import type { PromptTemplate } from '../lib/types';

interface PromptFormState {
  name: string;
  systemPrompt: string;
  userPrompt: string;
  temperature: string;
  topP: string;
}

interface AddActivityPanelProps {
  lessonId: number;
  prompts: PromptTemplate[];
  loadingPrompts: boolean;
  onPromptCreated: (prompt: PromptTemplate) => void;
  onActivityCreated: () => void;
}

export default function AddActivityPanel({
  lessonId,
  prompts,
  loadingPrompts,
  onPromptCreated,
  onActivityCreated,
}: AddActivityPanelProps) {
  const { topics, loading: loadingTopics, error: topicsError } = useCourseTopicsContext();
  const [type, setType] = useState<'MCQ' | 'SHORT_TEXT'>('MCQ');
  const [question, setQuestion] = useState('');
  const [choices, setChoices] = useState<string[]>(['', '', '', '']);
  const [correct, setCorrect] = useState(0);
  const [textAnswer, setTextAnswer] = useState('');
  const [hint, setHint] = useState('');
  const [busy, setBusy] = useState(false);

  const [selectedMainTopicId, setSelectedMainTopicId] = useState<number | ''>('');
  const [selectedSecondaryTopicIds, setSelectedSecondaryTopicIds] = useState<number[]>([]);
  const [topicSelectionError, setTopicSelectionError] = useState<string | null>(null);

  const [selectedPromptId, setSelectedPromptId] = useState<number | ''>('');
  const [showPromptForm, setShowPromptForm] = useState(false);
  const [promptForm, setPromptForm] = useState<PromptFormState>({
    name: '',
    systemPrompt: '',
    userPrompt: '',
    temperature: '',
    topP: '',
  });
  const [creatingPrompt, setCreatingPrompt] = useState(false);
  const [promptError, setPromptError] = useState<string | null>(null);

  // Adjust main topic selection during render when topics change
  const [prevTopics, setPrevTopics] = useState(topics);
  if (topics !== prevTopics) {
    setPrevTopics(topics);

    if (topics.length === 0) {
      if (selectedMainTopicId !== '') setSelectedMainTopicId('');
      if (selectedSecondaryTopicIds.length > 0) setSelectedSecondaryTopicIds([]);
    } else {
      // If current selection is invalid, default to first topic
      if (selectedMainTopicId === '' || !topics.some((topic) => topic.id === selectedMainTopicId)) {
        setSelectedMainTopicId(topics[0].id);
      }
    }
  }

  const availableSecondaryTopics = useMemo(
    () =>
      topics.filter(
        (topic) => topic.id !== (typeof selectedMainTopicId === 'number' ? selectedMainTopicId : -1),
      ),
    [topics, selectedMainTopicId],
  );

  const resetPromptForm = () => {
    setPromptForm({
      name: '',
      systemPrompt: '',
      userPrompt: '',
      temperature: '',
      topP: '',
    });
  };

  const togglePromptForm = () => {
    setPromptError(null);
    setShowPromptForm((open) => {
      const next = !open;
      if (!next) {
        resetPromptForm();
      }
      return next;
    });
  };

  const handleCreatePrompt = async () => {
    if (creatingPrompt) return;
    const name = promptForm.name.trim();
    const systemPrompt = promptForm.systemPrompt.trim();
    const userPrompt = promptForm.userPrompt.trim();

    if (!name || !systemPrompt || !userPrompt) {
      setPromptError('Please provide a name, system prompt, and user prompt.');
      return;
    }

    const payload: Parameters<typeof api.createPrompt>[0] = {
      name,
      systemPrompt,
      userPrompt,
    };

    if (promptForm.temperature.trim()) {
      const value = Number(promptForm.temperature);
      if (!Number.isFinite(value)) {
        setPromptError('Temperature must be a number.');
        return;
      }
      payload.temperature = value;
    }

    if (promptForm.topP.trim()) {
      const value = Number(promptForm.topP);
      if (!Number.isFinite(value)) {
        setPromptError('Top P must be a number.');
        return;
      }
      payload.topP = value;
    }

    setCreatingPrompt(true);
    setPromptError(null);
    try {
      const created = await api.createPrompt(payload);
      onPromptCreated(created);
      setSelectedPromptId(created.id);
      setShowPromptForm(false);
      resetPromptForm();
    } catch (error) {
      console.error('Failed to create prompt', error);
      setPromptError('Could not create prompt. Please try again.');
    } finally {
      setCreatingPrompt(false);
    }
  };

  const toggleSecondaryForNew = (topicId: number) => {
    setSelectedSecondaryTopicIds((prev) => {
      if (prev.includes(topicId)) {
        return prev.filter((id) => id !== topicId);
      }
      return [...prev, topicId];
    });
  };

  const handleAddActivity = async (event: FormEvent) => {
    event.preventDefault();
    if (!question.trim()) return;
    if (selectedMainTopicId === '') {
      setTopicSelectionError('Select a main topic to continue.');
      return;
    }

    setBusy(true);
    setTopicSelectionError(null);

    const promptTemplateId = selectedPromptId === '' ? null : selectedPromptId;
    const mainTopicId = Number(selectedMainTopicId);
    const secondaryIds = selectedSecondaryTopicIds.filter((id) => id !== mainTopicId);

    try {
      if (type === 'MCQ') {
        await api.createActivity(lessonId, {
          question: question.trim(),
          type,
          options: { choices },
          answer: { correctIndex: correct },
          hints: hint.trim() ? [hint.trim()] : [],
          promptTemplateId,
          mainTopicId,
          secondaryTopicIds: secondaryIds,
        });
      } else {
        await api.createActivity(lessonId, {
          question: question.trim(),
          type,
          answer: { text: textAnswer.trim() },
          hints: hint.trim() ? [hint.trim()] : [],
          promptTemplateId,
          mainTopicId,
          secondaryTopicIds: secondaryIds,
        });
      }

      setQuestion('');
      setChoices(['', '', '', '']);
      setCorrect(0);
      setTextAnswer('');
      setHint('');
      setSelectedSecondaryTopicIds([]);
      onActivityCreated();
    } catch (error) {
      console.error('Failed to add activity', error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={handleAddActivity}
      className="p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 space-y-3"
    >
      <div className="font-semibold">Add Activity</div>
      <div className="flex gap-2 text-sm">
        <label
          className={`px-3 py-1 rounded-full cursor-pointer ${
            type === 'MCQ' ? 'bg-sky-100 dark:bg-sky-900' : 'bg-gray-100 dark:bg-gray-800'
          }`}
        >
          <input
            type="radio"
            name="type"
            className="sr-only"
            checked={type === 'MCQ'}
            onChange={() => setType('MCQ')}
          />
          MCQ
        </label>
        <label
          className={`px-3 py-1 rounded-full cursor-pointer ${
            type === 'SHORT_TEXT' ? 'bg-sky-100 dark:bg-sky-900' : 'bg-gray-100 dark:bg-gray-800'
          }`}
        >
          <input
            type="radio"
            name="type"
            className="sr-only"
            checked={type === 'SHORT_TEXT'}
            onChange={() => setType('SHORT_TEXT')}
          />
          Short answer
        </label>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">
          Question prompt
        </label>
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Write the question learners should answer…"
          rows={4}
          className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-transparent"
        />
      </div>

      {type === 'MCQ' ? (
        <div className="space-y-3">
          <div className="text-xs font-semibold text-gray-600 dark:text-gray-400">Choices</div>
          <div className="space-y-2">
            {choices.map((choice, index) => (
              <label
                key={index}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl border ${
                  correct === index
                    ? 'border-transparent ring-2 ring-offset-2 ring-amber-500 dark:ring-offset-gray-950'
                    : 'border-gray-300 dark:border-gray-700'
                }`}
              >
                <input
                  type="radio"
                  name="correct"
                  className="sr-only"
                  checked={correct === index}
                  onChange={() => setCorrect(index)}
                />
                <span className="text-xs font-semibold text-gray-500 w-6">{String.fromCharCode(65 + index)}.</span>
                <input
                  value={choice}
                  onChange={(event) =>
                    setChoices((prev) => {
                      const next = [...prev];
                      next[index] = event.target.value;
                      return next;
                    })
                  }
                  placeholder="Option text"
                  className="flex-1 min-w-0 border-none bg-transparent focus:outline-none"
                />
              </label>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">
            Expected answer
          </label>
          <input
            value={textAnswer}
            onChange={(event) => setTextAnswer(event.target.value)}
            placeholder="Ideal short response…"
            className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-transparent"
          />
        </div>
      )}

      <div className="space-y-2">
        <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Main topic</label>
        <select
          value={selectedMainTopicId === '' ? '' : selectedMainTopicId}
          onChange={(event) => {
            const newMainTopicId = event.target.value ? Number(event.target.value) : '';
            setSelectedMainTopicId(newMainTopicId);
            // Remove new main topic from secondary topics if it was selected there
            if (typeof newMainTopicId === 'number') {
              setSelectedSecondaryTopicIds((prev) => prev.filter((id) => id !== newMainTopicId));
            }
          }}
          disabled={loadingTopics || topics.length === 0}
          className="w-full px-3 py-2 rounded-xl border border-indigo-200 dark:border-indigo-900 bg-white dark:bg-gray-950 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-60"
        >
          <option value="">Select a topic…</option>
          {topics.map((topic) => (
            <option key={topic.id} value={topic.id}>
              {topic.name}
            </option>
          ))}
        </select>
        {topicSelectionError && (
          <p className="text-xs text-rose-500">{topicSelectionError}</p>
        )}
      </div>

      <div className="space-y-2">
        <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 block">
          Secondary topics (optional)
        </span>
        <div className="flex flex-wrap gap-2">
          {availableSecondaryTopics.length === 0 ? (
            <span className="text-xs text-gray-500">No other topics available.</span>
          ) : (
            availableSecondaryTopics.map((topic) => {
              const checked = selectedSecondaryTopicIds.includes(topic.id);
              return (
                <label
                  key={topic.id}
                  className={`flex items-center gap-2 px-3 py-1 rounded-full border text-xs cursor-pointer transition ${
                    checked
                      ? 'border-transparent bg-indigo-500 text-white shadow'
                      : 'border-indigo-200 dark:border-indigo-900 bg-indigo-50/60 dark:bg-indigo-950/20'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    onChange={() => toggleSecondaryForNew(topic.id)}
                  />
                  {topic.name}
                </label>
              );
            })
          )}
        </div>
      </div>

      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between text-sm font-semibold">
          <span>Prompt</span>
          <button
            type="button"
            onClick={togglePromptForm}
            className="text-xs font-medium text-purple-600 hover:text-purple-500 dark:text-purple-300"
          >
            {showPromptForm ? 'Cancel' : 'New prompt'}
          </button>
        </div>
        <select
          value={selectedPromptId === '' ? '' : selectedPromptId}
          onChange={(event) =>
            setSelectedPromptId(event.target.value ? Number(event.target.value) : '')
          }
          disabled={loadingPrompts || creatingPrompt}
          className="w-full px-3 py-2 rounded-xl border border-purple-200 dark:border-purple-900 bg-white dark:bg-gray-950 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent disabled:opacity-60"
        >
          <option value="">No prompt</option>
          {prompts.map((prompt) => (
            <option key={prompt.id} value={prompt.id}>
              {prompt.name}
            </option>
          ))}
        </select>
        {!loadingPrompts && prompts.length === 0 && (
          <p className="text-xs text-gray-500">
            Create a reusable prompt to guide AI feedback for this activity.
          </p>
        )}
        {showPromptForm && (
          <div className="rounded-xl border border-purple-200/70 dark:border-purple-900/60 bg-purple-50/60 dark:bg-purple-950/30 p-4 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-purple-700 dark:text-purple-200 mb-1">
                Name
              </label>
              <input
                value={promptForm.name}
                onChange={(event) =>
                  setPromptForm((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="Friendly reminder prompt"
                className="w-full px-3 py-2 rounded-lg border border-purple-200 dark:border-purple-900 bg-white dark:bg-gray-950 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-purple-700 dark:text-purple-200 mb-1">
                System prompt
              </label>
              <textarea
                value={promptForm.systemPrompt}
                onChange={(event) =>
                  setPromptForm((prev) => ({ ...prev, systemPrompt: event.target.value }))
                }
                rows={3}
                placeholder="You are a helpful TA who offers hints without giving away the answer."
                className="w-full px-3 py-2 rounded-lg border border-purple-200 dark:border-purple-900 bg-white dark:bg-gray-950 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-purple-700 dark:text-purple-200 mb-1">
                User prompt template
              </label>
              <textarea
                value={promptForm.userPrompt}
                onChange={(event) =>
                  setPromptForm((prev) => ({ ...prev, userPrompt: event.target.value }))
                }
                rows={3}
                placeholder="Lesson: {{lesson_title}}\nQuestion: {{question_prompt}}\nStudent answer: {{student_answer}}\nOffer a concise hint."
                className="w-full px-3 py-2 rounded-lg border border-purple-200 dark:border-purple-900 bg-white dark:bg-gray-950 text-sm"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-purple-700 dark:text-purple-200 mb-1">
                  Temperature (optional)
                </label>
                <input
                  value={promptForm.temperature}
                  onChange={(event) =>
                    setPromptForm((prev) => ({ ...prev, temperature: event.target.value }))
                  }
                  placeholder="0.2"
                  className="w-full px-3 py-2 rounded-lg border border-purple-200 dark:border-purple-900 bg-white dark:bg-gray-950 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-purple-700 dark:text-purple-200 mb-1">
                  Top P (optional)
                </label>
                <input
                  value={promptForm.topP}
                  onChange={(event) =>
                    setPromptForm((prev) => ({ ...prev, topP: event.target.value }))
                  }
                  placeholder="0.9"
                  className="w-full px-3 py-2 rounded-lg border border-purple-200 dark:border-purple-900 bg-white dark:bg-gray-950 text-sm"
                />
              </div>
            </div>
            {promptError && <p className="text-xs text-rose-500">{promptError}</p>}
            <button
              type="button"
              onClick={handleCreatePrompt}
              disabled={creatingPrompt}
              className="w-full px-4 py-2 rounded-lg text-white font-semibold bg-gradient-to-r from-purple-600 to-pink-600 disabled:opacity-60"
            >
              {creatingPrompt ? 'Saving…' : 'Create prompt'}
            </button>
          </div>
        )}
      </div>

      <input
        value={hint}
        onChange={(event) => setHint(event.target.value)}
        placeholder="Optional hint…"
        className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-transparent"
      />

      <button
        type="submit"
        disabled={busy || !question.trim()}
        className="w-full px-4 py-2 rounded-xl text-white font-semibold bg-gradient-to-r from-indigo-600 to-fuchsia-600 disabled:opacity-50"
      >
        {busy ? 'Adding…' : 'Add Activity'}
      </button>

      {topicsError && <p className="text-xs text-rose-500">{topicsError}</p>}
    </form>
  );
}
