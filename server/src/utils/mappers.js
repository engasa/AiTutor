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
    isPublished: offering.isPublished,
    startDate: offering.startDate,
    endDate: offering.endDate,
    externalId: offering.externalId ?? null,
    externalSource: offering.externalSource ?? null,
    externalMetadata: offering.externalMetadata ?? null,
  };
}

export function mapModule(module) {
  return {
    id: module.id,
    title: module.title,
    description: module.description,
    position: module.position,
    isPublished: module.isPublished,
    courseOfferingId: module.courseOfferingId,
  };
}

export function mapLesson(lesson) {
  return {
    id: lesson.id,
    title: lesson.title,
    contentMd: lesson.contentMd,
    position: lesson.position,
    isPublished: lesson.isPublished,
    courseOfferingId: lesson.module?.courseOfferingId ?? lesson.courseOfferingId ?? undefined,
    moduleId: lesson.moduleId ?? lesson.module?.id ?? undefined,
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
    // Normalize options to always be { choices: string[] } for the client
    options: (() => {
      if (!('options' in config) || config.options == null) return null;
      // Accept both legacy array form and new object form
      if (Array.isArray(config.options)) {
        return { choices: config.options };
      }
      if (config.options && Array.isArray(config.options.choices)) {
        return { choices: config.options.choices };
      }
      return null;
    })(),
    answer: config.answer ?? null,
    hints: Array.isArray(config.hints) ? config.hints : [],
    mainTopic: activity.mainTopic
      ? { id: activity.mainTopic.id, name: activity.mainTopic.name }
      : null,
    secondaryTopics: Array.isArray(activity.secondaryTopics)
      ? activity.secondaryTopics
          .map((relation) =>
            relation?.topic ? { id: relation.topic.id, name: relation.topic.name } : null,
          )
          .filter(Boolean)
      : [],
    enableTeachMode: activity.enableTeachMode ?? true,
    enableGuideMode: activity.enableGuideMode ?? true,
    completionStatus: activity.completionStatus ?? undefined,
  };
}

export function mapProgressData(progressResult) {
  if (!progressResult) {
    return { completed: 0, total: 0, percentage: 0 };
  }
  return {
    completed: progressResult.completed ?? 0,
    total: progressResult.total ?? 0,
    percentage: progressResult.percentage ?? 0,
  };
}
