import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import api from '../lib/api';
import { useCourseTopicsContext } from '../hooks/useCourseTopics';

interface AddActivityPanelProps {
  lessonId: number;
  onActivityCreated: () => void;
}

export default function AddActivityPanel({ lessonId, onActivityCreated }: AddActivityPanelProps) {
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

  const [prevTopics, setPrevTopics] = useState(topics);
  if (topics !== prevTopics) {
    setPrevTopics(topics);

    if (topics.length === 0) {
      if (selectedMainTopicId !== '') setSelectedMainTopicId('');
      if (selectedSecondaryTopicIds.length > 0) setSelectedSecondaryTopicIds([]);
    } else if (
      selectedMainTopicId === '' ||
      !topics.some((topic) => topic.id === selectedMainTopicId)
    ) {
      setSelectedMainTopicId(topics[0].id);
    }
  }

  const availableSecondaryTopics = useMemo(
    () =>
      topics.filter(
        (topic) =>
          topic.id !== (typeof selectedMainTopicId === 'number' ? selectedMainTopicId : -1),
      ),
    [topics, selectedMainTopicId],
  );

  const toggleSecondaryForNew = (topicId: number) => {
    setSelectedSecondaryTopicIds((prev) =>
      prev.includes(topicId) ? prev.filter((id) => id !== topicId) : [...prev, topicId],
    );
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
      className="rounded-[1.8rem] border border-white/10 bg-black/18 p-6 shadow-[0_16px_50px_rgba(3,7,18,0.22)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-white/40">
            New activity
          </div>
          <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">
            Compose the next question
          </h3>
        </div>
        <div className="tag tag-accent">Lesson authoring</div>
      </div>

      <div className="mt-6 flex gap-2 text-sm">
        {(['MCQ', 'SHORT_TEXT'] as const).map((nextType) => (
          <button
            key={nextType}
            type="button"
            onClick={() => setType(nextType)}
            className={type === nextType ? 'btn-primary' : 'btn-secondary'}
          >
            {nextType === 'MCQ' ? 'Multiple choice' : 'Short answer'}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-2">
        <label className="text-sm font-medium text-white">Question prompt</label>
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Write the question learners should answer..."
          rows={4}
          className="input-field"
        />
      </div>

      {type === 'MCQ' ? (
        <div className="mt-6 space-y-3">
          <div className="text-sm font-medium text-white">Choices</div>
          {choices.map((choice, index) => {
            const isSelected = correct === index && hasSelectedCorrect;
            return (
              <label
                key={index}
                className={`flex items-center gap-3 rounded-[1rem] border px-4 py-3 ${
                  isSelected ? 'border-amber-300/20 bg-amber-300/12' : 'border-white/10 bg-white/4'
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
                <span className="w-7 text-xs font-semibold text-white/54">
                  {String.fromCharCode(65 + index)}
                </span>
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
                  className="min-w-0 flex-1 border-none bg-transparent text-white placeholder:text-white/35 focus:outline-none"
                />
              </label>
            );
          })}
        </div>
      ) : (
        <div className="mt-6 space-y-2">
          <label className="text-sm font-medium text-white">Expected answer</label>
          <input
            value={textAnswer}
            onChange={(event) => setTextAnswer(event.target.value)}
            placeholder="Ideal short response..."
            className="input-field"
          />
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium text-white">Main topic</label>
          <select
            value={selectedMainTopicId === '' ? '' : selectedMainTopicId}
            onChange={(event) => {
              const newMainTopicId = event.target.value ? Number(event.target.value) : '';
              setSelectedMainTopicId(newMainTopicId);
              if (typeof newMainTopicId === 'number') {
                setSelectedSecondaryTopicIds((prev) => prev.filter((id) => id !== newMainTopicId));
              }
            }}
            disabled={loadingTopics || topics.length === 0}
            className="input-field text-sm"
          >
            <option value="">Select a topic…</option>
            {topics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.name}
              </option>
            ))}
          </select>
          {topicSelectionError ? (
            <p className="text-xs text-rose-200">{topicSelectionError}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <span className="text-sm font-medium text-white">Hint</span>
          <input
            value={hint}
            onChange={(event) => setHint(event.target.value)}
            placeholder="Optional hint for students..."
            className="input-field"
          />
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <span className="text-sm font-medium text-white">Secondary topics</span>
        <div className="flex flex-wrap gap-2">
          {availableSecondaryTopics.length === 0 ? (
            <span className="text-xs text-white/42">No other topics available.</span>
          ) : (
            availableSecondaryTopics.map((topic) => {
              const checked = selectedSecondaryTopicIds.includes(topic.id);
              return (
                <label
                  key={topic.id}
                  className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs ${
                    checked
                      ? 'border-cyan-300/20 bg-cyan-300/12 text-cyan-100'
                      : 'border-white/10 bg-white/5 text-white/72'
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

      <div className="mt-6 rounded-[1.3rem] border border-white/10 bg-white/4 p-4">
        <div className="text-sm font-medium text-white">AI study buddy modes</div>
        <p className="mt-1 text-xs text-white/46">
          Choose which forms of help students can access on this activity.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-3 rounded-[1rem] border border-white/10 bg-black/15 px-4 py-3 text-sm text-white">
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
            />
            Teach me
          </label>
          <label className="flex items-center gap-3 rounded-[1rem] border border-white/10 bg-black/15 px-4 py-3 text-sm text-white">
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
            />
            Guide me
          </label>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy || !question.trim()} className="btn-primary">
          <Plus className="h-4 w-4" />
          {busy ? 'Adding...' : 'Add activity'}
        </button>
        {topicsError ? <p className="text-xs text-rose-200">{topicsError}</p> : null}
      </div>
    </form>
  );
}
