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

export default function EditActivityPanel({
  activity,
  busy,
  error,
  onSubmit,
  onCancel,
}: EditActivityPanelProps) {
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
      className="rounded-[1.6rem] border border-amber-300/16 bg-amber-300/8 p-4"
    >
      <div className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/42">
              Internal title
            </label>
            <input
              value={values.title}
              onChange={(event) => setValues((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="Optional internal label"
              className="input-field"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/42">
              Question type
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  setValues((prev) => ({
                    ...prev,
                    type: 'MCQ',
                    choices: ensureChoiceSlots(prev.choices),
                    correctIndex: 0,
                  }))
                }
                className={values.type === 'MCQ' ? 'btn-primary' : 'btn-secondary'}
              >
                Multiple choice
              </button>
              <button
                type="button"
                onClick={() => setValues((prev) => ({ ...prev, type: 'SHORT_TEXT' }))}
                className={values.type === 'SHORT_TEXT' ? 'btn-primary' : 'btn-secondary'}
              >
                Short answer
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/42">
            Question prompt
          </label>
          <textarea
            value={values.question}
            onChange={(event) => setValues((prev) => ({ ...prev, question: event.target.value }))}
            rows={4}
            className="input-field"
          />
        </div>

        {values.type === 'MCQ' ? (
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/42">
              Choices
            </div>
            {paddedChoices.map((choice, index) => {
              const isSelected = values.correctIndex === index;
              return (
                <label
                  key={index}
                  className={`flex items-center gap-3 rounded-[1rem] border px-4 py-3 ${
                    isSelected
                      ? 'border-amber-300/20 bg-amber-300/12'
                      : 'border-white/10 bg-white/4'
                  }`}
                >
                  <input
                    type="radio"
                    name="correct-choice"
                    className="sr-only"
                    checked={isSelected}
                    onChange={() => setValues((prev) => ({ ...prev, correctIndex: index }))}
                  />
                  <span className="w-7 text-xs font-semibold text-white/52">
                    {choiceLabels[index] ?? String.fromCharCode(65 + index)}
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
                    className="min-w-0 flex-1 border-none bg-transparent text-white focus:outline-none"
                  />
                  {paddedChoices.length > 2 ? (
                    <button
                      type="button"
                      onClick={() =>
                        setValues((prev) => {
                          if (prev.choices.length <= 2) return prev;
                          const nextChoices = ensureChoiceSlots(prev.choices).filter(
                            (_, idx) => idx !== index,
                          );
                          let nextCorrect = prev.correctIndex;
                          if (index <= prev.correctIndex) {
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
                      className="text-xs text-rose-200 hover:text-rose-100"
                    >
                      Remove
                    </button>
                  ) : null}
                </label>
              );
            })}
            <button
              type="button"
              onClick={() =>
                setValues((prev) => ({
                  ...prev,
                  choices: [...ensureChoiceSlots(prev.choices), ''],
                }))
              }
              className="text-sm font-medium text-amber-100 hover:text-amber-50"
            >
              Add choice
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/42">
              Expected answer
            </label>
            <input
              value={values.textAnswer}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, textAnswer: event.target.value }))
              }
              placeholder="Ideal short response"
              className="input-field"
            />
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/42">
              Instructions
            </label>
            <textarea
              value={values.instructionsMd}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, instructionsMd: event.target.value }))
              }
              rows={3}
              className="input-field"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/42">
              Hints
            </label>
            <textarea
              value={values.hintsText}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, hintsText: event.target.value }))
              }
              rows={3}
              className="input-field"
            />
          </div>
        </div>

        {formError || error ? <p className="text-sm text-rose-200">{formError || error}</p> : null}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setValues(activityToFormValues(activity));
              setFormError(null);
              onCancel();
            }}
            disabled={busy}
          >
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>
    </form>
  );
}
