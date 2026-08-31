import "server-only";

import { prisma } from "@/lib/prisma";

export function getTemplates(userId: string) {
  return prisma.template.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: {
      days: {
        orderBy: { order: "asc" },
        include: { _count: { select: { exercises: true } } },
      },
    },
  });
}

export function getTemplate(userId: string, templateId: string) {
  return prisma.template.findFirst({
    where: { id: templateId, userId },
    include: {
      days: {
        orderBy: { order: "asc" },
        include: {
          exercises: {
            orderBy: { order: "asc" },
            include: {
              exercise: true,
              sets: { orderBy: { order: "asc" } },
            },
          },
        },
      },
    },
  });
}

export type FullTemplate = NonNullable<Awaited<ReturnType<typeof getTemplate>>>;
export type TemplateListItem = Awaited<ReturnType<typeof getTemplates>>[number];
