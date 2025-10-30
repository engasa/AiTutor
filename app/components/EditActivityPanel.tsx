import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import type { Activity } from '../lib/types';
import {
  activityToFormValues,
  buildUpdatePayload,
  ensureChoiceSlots,
  type ActivityFormValues,
} from '../lib/activityForm';

type EditActivityPanelProps = {
  activity: Activity;
  busy?: boolean;
  error?: string | null;
  onSubmit: (payload: {
    title: string | null;
    instructionsMd: string;
    question: string;
    type: 'MCQ' | 'SHORT_TEXT';
    options: string[] | null;
    answer: any;
    hints: string[];
  }) => Promise<void> | void;
  onCancel: () => void;
};

export default function EditActivityPanel({ activity, busy, error, onSubmit, onCancel }: EditActivityPanelProps) {
  const [values, setValues] = useState<ActivityFormValues>(() => activityToFormValues(activity));
  const [formError, setFormError] = useState<string | null>(null);
  const [prevActivity, setPrevActivity] = useState(activity);

  if (prevActivity !== activity) {
    setPrevActivity(activity);
    setValues(activityToFormValues(activity));
    setFormError(null);
  }

  const paddedChoices = useMemo(() => ensureChoiceSlots(values.choices), [values.choices]);
  const choiceLabels = useMemo(
    () => paddedChoices.map((_, index) => String.fromCharCode(65 + index)),
    [paddedChoices],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { payload, error: buildError } = buildUpdatePayload(values);
    if (buildError || !payload) {
      setFormError(buildError ?? 'Invalid activity data.');
      return;
    }
    setFormError(null);
    await onSubmit(payload);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/40 dark:bg-indigo-950/40 p-3 space-y-3"
    >
      <div className="space-y-2">
        <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">
          Internal title (optional)
        </label>
        <input
          value={values.title}
          onChange={(event) => setValues((prev) => ({ ...prev, title: event.target.value }))}
          placeholder="Optional internal label"
          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-sm"
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">
          Question prompt
        </label>
        <textarea
          value={values.question}
          onChange={(event) => setValues((prev) => ({ ...prev, question: event.target.value }))}
          rows={4}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-sm"
        />
      </div>

      <div className="flex gap-2 text-sm">
        <label
          className={`px-3 py-1 rounded-full cursor-pointer ${
            values.type === 'MCQ' ? 'bg-sky-100 dark:bg-sky-900' : 'bg-gray-100 dark:bg-gray-800'
          }`}
        >
          <input
            type="radio"
            name="edit-type"
            className="sr-only"
            checked={values.type === 'MCQ'}
            onChange={() =>
              setValues((prev) => ({
                ...prev,
                type: 'MCQ',
                choices: ensureChoiceSlots(prev.choices),
                correctIndex: 0,
              }))
            }
          />
          MCQ
        </label>
        <label
          className={`px-3 py-1 rounded-full cursor-pointer ${
            values.type === 'SHORT_TEXT'
              ? 'bg-sky-100 dark:bg-sky-900'
              : 'bg-gray-100 dark:bg-gray-800'
          }`}
        >
          <input
            type="radio"
            name="edit-type"
            className="sr-only"
            checked={values.type === 'SHORT_TEXT'}
            onChange={() =>
              setValues((prev) => ({
                ...prev,
                type: 'SHORT_TEXT',
              }))
            }
          />
          Short answer
        </label>
      </div>

      {values.type === 'MCQ' ? (
        <div className="space-y-3">
          <div className="text-xs font-semibold text-gray-600 dark:text-gray-400">Choices</div>
          <div className="space-y-2">
            {paddedChoices.map((choice, index) => {
              const isSelected = values.correctIndex === index;
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
                    name="correct-choice"
                    className="sr-only"
                    checked={isSelected}
                    onChange={() =>
                      setValues((prev) => ({
                        ...prev,
                        correctIndex: index,
                      }))
                    }
                  />
                  <span className="text-xs font-semibold text-gray-500 w-6">
                    {choiceLabels[index] ?? String.fromCharCode(65 + index)}.
                  </span>
                  <input
                    value={choice}
                    onChange={(event) =>
                      setValues((prev) => {
                        const nextChoices = ensureChoiceSlots(prev.choices);
                        nextChoices[index] = event.target.value;
                        return { ...prev, choices: nextChoices };
                      })
                    }
                    placeholder="Option text"
                    className="flex-1 min-w-0 border-none bg-transparent focus:outline-none"
                  />
                  {paddedChoices.length > 2 && (
                    <button
                      type="button"
                      onClick={() =>
                        setValues((prev) => {
                          if (prev.choices.length <= 2) return prev;
                          const nextChoices = ensureChoiceSlots(prev.choices).filter(
                            (_, idx) => idx !== index,
                          );
                          let nextCorrect = prev.correctIndex;
                          if (index === prev.correctIndex) {
                            nextCorrect = Math.max(0, nextCorrect - 1);
                          } else if (index < prev.correctIndex) {
                            nextCorrect = Math.max(0, nextCorrect - 1);
                          }
                          nextCorrect = Math.min(nextCorrect, nextChoices.length - 1);
                          return {
                            ...prev,
                            choices: ensureChoiceSlots(nextChoices),
                            correctIndex: nextCorrect,
                          };
                        })
                      }
                      className="text-[0.7rem] text-rose-500"
                    >
                      Remove
                    </button>
                  )}
                </label>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() =>
              setValues((prev) => ({
                ...prev,
                choices: [...ensureChoiceSlots(prev.choices), ''],
              }))
            }
            className="text-xs font-medium text-indigo-600 hover:text-indigo-500"
          >
            Add choice
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">
            Expected answer
          </label>
          <input
            value={values.textAnswer}
            onChange={(event) => setValues((prev) => ({ ...prev, textAnswer: event.target.value }))}
            placeholder="Ideal short response"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-sm"
          />
        </div>
      )}

      <div className="space-y-2">
        <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">
          Instructions (optional)
        </label>
        <textarea
          value={values.instructionsMd}
          onChange={(event) => setValues((prev) => ({ ...prev, instructionsMd: event.target.value }))}
          rows={3}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-sm"
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">
          Hints (one per line)
        </label>
        <textarea
          value={values.hintsText}
          onChange={(event) => setValues((prev) => ({ ...prev, hintsText: event.target.value }))}
          rows={3}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-sm"
        />
      </div>

      {(formError || error) && (
        <p className="text-xs text-rose-500">{formError || error}</p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm"
          onClick={() => {
            setValues(activityToFormValues(activity));
            setFormError(null);
            onCancel();
          }}
          disabled={busy}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold disabled:opacity-60"
          disabled={busy}
        >
          {busy ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}
