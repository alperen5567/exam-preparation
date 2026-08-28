import { BadRequestError, ForbiddenError, NotFoundError } from "../../utils/httpErrors";
import { courseRepo } from "./course.repo";
import { userRepo } from "../users/user.repo";

export const courseService = {
  async listAvailable(userId: string) {
    const courses = await courseRepo.listAllWithMembership(userId);
    return courses.map((course) => ({
      id: course.id,
      title: course.title,
      code: course.code,
      semester: course.semester,
      createdAt: course.createdAt,
      ownerId: course.ownerId,
      joined: course.ownerId === userId || course.memberships.length > 0,
    }));
  },
  listJoined(userId: string) {
    return courseRepo.listJoined(userId);
  },
  async create(ownerId: string, payload: { title?: string; code?: string; semester?: string; courseTitle?: string; courseCode?: string }) {
    const owner = await userRepo.getById(ownerId);
    if (!owner) throw new NotFoundError("User not found");

    const title = (payload.title ?? payload.courseTitle ?? "").trim();
    const code = (payload.code ?? payload.courseCode ?? "").trim() || undefined;
    const semester = (payload.semester ?? "").trim() || undefined;

    if (!title) throw new BadRequestError("Title required");

    return courseRepo.createWithMembership(ownerId, { title, code, semester });
  },
  async ensureOwned(courseId: string, ownerId: string) {
    const c = await courseRepo.getById(courseId);
    if (!c) throw new NotFoundError("Course not found");
    if (c.ownerId !== ownerId) throw new ForbiddenError("Not your course");
    return c;
  },
  async ensureAccess(courseId: string, userId: string) {
    const c = await courseRepo.getAccessibleById(courseId, userId);
    if (!c) throw new ForbiddenError("Access denied");
    return c;
  },
  async joinCourse(courseId: string, userId: string) {
    const course = await courseRepo.getById(courseId);
    if (!course) throw new NotFoundError("Course not found");

    if (course.ownerId === userId) {
      return course;
    }

    const existing = await courseRepo.getMembership(userId, courseId);
    if (existing) {
      return course;
    }

    await courseRepo.createMembership(userId, courseId);
    return course;
  },
  async remove(ownerId: string, courseId: string) {
    const c = await this.ensureOwned(courseId, ownerId);
    return courseRepo.delete(c.id);
  },
};
