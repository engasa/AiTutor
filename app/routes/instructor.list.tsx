import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import Nav from '../components/Nav';
import api from '../lib/api';
import type { Question } from '../lib/types';
import { requireUser } from '../hooks/useLocalUser';

export default function InstructorListBuilder() {
  const navigate = useNavigate();
  const { listId } = useParams();
  const user = requireUser('INSTRUCTOR');
  const [title, setTitle] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  // form state
  const [type, setType] = useState<'MCQ' | 'SHORT_TEXT'>('MCQ');
  const [prompt, setPrompt] = useState('');
  const [choices, setChoices] = useState<string[]>(['', '', '', '']);
  const [correct, setCorrect] = useState<number>(0);
  const [textAnswer, setTextAnswer] = useState('');
  const [hint, setHint] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    if (!listId) return;
    setLoading(true);
    Promise.all([api.listById(Number(listId)), api.questionsForList(Number(listId))])
      .then(([l, qs]) => {
        setTitle(l.title);
        setQuestions(qs);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!user || !listId) return;
    refresh();
  }, [listId]);

  if (!user) {
    navigate('/');
    return null;
  }

  const onAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!listId || !prompt.trim()) return;
    setBusy(true);
    try {
      if (type === 'MCQ') {
        await api.createQuestion(Number(listId), {
          prompt: prompt.trim(),
          type,
          options: { choices },
          answer: { correctIndex: correct },
          hints: hint.trim() ? [hint.trim()] : [],
        });
      } else {
        await api.createQuestion(Number(listId), {
          prompt: prompt.trim(),
          type,
          answer: { text: textAnswer.trim() },
          hints: hint.trim() ? [hint.trim()] : [],
        });
      }
      // reset
      setPrompt('');
      setChoices(['', '', '', '']);
      setCorrect(0);
      setTextAnswer('');
      setHint('');
      refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh bg-gradient-to-br from-sky-50 via-indigo-50 to-fuchsia-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-900">
      <Nav />
      <div className="container mx-auto px-4 py-8">
        <button onClick={() => navigate(-1)} className="text-sm text-gray-600 hover:underline">
          ← Back
        </button>
        <h2 className="text-2xl font-bold mb-4">{title || 'List'}</h2>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2 space-y-4">
            <div className="p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
              <div className="font-semibold mb-2">Questions</div>
              {loading ? (
                <div className="text-gray-500">Loading…</div>
              ) : questions.length === 0 ? (
                <div className="text-gray-500">No questions yet.</div>
              ) : (
                <ul className="space-y-2">
                  {questions.map((q, i) => (
                    <li key={q.id} className="p-3 rounded-xl border border-gray-200 dark:border-gray-800">
                      <div className="text-xs text-gray-500">#{i + 1} • {q.type}</div>
                      <div className="font-medium">{q.prompt}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <aside>
            <form onSubmit={onAdd} className="p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 space-y-3">
              <div className="font-semibold">Add Question</div>
              <div className="flex gap-2 text-sm">
                <label className={`px-3 py-1 rounded-full cursor-pointer ${type === 'MCQ' ? 'bg-sky-100 dark:bg-sky-900' : 'bg-gray-100 dark:bg-gray-800'}`}>
                  <input type="radio" name="type" className="sr-only" checked={type==='MCQ'} onChange={() => setType('MCQ')} />
                  MCQ
                </label>
                <label className={`px-3 py-1 rounded-full cursor-pointer ${type === 'SHORT_TEXT' ? 'bg-sky-100 dark:bg-sky-900' : 'bg-gray-100 dark:bg-gray-800'}`}>
                  <input type="radio" name="type" className="sr-only" checked={type==='SHORT_TEXT'} onChange={() => setType('SHORT_TEXT')} />
                  Short Text
                </label>
              </div>
              <div>
                <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Prompt…" className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-transparent" />
              </div>
              {type === 'MCQ' ? (
                <div className="space-y-2">
                  {choices.map((c, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input
                        value={c}
                        onChange={(e) => setChoices((arr) => arr.map((x, idx) => (idx === i ? e.target.value : x)))}
                        placeholder={`Choice ${i + 1}`}
                        className="flex-1 px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-transparent"
                      />
                      <label className="text-xs flex items-center gap-1">
                        <input type="radio" name="correct" checked={correct === i} onChange={() => setCorrect(i)} />
                        Correct
                      </label>
                    </div>
                  ))}
                </div>
              ) : (
                <input value={textAnswer} onChange={(e) => setTextAnswer(e.target.value)} placeholder="Expected answer…" className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-transparent" />
              )}
              <input value={hint} onChange={(e) => setHint(e.target.value)} placeholder="Optional hint…" className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-transparent" />
              <button disabled={busy || !prompt.trim()} className="w-full px-4 py-2 rounded-xl text-white font-semibold bg-gradient-to-r from-indigo-600 to-fuchsia-600 disabled:opacity-50">
                {busy ? 'Adding…' : 'Add Question'}
              </button>
            </form>
          </aside>
        </div>
      </div>
    </div>
  );
}
