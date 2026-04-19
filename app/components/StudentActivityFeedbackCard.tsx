type StudentActivityFeedbackCardProps = {
  rating: number | null;
  note: string;
  saving: boolean;
  submitted: boolean;
  error: string | null;
  onSelectRating: (value: number) => void;
  onNoteChange: (value: string) => void;
  onSubmit: () => void;
  onDismiss: () => void;
};

export default function StudentActivityFeedbackCard({
  rating,
  note,
  saving,
  submitted,
  error,
  onSelectRating,
  onNoteChange,
  onSubmit,
  onDismiss,
}: StudentActivityFeedbackCardProps) {
  if (submitted) {
    return (
      <div className="animate-scale-in rounded-[1.6rem] border border-emerald-300/18 bg-emerald-300/10 p-5 text-sm text-emerald-100">
        Thanks for the feedback. It helps improve future activities and pacing.
      </div>
    );
  }

  return (
    <div className="animate-scale-in rounded-[1.8rem] border border-white/10 bg-black/18 p-5 shadow-[0_16px_50px_rgba(3,7,18,0.22)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-white/40">
            Reflection
          </div>
          <h3 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-white">
            How did that question feel?
          </h3>
          <p className="mt-2 text-sm leading-6 text-white/58">
            Quick feedback helps us tune future activities and guidance quality.
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs font-medium uppercase tracking-[0.18em] text-white/42 hover:text-white/72"
        >
          Later
        </button>
      </div>

      <div className="mt-6 grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onSelectRating(value)}
            aria-pressed={rating === value}
            className={`rounded-[1rem] border px-3 py-3 text-sm font-semibold transition ${
              rating === value
                ? 'border-amber-300/20 bg-amber-300 text-slate-950'
                : 'border-white/10 bg-white/5 text-white hover:border-white/20 hover:bg-white/10'
            }`}
          >
            {value}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-white/44">1 = very easy, 5 = very difficult</p>

      <div className="mt-5 space-y-2">
        <label htmlFor="activity-feedback-note" className="text-sm font-medium text-white">
          Optional note
        </label>
        <textarea
          id="activity-feedback-note"
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder="What made it easy or difficult?"
          className="input-field min-h-24 resize-y text-sm"
        />
      </div>

      {error ? (
        <div className="mt-4 rounded-[1rem] border border-rose-300/18 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onSubmit}
          disabled={!rating || saving}
          className="btn-primary"
        >
          {saving ? 'Saving...' : 'Send feedback'}
        </button>
        <p className="text-xs text-white/44">Your response stays internal to the course team.</p>
      </div>
    </div>
  );
}
