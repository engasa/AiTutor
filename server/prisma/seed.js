import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function clearDatabase() {
  await prisma.submission.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.module.deleteMany();
  await prisma.courseInstructor.deleteMany();
  await prisma.courseEnrollment.deleteMany();
  await prisma.courseOffering.deleteMany();
  await prisma.activityTemplate.deleteMany();
  await prisma.promptTemplate.deleteMany();
  await prisma.activityType.deleteMany();
  await prisma.lessonTemplate.deleteMany();
  await prisma.moduleTemplate.deleteMany();
  await prisma.courseTemplate.deleteMany();
  await prisma.user.deleteMany();
}

async function createUsers() {
  const [studentPw, student2Pw, instructorPw, assistantPw] = await Promise.all([
    bcrypt.hash('student123', 10),
    bcrypt.hash('student456', 10),
    bcrypt.hash('instructor123', 10),
    bcrypt.hash('assistant123', 10),
  ]);

  const [student, studentTwo, instructor, assistant] = await Promise.all([
    prisma.user.create({
      data: {
        name: 'Student One',
        email: 'student@example.com',
        password: studentPw,
        role: 'STUDENT',
      },
    }),
    prisma.user.create({
      data: {
        name: 'Student Two',
        email: 'student2@example.com',
        password: student2Pw,
        role: 'STUDENT',
      },
    }),
    prisma.user.create({
      data: {
        name: 'Lead Instructor',
        email: 'instructor@example.com',
        password: instructorPw,
        role: 'INSTRUCTOR',
      },
    }),
    prisma.user.create({
      data: {
        name: 'Assistant Instructor',
        email: 'assistant@example.com',
        password: assistantPw,
        role: 'INSTRUCTOR',
      },
    }),
  ]);

  return { student, studentTwo, instructor, assistant };
}

async function createActivityFoundation() {
  const knowledgeCheck = await prisma.activityType.create({
    data: {
      name: 'knowledge-check',
      description: 'Multiple choice or short-answer knowledge checks.',
    },
  });

  const debugging = await prisma.activityType.create({
    data: {
      name: 'code-debugging',
      description: 'Students inspect code and describe the fix.',
    },
  });

  const knowledgePrompt = await prisma.promptTemplate.create({
    data: {
      name: 'Knowledge Check Default',
      activityTypeId: knowledgeCheck.id,
      systemPrompt: 'You are a helpful teaching assistant. Offer concise hints when the student struggles.',
      userPrompt:
        'Lesson: {{lesson_title}}\nQuestion: {{question_prompt}}\nStudent Answer: {{student_answer}}\nGive encouragement, then offer a hint without revealing the solution.',
      temperature: 0.2,
      topP: 0.9,
    },
  });

  const debuggingPrompt = await prisma.promptTemplate.create({
    data: {
      name: 'Debugging Assistant',
      activityTypeId: debugging.id,
      systemPrompt: 'You are an AI programming TA. Help students reason about bugs without writing the full fix.',
      userPrompt:
        'Debug Scenario: {{debug_context}}\nStudent Hypothesis: {{student_answer}}\nProvide guidance that validates good reasoning and nudges toward the bug.',
      temperature: 0.4,
      topP: 0.9,
    },
  });

  return {
    knowledgeCheck,
    debugging,
    knowledgePrompt,
    debuggingPrompt,
  };
}

function knowledgeCheckConfig({ prompt, type, options, answer, hints }) {
  return {
    prompt,
    questionType: type,
    options: options ?? null,
    answer: answer ?? null,
    hints: hints ?? [],
  };
}

function debuggingConfig({ prompt, context, answer, hints }) {
  return {
    prompt,
    debugContext: context,
    questionType: 'SHORT_TEXT',
    answer: answer ?? null,
    hints: hints ?? [],
  };
}

