import "server-only";

import { prisma } from "@/lib/prisma";
import {
  ageFromBirthday,
  best1RM,
  convertWeight,
  formatDate,
  formatHeight,
  formatWeight,
  isWorkingSet,
  roleLabel,
  type SetLike,
  weeklyStreak,
} from "@/lib/training";

/**
 * A compact plain-text snapshot of the user's training for the assistant's
 * system prompt. Kept small on purpose — a few hundred lines at most.
 */
export async function getChatContext(userId: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { weightUnit: true, heightCm: true, birthday: true, name: true },
  });
  const unit = user.weightUnit;

  const [workouts, bodyRows, templates] = await Promise.all([
    prisma.workout.findMany({
      where: { userId, finishedAt: { not: null } },
      orderBy: { date: "desc" },
      take: 12,
      include: {
        exercises: {
          orderBy: { order: "asc" },
          include: {
            exercise: { select: { name: true } },
            sets: { orderBy: { order: "asc" } },
          },
        },
      },
    }),
    prisma.bodyEntry.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take: 10,
    }),
    prisma.template.findMany({
      where: { userId },
      include: {
        days: {
          orderBy: { order: "asc" },
          include: {
            exercises: {
              orderBy: { order: "asc" },
              include: { exercise: { select: { name: true } } },
            },
          },
        },
      },
    }),
  ]);

  const allDates = await prisma.workout.findMany({
    where: { userId, finishedAt: { not: null } },
    select: { date: true },
  });

  const lines: string[] = [];
  const w = (kg: number) => formatWeight(convertWeight(kg, "KG", unit), unit);

  // --- profile ---------------------------------------------------------
  lines.push("## Profile");
  if (user.name) lines.push(`Name: ${user.name}`);
  const age = ageFromBirthday(user.birthday);
  lines.push(
    [
      user.heightCm ? `Height ${formatHeight(user.heightCm, unit)}` : null,
      age != null ? `Age ${age}` : null,
      `Prefers ${unit.toLowerCase()}`,
    ]
      .filter(Boolean)
      .join(" · "),
  );
  if (bodyRows.length) {
    const latest = bodyRows[0];
    const first = bodyRows[bodyRows.length - 1];
    const deltaKg = latest.weightKg - first.weightKg;
    const delta = convertWeight(Math.abs(deltaKg), "KG", unit);
    lines.push(
      `Body weight: ${w(latest.weightKg)} (${formatDate(latest.date)})` +
        (bodyRows.length > 1
          ? `; ${deltaKg >= 0 ? "up" : "down"} ${formatWeight(delta, unit)} over the last ${
              bodyRows.length
            } weigh-ins`
          : ""),
    );
  }
  lines.push(
    `Weekly training streak: ${weeklyStreak(allDates.map((d) => d.date))} week(s), ${
      allDates.length
    } workouts logged all-time.`,
  );

  // --- recent workouts ------------------------------------------------
  lines.push("\n## Recent workouts (most recent first)");
  for (const wk of workouts) {
    const date = formatDate(wk.date, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    lines.push(`\n### ${date}${wk.name ? ` — ${wk.name}` : ""}`);
    if (wk.notes) lines.push(`_${wk.notes}_`);
    for (const we of wk.exercises) {
      const name = we.exercise?.name ?? roleLabel(we.muscle, we.role);
      const sets = we.sets
        .filter((s) => s.reps > 0 || (s.seconds ?? 0) > 0)
        .map((s) => {
          const tag =
            s.type === "WARMUP"
              ? "warmup "
              : s.type === "DROP"
                ? "drop "
                : s.type === "FAILURE"
                  ? "to-failure "
                  : "";
          return s.seconds ? `${tag}${s.seconds}s` : `${tag}${w(s.weight)}×${s.reps}`;
        });
      if (sets.length) lines.push(`- ${name}: ${sets.join(", ")}`);
    }
  }

  // --- notable lifts (best estimated 1RM per exercise) ---------------
  const byExercise = new Map<string, SetLike[]>();
  for (const wk of workouts) {
    for (const we of wk.exercises) {
      if (!we.exercise) continue;
      const arr = byExercise.get(we.exercise.name) ?? [];
      for (const s of we.sets) {
        arr.push({
          reps: s.reps,
          weight: convertWeight(s.weight, "KG", unit),
          type: s.type,
        });
      }
      byExercise.set(we.exercise.name, arr);
    }
  }
  const bests = [...byExercise.entries()]
    .map(([name, sets]) => ({ name, e1rm: best1RM(sets.filter(isWorkingSet)) }))
    .filter((b) => b.e1rm > 0)
    .sort((a, b) => b.e1rm - a.e1rm)
    .slice(0, 12);
  if (bests.length) {
    lines.push("\n## Estimated 1-rep max (from the last ~12 sessions)");
    for (const b of bests) {
      lines.push(`- ${b.name}: ~${formatWeight(b.e1rm, unit)}`);
    }
  }

  // --- templates -----------------------------------------------------
  if (templates.length) {
    lines.push("\n## Templates / splits");
    for (const t of templates) {
      lines.push(`\n### ${t.name}${t.description ? ` — ${t.description}` : ""}`);
      for (const d of t.days) {
        const slots = d.exercises
          .map((e) => e.exercise?.name ?? roleLabel(e.muscle, e.role))
          .join(", ");
        lines.push(`- ${d.name}: ${slots || "(empty)"}`);
      }
    }
  }

  return lines.join("\n");
}
