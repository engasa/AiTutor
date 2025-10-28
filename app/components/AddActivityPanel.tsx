import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import api from '../lib/api';
import { useCourseTopicsContext } from '../hooks/useCourseTopics';
interface AddActivityPanelProps {
  lessonId: number;
  onActivityCreated: () => void;
}

export default function AddActivityPanel({
  lessonId,
  onActivityCreated,
}: AddActivityPanelProps) {
  const { topics, loading: loadingTopics, error: topicsError } = useCourseTopicsContext();
  const [type, setType] = useState<'MCQ' | 'SHORT_TEXT'>('MCQ');
  const [question, setQuestion] = useState('');
  const [choices, setChoices] = useState<string[]>(['', '', '', '']);
  const [correct, setCorrect] = useState(0);
  const [hasSelectedCorrect, setHasSelectedCorrect] = useState(false);
  const [textAnswer, setTextAnswer] = useState('');
  const [hint, setHint] = useState('');
  const [busy, setBusy] = useState(false);

  const [selectedMainTopicId, setSelectedMainTopicId] = useState<number | ''>('');
  const [selectedSecondaryTopicIds, setSelectedSecondaryTopicIds] = useState<number[]>([]);
  const [topicSelectionError, setTopicSelectionError] = useState<string | null>(null);

  const [enableTeachMode, setEnableTeachMode] = useState(true);
  const [enableGuideMode, setEnableGuideMode] = useState(true);

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

    if (!enableTeachMode && !enableGuideMode) {
      alert('At least one AI mode must be enabled');
      return;
    }

    setBusy(true);
    setTopicSelectionError(null);

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
          mainTopicId,
          secondaryTopicIds: secondaryIds,
          enableTeachMode,
          enableGuideMode,
        });
      } else {
        await api.createActivity(lessonId, {
          question: question.trim(),
          type,
          answer: { text: textAnswer.trim() },
          hints: hint.trim() ? [hint.trim()] : [],
          mainTopicId,
          secondaryTopicIds: secondaryIds,
          enableTeachMode,
          enableGuideMode,
        });
      }

      setQuestion('');
      setChoices(['', '', '', '']);
      setCorrect(0);
      setHasSelectedCorrect(false);
      setTextAnswer('');
      setHint('');
      setSelectedSecondaryTopicIds([]);
      setEnableTeachMode(true);
      setEnableGuideMode(true);
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
            {choices.map((choice, index) => {
              const isSelected = correct === index && hasSelectedCorrect;
              return (
                <label
                  key={index}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl border cursor-pointer transition focus-within:outline-none bg-white dark:bg-gray-900 ${
                    isSelected
                      ? 'border-amber-400 dark:border-amber-600'
                      : 'border-gray-300 dark:border-gray-700 hover:border-amber-300 dark:hover:border-amber-800'
                  }`}
                >
                  <input
                    type="radio"
                    name="correct"
                    className="sr-only"
                    checked={correct === index}
                    onChange={() => {
                      setCorrect(index);
                      setHasSelectedCorrect(true);
                    }}
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
              );
            })}
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
        <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 block">
          AI Study Buddy Modes
        </span>
        <p className="text-xs text-gray-500">
          Choose which AI assistance modes students can use for this activity.
        </p>
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={enableTeachMode}
              onChange={(e) => {
                if (!e.target.checked && !enableGuideMode) {
                  alert('At least one AI mode must be enabled');
                  return;
                }
                setEnableTeachMode(e.target.checked);
              }}
              className="rounded border-purple-300 text-purple-600 focus:ring-purple-500"
            />
            <span className="text-sm">Teach me - Conceptual learning about topics</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={enableGuideMode}
              onChange={(e) => {
                if (!e.target.checked && !enableTeachMode) {
                  alert('At least one AI mode must be enabled');
                  return;
                }
                setEnableGuideMode(e.target.checked);
              }}
              className="rounded border-purple-300 text-purple-600 focus:ring-purple-500"
            />
            <span className="text-sm">Guide me - Step-by-step guidance on this question</span>
          </label>
        </div>
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
