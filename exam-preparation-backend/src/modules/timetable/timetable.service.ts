import { prisma } from "../../db/client";
import { BadRequestError, NotFoundError } from "../../utils/httpErrors";

type TimetableEntryInput = {
  title: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  color?: string;
};

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const parseTimeMinutes = (value: string): number => {
  const match = value.match(TIME_PATTERN);
  if (!match) return -1;
  return Number(match[1]) * 60 + Number(match[2]);
};

const normalizeEntry = (entry: TimetableEntryInput): TimetableEntryInput => {
  const title = typeof entry?.title === "string" ? entry.title.trim() : "";
  const dayOfWeek = Number(entry?.dayOfWeek);
  const startTime = typeof entry?.startTime === "string" ? entry.startTime.trim() : "";
  const endTime = typeof entry?.endTime === "string" ? entry.endTime.trim() : "";

  if (!title) throw new BadRequestError("title required");
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    throw new BadRequestError("dayOfWeek must be between 0 and 6");
  }
  if (!TIME_PATTERN.test(startTime) || !TIME_PATTERN.test(endTime)) {
    throw new BadRequestError("startTime and endTime must be in HH:MM format");
  }
  if (parseTimeMinutes(endTime) <= parseTimeMinutes(startTime)) {
    throw new BadRequestError("endTime must be later than startTime");
  }

  const normalized: TimetableEntryInput = { title, dayOfWeek, startTime, endTime };
  if (typeof entry?.color === "string" && entry.color.trim()) {
    normalized.color = entry.color.trim();
  }
  return normalized;
};

export const timetableService = {
  async listByUser(userId: string) {
    return prisma.timetableEntry.findMany({
      where: { userId },
      orderBy: { startTime: "asc" },
    });
  },

  async create(userId: string, data: TimetableEntryInput) {
    const normalized = normalizeEntry(data);
    return prisma.timetableEntry.create({
      data: {
        userId,
        title: normalized.title,
        dayOfWeek: normalized.dayOfWeek,
        startTime: normalized.startTime,
        endTime: normalized.endTime,
        ...(normalized.color && { color: normalized.color }),
      },
    });
  },

  async createBulk(userId: string, entries: TimetableEntryInput[]) {
    if (!Array.isArray(entries) || entries.length === 0) {
      throw new BadRequestError("entries required");
    }
    if (entries.length > 100) {
      throw new BadRequestError("Cannot create more than 100 entries at once");
    }
    const normalizedEntries = entries.map(normalizeEntry);
    const result = await prisma.timetableEntry.createMany({
      data: normalizedEntries.map((entry) => ({
        userId,
        title: entry.title,
        dayOfWeek: entry.dayOfWeek,
        startTime: entry.startTime,
        endTime: entry.endTime,
        ...(entry.color ? { color: entry.color } : {}),
      })),
    });
    return { createdCount: result.count };
  },

  async remove(userId: string, id: string) {
    const entry = await prisma.timetableEntry.findUnique({ where: { id } });
    if (!entry || entry.userId !== userId) throw new NotFoundError("Timetable entry not found");
    await prisma.timetableEntry.delete({ where: { id } });
  },
};
