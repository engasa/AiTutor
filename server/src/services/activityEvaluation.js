export function evaluateQuestion(activity, payload) {
  const config = activity.config ?? {};
  const questionType = config.questionType ?? 'MCQ';
  let isCorrect = null;

  if (questionType === 'MCQ') {
    const expected = config.answer?.correctIndex;
    if (typeof expected === 'number' && typeof payload.answerOption === 'number') {
      isCorrect = expected === payload.answerOption;
    }
  } else if (questionType === 'SHORT_TEXT') {
    const expected = config.answer?.text ? String(config.answer.text) : '';
    if (typeof payload.answerText === 'string') { 
      isCorrect =
        expected &&
        payload.answerText.trim().toLowerCase() === expected.trim().toLowerCase();
    }
  }

  const hints = Array.isArray(config.hints) ? config.hints : [];
  const assistantCue = hints.length > 0 ? hints[0] : 'Reflect on the key ideas in the question.';

  return {
    isCorrect,
    assistantCue,
  };
}