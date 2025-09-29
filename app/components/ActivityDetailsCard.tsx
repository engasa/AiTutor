import { memo, useMemo, useState } from 'react';
import type { Activity } from '../lib/types';

type ActivityDetailsCardProps = {
  activity: Activity;
};

function ActivityDetailsCard({ activity }: ActivityDetailsCardProps) {
  const [open, setOpen] = useState(false);

  const details = useMemo(() => {
    const choices = activity.options?.choices ?? [];
    const correctChoiceIndex =
      activity.type === 'MCQ' && typeof activity.answer?.correctIndex === 'number'
        ? activity.answer.correctIndex
        : null;
    const shortAnswerText =
      activity.type === 'SHORT_TEXT' && typeof activity.answer?.text === 'string'
        ? activity.answer.text
        : null;

    const hasContent =
      Boolean(activity.title) ||
      Boolean(activity.instructionsMd) ||
      choices.length > 0 ||
      correctChoiceIndex !== null ||
      Boolean(shortAnswerText) ||
      activity.hints.length > 0;

    return {
      choices,
      correctChoiceIndex,
      shortAnswerText,
      hasContent,
    };
  }, [activity]);

  return (
    <div className="rounded-xl border border-dashed border-sky-200/70 dark:border-sky-900/60 bg-sky-50/50 dark:bg-sky-950/20">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={`activity-${activity.id}-details`}
        className="w-full px-3 py-2 flex items-center justify-between gap-3 text-sm font-semibold text-sky-700 dark:text-sky-200 hover:text-sky-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-sky-50 dark:focus-visible:ring-offset-sky-950 transition"
      >
        <span>Question details</span>
        <svg
          className={`h-4 w-4 text-sky-500 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.25a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08Z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {open && (
        <div
          id={`activity-${activity.id}-details`}
          className="px-3 pb-3 space-y-3 text-sm text-gray-700 dark:text-gray-200"
        >
          {activity.title && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Internal title
              </div>
              <p className="mt-1 whitespace-pre-wrap">{activity.title}</p>
            </div>
          )}

          {activity.instructionsMd && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Instructions
              </div>
              <p className="mt-1 whitespace-pre-wrap">{activity.instructionsMd}</p>
            </div>
          )}

          {details.choices.length > 0 && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Choices
              </div>
              <ul className="mt-1 space-y-1">
                {details.choices.map((choice, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-xs font-semibold text-sky-500">
                      {String.fromCharCode(65 + index)}.
                    </span>
                    <span className="flex-1 whitespace-pre-wrap">{choice}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {activity.type === 'MCQ' && details.correctChoiceIndex !== null && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Correct answer
              </div>
              <p className="mt-1 whitespace-pre-wrap">
                {`${String.fromCharCode(65 + details.correctChoiceIndex)}. ${
                  details.choices[details.correctChoiceIndex] ?? 'Option not found'
                }`}
              </p>
            </div>
          )}

          {activity.type === 'SHORT_TEXT' && details.shortAnswerText && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Expected answer
              </div>
              <p className="mt-1 whitespace-pre-wrap">{details.shortAnswerText}</p>
            </div>
          )}

          {activity.hints.length > 0 && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Hints
              </div>
              <ol className="mt-1 list-decimal list-inside space-y-1">
                {activity.hints.map((hint, index) => (
                  <li key={index} className="whitespace-pre-wrap">
                    {hint}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {!details.hasContent && (
            <p className="text-xs text-gray-500 dark:text-gray-400">No additional details captured yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(ActivityDetailsCard);
