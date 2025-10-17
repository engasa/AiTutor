import type { Activity } from './types';

export type ActivityFormValues = {
  title: string;
  instructionsMd: string;
  question: string;
  type: 'MCQ' | 'SHORT_TEXT';
  choices: string[];
  correctIndex: number;
  textAnswer: string;
  hintsText: string;
};

export type ActivityUpdatePayload = {
  title: string | null;
  instructionsMd: string;
  question: string;
  type: 'MCQ' | 'SHORT_TEXT';
  options: string[] | null;
  answer: any;
  hints: string[];
};

export function ensureChoiceSlots(choices: string[], minimum = 4) {
  const next = [...choices];
  while (next.length < minimum) {
    next.push('');
  }
  return next;
}

export function hintsToTextarea(hints: string[]) {
  if (!Array.isArray(hints) || hints.length === 0) {
    return '';
  }
  return hints.join('\n');
}

export function activityToFormValues(activity: Activity): ActivityFormValues {
  const baseChoices = activity.options?.choices ?? [];
  const normalizedChoices = ensureChoiceSlots(baseChoices);
  const existingCorrectIndex =
    activity.type === 'MCQ' && typeof activity.answer?.correctIndex === 'number'
      ? activity.answer.correctIndex
      : 0;

  return {
    title: activity.title ?? '',
    instructionsMd: activity.instructionsMd ?? '',
    question: activity.question ?? '',
    type: activity.type,
    choices: normalizedChoices,
    correctIndex:
      existingCorrectIndex >= 0 && existingCorrectIndex < normalizedChoices.length
        ? existingCorrectIndex
        : 0,
    textAnswer:
      activity.type === 'SHORT_TEXT' && typeof activity.answer?.text === 'string'
        ? activity.answer.text
        : '',
    hintsText: hintsToTextarea(activity.hints ?? []),
  };
}

export function parseHintsInput(value: string) {
  return value
    .split('\n')
    .map((hint) => hint.trim())
    .filter((hint) => hint.length > 0);
}

export function buildUpdatePayload(values: ActivityFormValues): {
  payload?: ActivityUpdatePayload;
  error?: string;
} {
  const question = values.question.trim();
  if (!question) {
    return { error: 'Question is required.' };
  }

  const hints = parseHintsInput(values.hintsText);

  if (values.type === 'MCQ') {
    const trimmedChoices = values.choices.map((choice) => choice.trim());
    const options: string[] = [];
    let nextCorrectIndex = -1;

    trimmedChoices.forEach((choice, index) => {
      if (choice.length > 0) {
        if (index === values.correctIndex && nextCorrectIndex === -1) {
          nextCorrectIndex = options.length;
        }
        options.push(choice);
      }
    });

    if (options.length < 2) {
      return { error: 'Provide at least two answer choices.' };
    }

    if (nextCorrectIndex === -1 || !options[nextCorrectIndex]) {
      return { error: 'Select a valid correct answer.' };
    }

    return {
      payload: {
        title: values.title.trim().length > 0 ? values.title.trim() : null,
        instructionsMd: values.instructionsMd,
        question,
        type: values.type,
        options,
        answer: { correctIndex: nextCorrectIndex },
        hints,
      },
    };
  }

  const textAnswer = values.textAnswer.trim();
  if (!textAnswer) {
    return { error: 'Provide the expected answer.' };
  }

  return {
    payload: {
      title: values.title.trim().length > 0 ? values.title.trim() : null,
      instructionsMd: values.instructionsMd,
      question,
      type: values.type,
      options: null,
      answer: { text: textAnswer },
      hints,
    },
  };
}
