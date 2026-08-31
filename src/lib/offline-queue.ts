"use client";

import * as React from "react";

import {
  addSet,
  deleteSet,
  removeWorkoutExercise,
  reorderWorkoutExercises,
  syncFinishWorkout,
  updateSet,
  updateWorkoutExercise,
} from "@/lib/actions/workouts";

/**
 * A durable outbox for the workout logger. Mutations are applied to local React
 * state immediately by the caller; here we persist the intent to localStorage
 * and replay it against the server, retrying while the connection is down. Set
 * edits keep working with no network at all.
 */

type Job =
  | { kind: "updateSet"; args: Parameters<typeof updateSet>[0] }
  | { kind: "updateWorkoutExercise"; args: Parameters<typeof updateWorkoutExercise>[0] }
  | { kind: "deleteSet"; args: { setId: string } }
  | { kind: "removeWorkoutExercise"; args: { id: string } }
  | {
      kind: "reorderWorkoutExercises";
      args: Parameters<typeof reorderWorkoutExercises>[0];
    }
  | { kind: "addSet"; tempId: string; args: { workoutExerciseId: string; type?: string } }
  | { kind: "finishWorkout"; args: { workoutId: string } };

type QueuedJob = Job & { qid: string };

const KEY = "progfrog:outbox";
const RETRY_MS = 12_000;

let queue: QueuedJob[] = load();
let remap: Record<string, string> = {};
let flushing = false;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

/** temp set id -> real id, once addSet has synced. Callers subscribe to swap. */
const swapListeners = new Set<(tempId: string, realId: string) => void>();

function load(): QueuedJob[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as QueuedJob[]) : [];
  } catch {
    return [];
  }
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(queue));
  } catch {
    /* quota / private mode — the in-memory queue still works this session */
  }
  listeners.forEach((l) => l());
}

function isOnline() {
  return typeof navigator === "undefined" || navigator.onLine;
}

/** Rewrite any reference to a temp set id that has since been assigned a real one. */
function resolveIds(job: QueuedJob): QueuedJob {
  const fix = (id: string) => remap[id] ?? id;
  if (job.kind === "updateSet")
    return { ...job, args: { ...job.args, setId: fix(job.args.setId) } };
  if (job.kind === "deleteSet") return { ...job, args: { setId: fix(job.args.setId) } };
  return job;
}

async function run(job: QueuedJob): Promise<void> {
  switch (job.kind) {
    case "updateSet":
      await updateSet(job.args);
      return;
    case "updateWorkoutExercise":
      await updateWorkoutExercise(job.args);
      return;
    case "deleteSet":
      await deleteSet(job.args.setId);
      return;
    case "removeWorkoutExercise":
      await removeWorkoutExercise(job.args.id);
      return;
    case "reorderWorkoutExercises":
      await reorderWorkoutExercises(job.args);
      return;
    case "addSet": {
      const created = await addSet(job.args.workoutExerciseId, {
        type: job.args.type as never,
      });
      remap[job.tempId] = created.id;
      swapListeners.forEach((l) => l(job.tempId, created.id));
      return;
    }
    case "finishWorkout":
      await syncFinishWorkout(job.args.workoutId);
      return;
  }
}

/** Network failures look like TypeError("Failed to fetch") from the RSC call. */
function isNetworkError(e: unknown): boolean {
  if (!isOnline()) return true;
  const msg = e instanceof Error ? e.message : String(e);
  return /fetch|network|Load failed|ERR_INTERNET|offline/i.test(msg);
}

async function flush() {
  if (flushing || queue.length === 0) return;
  if (!isOnline()) {
    schedule();
    return;
  }
  flushing = true;
  try {
    while (queue.length > 0) {
      const job = resolveIds(queue[0]);
      try {
        await run(job);
        queue.shift();
        persist();
      } catch (e) {
        if (isNetworkError(e)) {
          schedule(); // still offline / flaky — try again shortly
          break;
        }
        // A real rejection (validation, gone, auth). The local state already
        // reflects the user's intent; drop the job so the queue can drain.
        console.warn("[offline-queue] dropping job", job.kind, e);
        queue.shift();
        persist();
      }
    }
  } finally {
    flushing = false;
    if (queue.length === 0) remap = {};
  }
}

function schedule() {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    void flush();
  }, RETRY_MS);
}

function enqueue(job: Job) {
  queue.push({ ...job, qid: Math.random().toString(36).slice(2) } as QueuedJob);
  persist();
  void flush();
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => void flush());
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void flush();
  });
  window.addEventListener("pageshow", () => void flush());
}

export const outbox = {
  updateSet: (args: Parameters<typeof updateSet>[0]) =>
    enqueue({ kind: "updateSet", args }),
  updateWorkoutExercise: (args: Parameters<typeof updateWorkoutExercise>[0]) =>
    enqueue({ kind: "updateWorkoutExercise", args }),
  addSet: (tempId: string, args: { workoutExerciseId: string; type?: string }) =>
    enqueue({ kind: "addSet", tempId, args }),
  deleteSet: (setId: string) => {
    // Never-synced set: cancel its pending create instead of deleting server-side.
    const addIdx = queue.findIndex((j) => j.kind === "addSet" && j.tempId === setId);
    if (addIdx !== -1) {
      queue = queue.filter(
        (j, i) =>
          i !== addIdx &&
          !((j.kind === "updateSet" || j.kind === "deleteSet") && j.args.setId === setId),
      );
      persist();
      return;
    }
    enqueue({ kind: "deleteSet", args: { setId } });
  },
  removeWorkoutExercise: (id: string) =>
    enqueue({ kind: "removeWorkoutExercise", args: { id } }),
  reorderWorkoutExercises: (args: Parameters<typeof reorderWorkoutExercises>[0]) =>
    enqueue({ kind: "reorderWorkoutExercises", args }),
  finishWorkout: (workoutId: string) =>
    enqueue({ kind: "finishWorkout", args: { workoutId } }),
  flush: () => flush(),
  pending: () => queue.length,
  onSwap: (fn: (tempId: string, realId: string) => void) => {
    swapListeners.add(fn);
    return () => {
      swapListeners.delete(fn);
    };
  },
};

/** `{ online, pending }` for a status pill; re-renders as the queue drains. */
export function useOutboxStatus() {
  const [, bump] = React.useReducer((n: number) => n + 1, 0);
  const [online, setOnline] = React.useState(true);

  React.useEffect(() => {
    listeners.add(bump);
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      listeners.delete(bump);
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  return { online, pending: queue.length };
}
