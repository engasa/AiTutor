import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clean
  await prisma.studentAnswer.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.teachingAssignment.deleteMany();
  await prisma.question.deleteMany();
  await prisma.questionList.deleteMany();
  await prisma.topic.deleteMany();
  await prisma.course.deleteMany();
  await prisma.user.deleteMany();

  // Users
  const [student, instructor] = await Promise.all([
    prisma.user.create({ data: { name: 'Student', email: 'student@example.com', password: 'student123', role: 'STUDENT' } }),
    prisma.user.create({ data: { name: 'Instructor', email: 'instructor@example.com', password: 'instructor123', role: 'INSTRUCTOR' } }),
  ]);

  // Courses
  const algo = await prisma.course.create({
    data: {
      title: 'Intro to Algorithms',
      description: 'Foundations of algorithmic thinking and problem solving',
      color: '#6366F1',
    },
  });
  const linear = await prisma.course.create({
    data: {
      title: 'Linear Algebra',
      description: 'Vectors, matrices, and linear transformations',
      color: '#10B981',
    },
  });
  const physics = await prisma.course.create({
    data: {
      title: 'Physics I',
      description: 'Kinematics and Newtonian mechanics',
      color: '#F59E0B',
    },
  });

  // Teachings
  await prisma.teachingAssignment.createMany({
    data: [
      { userId: instructor.id, courseId: algo.id },
      { userId: instructor.id, courseId: physics.id },
      { userId: instructor.id, courseId: linear.id },
    ],
  });

  // Enrollments
  await prisma.enrollment.createMany({
    data: [
      { userId: student.id, courseId: algo.id },
      { userId: student.id, courseId: linear.id },
      { userId: student.id, courseId: physics.id },
    ],
  });

  // Topics
  const [sorting, graphs] = await Promise.all([
    prisma.topic.create({ data: { name: 'Sorting', description: 'Ordering items efficiently', courseId: algo.id } }),
    prisma.topic.create({ data: { name: 'Graph Basics', description: 'Traversal and representation', courseId: algo.id } }),
  ]);

  const [vectors, matrices] = await Promise.all([
    prisma.topic.create({ data: { name: 'Vectors', description: 'Basics of vector spaces', courseId: linear.id } }),
    prisma.topic.create({ data: { name: 'Matrices', description: 'Matrix operations', courseId: linear.id } }),
  ]);

  const [kinematics] = await Promise.all([
    prisma.topic.create({ data: { name: 'Kinematics', description: 'Motion without forces', courseId: physics.id } }),
  ]);

  // Lists & Questions
  const listSortBasics = await prisma.questionList.create({ data: { title: 'Sorting Fundamentals', topicId: sorting.id } });
  const listGraphDFS = await prisma.questionList.create({ data: { title: 'Depth-First Search', topicId: graphs.id } });
  const listVectorBasics = await prisma.questionList.create({ data: { title: 'Vectors 101', topicId: vectors.id } });

  // Questions - Sorting
  await prisma.question.create({
    data: {
      listId: listSortBasics.id,
      prompt: 'Which sorting algorithm has average O(n log n) time and uses partitioning?',
      type: 'MCQ',
      options: { choices: ['Insertion Sort', 'Merge Sort', 'Quick Sort', 'Bubble Sort'] },
      answer: { correctIndex: 2 },
      hints: [
        'It selects a pivot and partitions the array around it.',
        'Average case is often good, worst case can be O(n^2) without optimizations.',
      ],
    },
  });
  await prisma.question.create({
    data: {
      listId: listSortBasics.id,
      prompt: 'Stable sorting: which of these is stable by default?',
      type: 'MCQ',
      options: { choices: ['Quick Sort', 'Heap Sort', 'Merge Sort', 'Selection Sort'] },
      answer: { correctIndex: 2 },
      hints: [
        'Think divide-and-conquer algorithm that merges sorted halves.',
      ],
    },
  });

  // Questions - Graph DFS
  await prisma.question.create({
    data: {
      listId: listGraphDFS.id,
      prompt: 'DFS uses which data structure for traversal?',
      type: 'MCQ',
      options: { choices: ['Queue', 'Stack', 'Priority Queue', 'Hash Set'] },
      answer: { correctIndex: 1 },
      hints: ['Consider LIFO behavior.'],
    },
  });

  // Questions - Vectors
  await prisma.question.create({
    data: {
      listId: listVectorBasics.id,
      prompt: 'What is the dot product of (1,2) and (3,4)? Provide a number.',
      type: 'SHORT_TEXT',
      options: null,
      answer: { text: '11' },
      hints: ['Multiply corresponding entries and add them.'],
    },
  });

  console.log('Seed complete.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
