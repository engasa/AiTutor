export function toPublicUser(user) {
  if (!user) return null;
  const { password, ...rest } = user;
  return rest;
}

export function mapCourseOffering(offering) {
  return {
    id: offering.id,
    title: offering.title,
    description: offering.description,
    status: offering.status,
    startDate: offering.startDate,
    endDate: offering.endDate,
  };
}

export function mapModule(module) {
  return {
    id: module.id,
    title: module.title,
    description: module.description,
    position: module.position,
  };
}

export function mapLesson(lesson) {
  return {
    id: lesson.id,
    title: lesson.title,
    contentMd: lesson.contentMd,
    position: lesson.position,
  };
}

export function mapActivity(activity) {
  const config = activity.config ?? {};
  return {
    id: activity.id,
    title: activity.title,
    instructionsMd: activity.instructionsMd,
    position: activity.position,
    promptTemplateId: activity.promptTemplateId,
    promptTemplate: activity.promptTemplate
      ? { id: activity.promptTemplate.id, name: activity.promptTemplate.name }
      : null,
    question: config.question ?? config.prompt ?? activity.instructionsMd,
    type: config.questionType ?? 'MCQ',
    options: config.options ? { choices: config.options } : null,
    answer: config.answer ?? null,
    hints: Array.isArray(config.hints) ? config.hints : [],
  };
}