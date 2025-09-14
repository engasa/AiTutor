import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("/student", "routes/student.tsx"),
  route("/student/courses/:courseId", "routes/student.course.tsx"),
  route("/student/topic/:topicId", "routes/student.topic.tsx"),
  route("/student/list/:listId", "routes/student.list.tsx"),
  route("/instructor", "routes/instructor.tsx"),
  route("/instructor/courses/:courseId", "routes/instructor.course.tsx"),
  route("/instructor/topic/:topicId", "routes/instructor.topic.tsx"),
  route("/instructor/list/:listId", "routes/instructor.list.tsx"),
] satisfies RouteConfig;
