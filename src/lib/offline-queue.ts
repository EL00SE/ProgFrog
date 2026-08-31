"use client";

import * as React from "react";

import {
  addExerciseToWorkout,
  addSet,
  addSlotToWorkout,
  assignWorkoutEntryExercise,
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
 * and replay it against the server, retrying while the connection is down.
 *
 * Optimistic creates use a `local_*` id; once the create syncs, `remap` holds
 * `local -> real` and later jobs that reference the temp id are rewritten before
 * they run (the queue is FIFO, so a parent always syncs before its children).
 * Every create also passes its temp id to the server as an idempotency key, so a
 * job that gets replayed after a crash no-ops instead of duplicating.
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
  | { kind: "assignExercise"; args: { workoutExerciseId: string; exerciseId: string } }
  | {
      kind: "addSet";
      tempId: string;
      args: { workoutExerciseId: string; type?: string };
    }
  | {
      kind: "addExercise";
      tempId: string;
      args: { workoutId: string; exerciseId: string };
    }
  | {
      kind: "addSlot";
      tempId: string;
      args: { workoutId: string; muscle: string; role: string };
    }
  | { kind: "finishWorkout"; args: { workoutId: string } };

type QueuedJob = Job & { qid: string };

const KEY = "progfrog:outbox";
const RETRY_MS = 12_000;

let queue: QueuedJob[] = load();
let remap: Record<string, string> = {};
let flushing = false;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

/** temp id -> real id, once a create has synced. Callers subscribe to swap. */
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

const isTemp = (id: string) => id.startsWith("local_");

/** Rewrite any temp id that has since been assigned a real one. */
function resolveIds(job: QueuedJob): QueuedJob {
  const fix = (id: string) => remap[id] ?? id;
  switch (job.kind) {
    case "updateSet":
      return { ...job, args: { ...job.args, setId: fix(job.args.setId) } };
    case "deleteSet":
      return { ...job, args: { setId: fix(job.args.setId) } };
    case "removeWorkoutExercise":
      return { ...job, args: { id: fix(job.args.id) } };
    case "updateWorkoutExercise":
      return {
        ...job,
        args: { ...job.args, workoutExerciseId: fix(job.args.workoutExerciseId) },
      };
    case "assignExercise":
      return {
        ...job,
        args: { ...job.args, workoutExerciseId: fix(job.args.workoutExerciseId) },
      };
    case "addSet":
      return {
        ...job,
        args: { ...job.args, workoutExerciseId: fix(job.args.workoutExerciseId) },
      };
    case "reorderWorkoutExercises":
      return {
        ...job,
        args: { ...job.args, orderedIds: job.args.orderedIds.map(fix) },
      };
    default:
      return job;
  }
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
    case "assignExercise":
      await assignWorkoutEntryExercise(job.args);
      return;
    case "addSet": {
      const created = await addSet(job.args.workoutExerciseId, {
        type: job.args.type as never,
        clientId: job.tempId,
      });
      finishCreate(job.tempId, created.id);
      return;
    }
    case "addExercise": {
      const created = await addExerciseToWorkout({
        ...job.args,
        clientId: job.tempId,
      });
      finishCreate(job.tempId, created.id);
      return;
    }
    case "addSlot": {
      const created = await addSlotToWorkout({
        ...job.args,
        role: job.args.role as never,
        clientId: job.tempId,
      });
      finishCreate(job.tempId, created.id);
      return;
    }
    case "finishWorkout":
      await syncFinishWorkout(job.args.workoutId);
      return;
  }
}

function finishCreate(tempId: string, realId: string) {
  remap[tempId] = realId;
  swapListeners.forEach((l) => l(tempId, realId));
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

/** Drop a queued create for `tempId` plus every later job that depends on it. */
function cancelPendingCreate(tempId: string) {
  queue = queue.filter((j) => {
    if (
      (j.kind === "addSet" || j.kind === "addExercise" || j.kind === "addSlot") &&
      j.tempId === tempId
    ) {
      return false;
    }
    if (j.kind === "updateSet" || j.kind === "deleteSet") return j.args.setId !== tempId;
    if (j.kind === "updateWorkoutExercise" || j.kind === "assignExercise") {
      return j.args.workoutExerciseId !== tempId;
    }
    if (j.kind === "addSet") return j.args.workoutExerciseId !== tempId;
    return true;
  });
  persist();
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
  addExercise: (tempId: string, args: { workoutId: string; exerciseId: string }) =>
    enqueue({ kind: "addExercise", tempId, args }),
  addSlot: (tempId: string, args: { workoutId: string; muscle: string; role: string }) =>
    enqueue({ kind: "addSlot", tempId, args }),
  assignExercise: (args: { workoutExerciseId: string; exerciseId: string }) =>
    enqueue({ kind: "assignExercise", args }),
  deleteSet: (setId: string) => {
    if (isTemp(setId) && queue.some((j) => j.kind === "addSet" && j.tempId === setId)) {
      cancelPendingCreate(setId);
      return;
    }
    enqueue({ kind: "deleteSet", args: { setId } });
  },
  removeWorkoutExercise: (id: string) => {
    if (
      isTemp(id) &&
      queue.some(
        (j) => (j.kind === "addExercise" || j.kind === "addSlot") && j.tempId === id,
      )
    ) {
      cancelPendingCreate(id);
      return;
    }
    enqueue({ kind: "removeWorkoutExercise", args: { id } });
  },
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
