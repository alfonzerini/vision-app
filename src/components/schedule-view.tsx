"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { CLEAN_TYPE_LABEL } from "@/lib/display";
import type { CleanType, JobStatus } from "@/lib/types";

export interface ScheduleJob {
  id: string;
  status: JobStatus;
  clean_type: CleanType;
  window_count: number | null;
  preferred_date: string | null;
  preferred_time: string | null;
  area: string | null;
}

type View = "month" | "week" | "day" | "list";
const WEEK_OPTS = { weekStartsOn: 1 } as const; // Monday

const STATUS_CHIP: Record<JobStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  open: "bg-slate-100 text-slate-700",
  assigned: "bg-brand-light text-brand-dark",
  in_progress: "bg-amber-100 text-amber-800",
  awaiting_review: "bg-amber-100 text-amber-800",
  completed: "bg-emerald-100 text-emerald-700",
  disputed: "bg-red-100 text-red-700",
  cancelled: "bg-slate-100 text-slate-500",
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const dateKey = (d: Date) => format(d, "yyyy-MM-dd");

function timeBit(j: ScheduleJob) {
  return j.preferred_time && j.preferred_time !== "anytime"
    ? `${cap(j.preferred_time)} · `
    : "";
}

export function ScheduleView({ jobs }: { jobs: ScheduleJob[] }) {
  const router = useRouter();
  const [view, setView] = useState<View>("month");
  const [anchor, setAnchor] = useState<Date>(() => new Date());

  const byDate = useMemo(() => {
    const m = new Map<string, ScheduleJob[]>();
    for (const j of jobs) {
      if (!j.preferred_date) continue;
      const key = j.preferred_date.slice(0, 10);
      const arr = m.get(key);
      if (arr) arr.push(j);
      else m.set(key, [j]);
    }
    return m;
  }, [jobs]);

  const unscheduled = useMemo(
    () => jobs.filter((j) => !j.preferred_date),
    [jobs],
  );

  const open = (id: string) => router.push(`/cleaner/jobs/${id}`);

  function move(delta: number) {
    setAnchor((a) =>
      view === "month"
        ? addMonths(a, delta)
        : view === "week"
          ? addWeeks(a, delta)
          : addDays(a, delta),
    );
  }

  const label =
    view === "month"
      ? format(anchor, "MMMM yyyy")
      : view === "week"
        ? `${format(startOfWeek(anchor, WEEK_OPTS), "d MMM")} – ${format(
            endOfWeek(anchor, WEEK_OPTS),
            "d MMM yyyy",
          )}`
        : view === "day"
          ? format(anchor, "EEEE d MMMM yyyy")
          : "All upcoming jobs";

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-border p-0.5">
          {(["month", "week", "day", "list"] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                view === v ? "bg-brand text-white" : "text-muted hover:text-foreground"
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        {view !== "list" && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => move(-1)}
              aria-label="Previous"
              className="rounded-lg border border-border px-2.5 py-1.5 text-sm hover:bg-brand-light"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => setAnchor(new Date())}
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-brand-light"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => move(1)}
              aria-label="Next"
              className="rounded-lg border border-border px-2.5 py-1.5 text-sm hover:bg-brand-light"
            >
              ›
            </button>
          </div>
        )}
      </div>

      <h2 className="mt-4 text-lg font-bold">{label}</h2>

      {unscheduled.length > 0 && view !== "list" && (
        <p className="mt-2 text-xs text-muted">
          {unscheduled.length} job{unscheduled.length > 1 ? "s" : ""} with no
          date set — see the <strong>List</strong> view.
        </p>
      )}

      <div className="mt-4">
        {view === "month" && <MonthView anchor={anchor} byDate={byDate} open={open} />}
        {view === "week" && <WeekView anchor={anchor} byDate={byDate} open={open} />}
        {view === "day" && <DayView anchor={anchor} byDate={byDate} open={open} />}
        {view === "list" && (
          <ListView jobs={jobs} unscheduled={unscheduled} open={open} />
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ chips
function Chip({ job, onClick }: { job: ScheduleJob; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium ${STATUS_CHIP[job.status]}`}
      title={`${timeBit(job)}${CLEAN_TYPE_LABEL[job.clean_type]}${job.area ? ` · ${job.area}` : ""}`}
    >
      {timeBit(job)}
      {CLEAN_TYPE_LABEL[job.clean_type]}
    </button>
  );
}

function Row({ job, onClick }: { job: ScheduleJob; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-brand"
    >
      <div className="min-w-0">
        <p className="truncate font-medium">
          {CLEAN_TYPE_LABEL[job.clean_type]}
          {job.window_count ? ` · ${job.window_count} windows` : ""}
        </p>
        <p className="truncate text-xs text-muted">
          {timeBit(job) || "Anytime · "}
          {job.area ?? "Nearby"}
        </p>
      </div>
      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CHIP[job.status]}`}>
        {cap(job.status.replace(/_/g, " "))}
      </span>
    </button>
  );
}

// ------------------------------------------------------------------ month
function MonthView({
  anchor,
  byDate,
  open,
}: {
  anchor: Date;
  byDate: Map<string, ScheduleJob[]>;
  open: (id: string) => void;
}) {
  const start = startOfWeek(startOfMonth(anchor), WEEK_OPTS);
  const end = endOfWeek(endOfMonth(anchor), WEEK_OPTS);
  const days = eachDayOfInterval({ start, end });
  const dow = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="grid grid-cols-7 bg-card text-center text-xs font-semibold text-muted">
        {dow.map((d) => (
          <div key={d} className="border-b border-border py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const list = byDate.get(dateKey(day)) ?? [];
          const muted = !isSameMonth(day, anchor);
          return (
            <div
              key={day.toISOString()}
              className={`min-h-20 space-y-1 border-b border-r border-border p-1 last:border-r-0 ${
                muted ? "bg-background/40" : "bg-background"
              }`}
            >
              <div
                className={`text-right text-xs ${
                  isToday(day)
                    ? "font-bold text-brand"
                    : muted
                      ? "text-muted/50"
                      : "text-muted"
                }`}
              >
                {format(day, "d")}
              </div>
              {list.slice(0, 3).map((j) => (
                <Chip key={j.id} job={j} onClick={() => open(j.id)} />
              ))}
              {list.length > 3 && (
                <p className="px-1 text-[10px] text-muted">
                  +{list.length - 3} more
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------- week
function WeekView({
  anchor,
  byDate,
  open,
}: {
  anchor: Date;
  byDate: Map<string, ScheduleJob[]>;
  open: (id: string) => void;
}) {
  const days = eachDayOfInterval({
    start: startOfWeek(anchor, WEEK_OPTS),
    end: endOfWeek(anchor, WEEK_OPTS),
  });
  return (
    <div className="grid gap-3 sm:grid-cols-7">
      {days.map((day) => {
        const list = byDate.get(dateKey(day)) ?? [];
        return (
          <div
            key={day.toISOString()}
            className="rounded-xl border border-border bg-card p-2"
          >
            <p
              className={`mb-2 text-center text-xs font-semibold ${
                isToday(day) ? "text-brand" : "text-muted"
              }`}
            >
              {format(day, "EEE d")}
            </p>
            <div className="space-y-1">
              {list.length === 0 ? (
                <p className="py-2 text-center text-[11px] text-muted/60">—</p>
              ) : (
                list.map((j) => (
                  <Chip key={j.id} job={j} onClick={() => open(j.id)} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// -------------------------------------------------------------------- day
function DayView({
  anchor,
  byDate,
  open,
}: {
  anchor: Date;
  byDate: Map<string, ScheduleJob[]>;
  open: (id: string) => void;
}) {
  const list = byDate.get(dateKey(anchor)) ?? [];
  if (list.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted">
        No jobs on this day.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {list.map((j) => (
        <Row key={j.id} job={j} onClick={() => open(j.id)} />
      ))}
    </div>
  );
}

// ------------------------------------------------------------------- list
function ListView({
  jobs,
  unscheduled,
  open,
}: {
  jobs: ScheduleJob[];
  unscheduled: ScheduleJob[];
  open: (id: string) => void;
}) {
  const scheduled = jobs
    .filter((j) => j.preferred_date)
    .sort((a, b) => (a.preferred_date! < b.preferred_date! ? -1 : 1));

  if (jobs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted">
        You have no booked jobs yet.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {scheduled.map((j) => (
        <div key={j.id}>
          <p className="mb-1.5 text-xs font-semibold text-muted">
            {format(new Date(j.preferred_date!), "EEEE d MMMM yyyy")}
          </p>
          <Row job={j} onClick={() => open(j.id)} />
        </div>
      ))}
      {unscheduled.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold text-muted">No date set</p>
          <div className="space-y-2">
            {unscheduled.map((j) => (
              <Row key={j.id} job={j} onClick={() => open(j.id)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