async function createCourseTemplates({ knowledgeCheck, debugging, knowledgePrompt, debuggingPrompt }) {
  const algorithms = await prisma.courseTemplate.create({
    data: {
      title: 'Intro to Algorithms',
      description: 'Foundations of algorithmic thinking and problem solving.',
      modules: {
        create: [
          {
            title: 'Sorting',
            description: 'Ordering items efficiently.',
            position: 1,
            lessons: {
              create: [
                {
                  title: 'Sorting Fundamentals',
                  contentMd: 'Review the core properties of popular sorting algorithms.',
                  position: 1,
                  activities: {
                    create: [
                      {
                        title: 'Average complexity checkpoint',
                        instructionsMd: 'Answer the question about sorting algorithms.',
                        position: 1,
                        activityTypeId: knowledgeCheck.id,
                        promptTemplateId: knowledgePrompt.id,
                        config: knowledgeCheckConfig({
                          prompt: 'Which sorting algorithm has average O(n log n) time and uses partitioning?',
                          type: 'MCQ',
                          options: ['Insertion Sort', 'Merge Sort', 'Quick Sort', 'Bubble Sort'],
                          answer: { correctIndex: 2 },
                          hints: [
                            'It selects a pivot and partitions the array around it.',
                            'Average case is O(n log n); worst case degrades without optimizations.',
                          ],
                        }),
                      },
                      {
                        title: 'Stability check',
                        instructionsMd: 'Identify the stable sorting algorithm.',
                        position: 2,
                        activityTypeId: knowledgeCheck.id,
                        promptTemplateId: knowledgePrompt.id,
                        config: knowledgeCheckConfig({
                          prompt: 'Stable sorting: which of these is stable by default?',
                          type: 'MCQ',
                          options: ['Quick Sort', 'Heap Sort', 'Merge Sort', 'Selection Sort'],
                          answer: { correctIndex: 2 },
                          hints: ['Think divide-and-conquer algorithms that merge sorted halves.'],
                        }),
                      },
                    ],
                  },
                },
              ],
            },
          },
          {
            title: 'Graph Basics',
            description: 'Traversal and representation techniques.',
            position: 2,
            lessons: {
              create: [
                {
                  title: 'Depth-First Search Review',
                  contentMd: 'Understand how DFS explores nodes.',
                  position: 1,
                  activities: {
                    create: [
                      {
                        title: 'Traversal structure',
                        instructionsMd: 'Select the supporting data structure for DFS.',
                        position: 1,
                        activityTypeId: knowledgeCheck.id,
                        promptTemplateId: knowledgePrompt.id,
                        config: knowledgeCheckConfig({
                          prompt: 'DFS uses which data structure for traversal?',
                          type: 'MCQ',
                          options: ['Queue', 'Stack', 'Priority Queue', 'Hash Set'],
                          answer: { correctIndex: 1 },
                          hints: ['Consider LIFO behaviour.'],
                        }),
                      },
                    ],
                  },
                },
                {
                  title: 'Debugging DFS',
                  contentMd: 'Investigate a faulty DFS implementation.',
                  position: 2,
                  activities: {
                    create: [
                      {
                        title: 'Fix the recursion bug',
                        instructionsMd: 'Read the snippet and describe the bug fix.',
                        position: 1,
                        activityTypeId: debugging.id,
                        promptTemplateId: debuggingPrompt.id,
                        config: debuggingConfig({
                          prompt: 'The DFS function revisits nodes endlessly. What is missing?',
                          context:
                            'function dfs(node) {\n  for (const neighbor of graph[node]) {\n    dfs(neighbor);\n  }\n}\nconsole.log(dfs(0));',
                          answer: { text: 'Mark nodes as visited before recursing.' },
                          hints: [
                            'Think about preventing infinite recursion.',
                            'DFS usually keeps a visited set.',
                          ],
                        }),
                      },
                    ],
                  },
                },
              ],
            },
          },
          {
            title: 'Dynamic Programming Basics',
            description: 'Breaking problems into overlapping subproblems.',
            position: 3,
            lessons: {
              create: [
                {
                  title: 'Memoization Concepts',
                  contentMd: 'Introduce memoization and tabulation strategies.',
                  position: 1,
                  activities: {
                    create: [
                      {
                        title: 'Identify the overlapping subproblem',
                        instructionsMd: 'Short response on where memoization helps.',
                        position: 1,
                        activityTypeId: knowledgeCheck.id,
                        promptTemplateId: knowledgePrompt.id,
                        config: knowledgeCheckConfig({
                          prompt: 'In the Fibonacci sequence, what subproblem repeats and benefits from memoization?',
                          type: 'SHORT_TEXT',
                          answer: { text: 'Computing smaller Fibonacci numbers like F(n-1) and F(n-2).' },
                          hints: ['Look at recursive calls inside fib(n).'],
                        }),
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    include: {
      modules: {
        include: {
          lessons: {
            include: {
              activities: true,
            },
          },
        },
      },
    },
  });

  const linearAlgebra = await prisma.courseTemplate.create({
    data: {
      title: 'Linear Algebra',
      description: 'Vectors, matrices, and linear transformations.',
      modules: {
        create: [
          {
            title: 'Vectors',
            description: 'Basics of vector spaces.',
            position: 1,
            lessons: {
              create: [
                {
                  title: 'Vectors 101',
                  contentMd: 'Build intuition around dot products.',
                  position: 1,
                  activities: {
                    create: [
                      {
                        title: 'Dot product warm-up',
                        instructionsMd: 'Compute a basic dot product.',
                        position: 1,
                        activityTypeId: knowledgeCheck.id,
                        promptTemplateId: knowledgePrompt.id,
                        config: knowledgeCheckConfig({
                          prompt: 'What is the dot product of (1,2) and (3,4)? Provide a number.',
                          type: 'SHORT_TEXT',
                          answer: { text: '11' },
                          hints: ['Multiply corresponding entries and add them.'],
                        }),
                      },
                    ],
                  },
                },
              ],
            },
          },
          {
            title: 'Matrices',
            description: 'Matrix operations and properties.',
            position: 2,
            lessons: {
              create: [
                {
                  title: 'Matrix Multiplication Rules',
                  contentMd: 'Understand when AB is defined.',
                  position: 1,
                  activities: {
                    create: [
                      {
                        title: 'Shape compatibility',
                        instructionsMd: 'Determine if the product is defined.',
                        position: 1,
                        activityTypeId: knowledgeCheck.id,
                        promptTemplateId: knowledgePrompt.id,
                        config: knowledgeCheckConfig({
                          prompt: 'Can a 2x3 matrix multiply a 3x4 matrix? Answer yes or no.',
                          type: 'SHORT_TEXT',
                          answer: { text: 'yes' },
                          hints: ['Match the inner dimensions.'],
                        }),
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    include: {
      modules: {
        include: {
          lessons: {
            include: {
              activities: true,
            },
          },
        },
      },
    },
  });

  const physics = await prisma.courseTemplate.create({
    data: {
      title: 'Physics I',
      description: 'Kinematics and Newtonian mechanics.',
      modules: {
        create: [
          {
            title: 'Kinematics',
            description: 'Motion without forces.',
            position: 1,
            lessons: {
              create: [
                {
                  title: 'Displacement vs. Time',
                  contentMd: 'Interpret slope as velocity.',
                  position: 1,
                  activities: {
                    create: [
                      {
                        title: 'Graph interpretation',
                        instructionsMd: 'Read the graph and answer the question.',
                        position: 1,
                        activityTypeId: knowledgeCheck.id,
                        promptTemplateId: knowledgePrompt.id,
                        config: knowledgeCheckConfig({
                          prompt: 'A displacement-time graph has a constant positive slope. What can you say about velocity?',
                          type: 'SHORT_TEXT',
                          answer: { text: 'Velocity is constant and positive.' },
                          hints: ['Slope of displacement-time equals velocity.'],
                        }),
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    include: {
      modules: {
        include: {
          lessons: {
            include: {
              activities: true,
            },
          },
        },
      },
    },
  });

  return {
    algorithms,
    linearAlgebra,
    physics,
  };
}

async function cloneTemplateToOffering(templateId, { title, description, status = 'ACTIVE', startDate = null, endDate = null }) {
  const template = await prisma.courseTemplate.findUnique({
    where: { id: templateId },
    include: {
      modules: {
        orderBy: { position: 'asc' },
        include: {
          lessons: {
            orderBy: { position: 'asc' },
            include: {
              activities: { orderBy: { position: 'asc' } },
            },
          },
        },
      },
    },
  });

  if (!template) throw new Error(`Template ${templateId} not found`);

  const offering = await prisma.courseOffering.create({
    data: {
      title,
      description,
      status,
      templateId: template.id,
      startDate,
      endDate,
    },
  });

  for (const moduleTemplate of template.modules) {
    const module = await prisma.module.create({
      data: {
        title: moduleTemplate.title,
        description: moduleTemplate.description,
        position: moduleTemplate.position,
        courseOfferingId: offering.id,
        templateId: moduleTemplate.id,
      },
    });

    for (const lessonTemplate of moduleTemplate.lessons) {
      const lesson = await prisma.lesson.create({
        data: {
          title: lessonTemplate.title,
          contentMd: lessonTemplate.contentMd,
          position: lessonTemplate.position,
          moduleId: module.id,
          templateId: lessonTemplate.id,
        },
      });

      for (const activityTemplate of lessonTemplate.activities) {
        await prisma.activity.create({
          data: {
            title: activityTemplate.title,
            instructionsMd: activityTemplate.instructionsMd,
            position: activityTemplate.position,
            lessonId: lesson.id,
            templateId: activityTemplate.id,
            activityTypeId: activityTemplate.activityTypeId,
            promptTemplateId: activityTemplate.promptTemplateId,
            config: activityTemplate.config,
          },
        });
      }
    }
  }

  return offering;
}

async function copyTemplateLessonsToModule(lessonTemplateIds, targetModuleId) {
  if (lessonTemplateIds.length === 0) return;

  const lessonTemplates = await prisma.lessonTemplate.findMany({
    where: { id: { in: lessonTemplateIds } },
    include: {
      activities: {
        orderBy: { position: 'asc' },
      },
    },
  });

  for (const template of lessonTemplates) {
    const lesson = await prisma.lesson.create({
      data: {
        title: template.title,
        contentMd: template.contentMd,
        position: template.position,
        moduleId: targetModuleId,
        templateId: template.id,
      },
    });

    for (const activityTemplate of template.activities) {
      await prisma.activity.create({
        data: {
          title: activityTemplate.title,
          instructionsMd: activityTemplate.instructionsMd,
          position: activityTemplate.position,
          lessonId: lesson.id,
          templateId: activityTemplate.id,
          activityTypeId: activityTemplate.activityTypeId,
          promptTemplateId: activityTemplate.promptTemplateId,
          config: activityTemplate.config,
        },
      });
    }
  }
}

async function copyLessonsBetweenOfferings(lessonIds, targetModuleId) {
  if (lessonIds.length === 0) return;

  const lessons = await prisma.lesson.findMany({
    where: { id: { in: lessonIds } },
    include: {
      activities: {
        orderBy: { position: 'asc' },
      },
    },
  });

  for (const lesson of lessons) {
    const clonedLesson = await prisma.lesson.create({
      data: {
        title: `${lesson.title} (Imported)`,
        contentMd: lesson.contentMd,
        position: lesson.position,
        moduleId: targetModuleId,
        templateId: lesson.templateId,
      },
    });

    for (const activity of lesson.activities) {
      await prisma.activity.create({
        data: {
          title: activity.title,
          instructionsMd: activity.instructionsMd,
          position: activity.position,
          lessonId: clonedLesson.id,
          templateId: activity.templateId,
          activityTypeId: activity.activityTypeId,
          promptTemplateId: activity.promptTemplateId,
          config: activity.config,
        },
      });
    }
  }
}

async function createSampleSubmissions(algorithmsOfferingId, linearOfferingId, studentIds) {
  const [studentOneId, studentTwoId] = studentIds;

  const sortingActivity = await prisma.activity.findFirst({
    where: {
      lesson: {
        module: {
          courseOfferingId: algorithmsOfferingId,
          title: 'Sorting',
        },
        title: 'Sorting Fundamentals',
      },
      config: {
        path: ['questionType'],
        equals: 'MCQ',
      },
    },
  });

  const vectorActivity = await prisma.activity.findFirst({
    where: {
      lesson: {
        module: {
          courseOfferingId: linearOfferingId,
          title: 'Vectors',
        },
        title: 'Vectors 101',
      },
    },
  });

  const debuggingActivity = await prisma.activity.findFirst({
    where: {
      lesson: {
        module: {
          courseOfferingId: algorithmsOfferingId,
          title: 'Capstone Sprint',
        },
      },
    },
  });

  if (sortingActivity) {
    await prisma.submission.createMany({
      data: [
        {
          userId: studentOneId,
          activityId: sortingActivity.id,
          attemptNumber: 1,
          response: { answerOption: 2 },
          aiFeedback: { message: 'Great work! Partitioning was the clue.' },
          isCorrect: true,
        },
        {
          userId: studentTwoId,
          activityId: sortingActivity.id,
          attemptNumber: 1,
          response: { answerOption: 1 },
          aiFeedback: { message: 'Not quite. Remember which algorithm picks a pivot.' },
          isCorrect: false,
        },
      ],
    });
  }

  if (vectorActivity) {
    await prisma.submission.create({
      data: {
        userId: studentOneId,
        activityId: vectorActivity.id,
        attemptNumber: 1,
        response: { answerText: '11' },
        aiFeedback: { message: 'Correct, multiply and add component-wise.' },
        isCorrect: true,
      },
    });
  }

  if (debuggingActivity) {
    await prisma.submission.create({
      data: {
        userId: studentTwoId,
        activityId: debuggingActivity.id,
        attemptNumber: 1,
        response: { answerText: 'Add a visited set.' },
        aiFeedback: { message: 'Yes! Tracking visited nodes prevents cycles.' },
        isCorrect: true,
      },
    });
  }
}

async function main() {
  console.log('Resetting and seeding database with comprehensive sample data...');
  await clearDatabase();

  const { student, studentTwo, instructor, assistant } = await createUsers();
  const activityFoundation = await createActivityFoundation();
  const templates = await createCourseTemplates(activityFoundation);

  const algorithmsOffering = await cloneTemplateToOffering(templates.algorithms.id, {
    title: 'Intro to Algorithms - Fall Cohort',
    description: 'Primary offering cloned from the algorithms template.',
    startDate: new Date('2025-09-01'),
    endDate: new Date('2025-12-15'),
  });

  const linearOffering = await cloneTemplateToOffering(templates.linearAlgebra.id, {
    title: 'Linear Algebra - Evening Cohort',
    description: 'Evening class offering derived from the linear algebra template.',
    startDate: new Date('2025-09-05'),
    endDate: new Date('2025-12-10'),
  });

  const physicsOffering = await cloneTemplateToOffering(templates.physics.id, {
    title: 'Physics I - Seminar',
    description: 'Physics offering starting with imported lessons.',
    status: 'DRAFT',
  });

  await prisma.courseInstructor.createMany({
    data: [
      { courseOfferingId: algorithmsOffering.id, userId: instructor.id, role: 'LEAD' },
      { courseOfferingId: algorithmsOffering.id, userId: assistant.id, role: 'ASSISTANT' },
      { courseOfferingId: linearOffering.id, userId: instructor.id, role: 'LEAD' },
      { courseOfferingId: physicsOffering.id, userId: assistant.id, role: 'LEAD' },
    ],
  });

  await prisma.courseEnrollment.createMany({
    data: [
      { courseOfferingId: algorithmsOffering.id, userId: student.id },
      { courseOfferingId: algorithmsOffering.id, userId: studentTwo.id },
      { courseOfferingId: linearOffering.id, userId: student.id },
      { courseOfferingId: physicsOffering.id, userId: studentTwo.id },
    ],
  });

  const capstoneModule = await prisma.module.create({
    data: {
      title: 'Capstone Sprint',
      description: 'Custom module demonstrating instructor-authored content.',
      position: 4,
      courseOfferingId: algorithmsOffering.id,
    },
  });

  const capstoneLesson = await prisma.lesson.create({
    data: {
      title: 'Code Review Warm-up',
      contentMd: 'Review the provided DFS implementation and describe the bug.',
      position: 1,
      moduleId: capstoneModule.id,
    },
  });

  await prisma.activity.create({
    data: {
      title: 'DFS bug hunt',
      instructionsMd: 'Explain the fix for the provided DFS implementation.',
      position: 1,
      lessonId: capstoneLesson.id,
      activityTypeId: activityFoundation.debugging.id,
      promptTemplateId: activityFoundation.debuggingPrompt.id,
      config: debuggingConfig({
        prompt: 'The DFS still revisits nodes after marking them visited inside recursion. What is wrong?',
        context:
          'function dfs(node) {\n  visited.add(node);\n  for (const neighbor of graph[node]) {\n    if (!visited.has(neighbor)) {\n      dfs(node); // BUG\n    }\n  }\n}\n',
        answer: { text: 'Should recurse on neighbor, not node.' },
        hints: ['Check the recursive call argument.', 'Compare with pseudo-code for DFS.'],
      }),
    },
  });

  const physicsStudioModule = await prisma.module.create({
    data: {
      title: 'Applied Practice',
      description: 'Imported lessons for additional practice.',
      position: 2,
      courseOfferingId: physicsOffering.id,
    },
  });

  const algorithmsLessons = await prisma.lesson.findMany({
    where: {
      module: {
        courseOfferingId: algorithmsOffering.id,
        title: 'Sorting',
      },
    },
  });

  await copyLessonsBetweenOfferings(algorithmsLessons.map((lesson) => lesson.id), physicsStudioModule.id);

  const matrixTemplateLessons = await prisma.lessonTemplate.findMany({
    where: {
      moduleTemplate: {
        courseTemplateId: templates.linearAlgebra.id,
        title: 'Matrices',
      },
    },
  });

  if (matrixTemplateLessons.length > 0) {
    const targetModule = await prisma.module.create({
      data: {
        title: 'Matrix Workshop',
        description: 'Imported template lessons for extra practice.',
        position: 3,
        courseOfferingId: linearOffering.id,
      },
    });

    await copyTemplateLessonsToModule(matrixTemplateLessons.map((lesson) => lesson.id), targetModule.id);
  }

  await createSampleSubmissions(algorithmsOffering.id, linearOffering.id, [student.id, studentTwo.id]);

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
