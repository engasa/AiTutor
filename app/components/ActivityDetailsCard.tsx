import { memo, useMemo, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
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
    <div className="rounded-[1.4rem] border border-white/10 bg-black/15">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={`activity-${activity.id}-details`}
        className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
      >
        <div>
          <div className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-white/40">
            Internal anatomy
          </div>
          <div className="mt-2 text-sm font-semibold text-white">
            {open ? 'Hide question details' : 'Reveal question details'}
          </div>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-white/48 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open ? (
        <div
          id={`activity-${activity.id}-details`}
          className="space-y-4 border-t border-white/10 px-4 pb-4 pt-4 text-sm text-white/80"
        >
          {activity.title ? (
            <DetailBlock label="Internal title">
              <p className="whitespace-pre-wrap">{activity.title}</p>
            </DetailBlock>
          ) : null}

          {activity.instructionsMd ? (
            <DetailBlock label="Instructions">
              <p className="whitespace-pre-wrap">{activity.instructionsMd}</p>
            </DetailBlock>
          ) : null}

          {details.choices.length > 0 ? (
            <DetailBlock label="Choices">
              <ul className="space-y-2">
                {details.choices.map((choice, index) => (
                  <li
                    key={index}
                    className="flex gap-3 rounded-[1rem] border border-white/8 bg-white/4 px-3 py-3"
                  >
                    <span className="text-xs font-semibold text-amber-100">
                      {String.fromCharCode(65 + index)}
                    </span>
                    <span className="whitespace-pre-wrap">{choice}</span>
                  </li>
                ))}
              </ul>
            </DetailBlock>
          ) : null}

          {activity.type === 'MCQ' && details.correctChoiceIndex !== null ? (
            <DetailBlock label="Correct answer">
              <p className="whitespace-pre-wrap">
                {`${String.fromCharCode(65 + details.correctChoiceIndex)}. ${
                  details.choices[details.correctChoiceIndex] ?? 'Option not found'
                }`}
              </p>
            </DetailBlock>
          ) : null}

          {activity.type === 'SHORT_TEXT' && details.shortAnswerText ? (
            <DetailBlock label="Expected answer">
              <p className="whitespace-pre-wrap">{details.shortAnswerText}</p>
            </DetailBlock>
          ) : null}

          {activity.hints.length > 0 ? (
            <DetailBlock label="Hints">
              <ol className="space-y-2">
                {activity.hints.map((hint, index) => (
                  <li
                    key={index}
                    className="rounded-[1rem] border border-white/8 bg-white/4 px-3 py-3 whitespace-pre-wrap"
                  >
                    {hint}
                  </li>
                ))}
              </ol>
            </DetailBlock>
          ) : null}

          {!details.hasContent ? (
            <p className="text-xs text-white/46">No additional details captured yet.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function DetailBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-white/40">
        {label}
      </div>
      {children}
    </div>
  );
}

export default memo(ActivityDetailsCard);
