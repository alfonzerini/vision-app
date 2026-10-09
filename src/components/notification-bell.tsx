"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/types";

interface Notification {
  id: string;
  title: string;
  body: string | null;
  data: { job_id?: string } | null;
  read_at: string | null;
  created_at: string;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function NotificationBell({
  userId,
  role,
}: {
  userId: string;
  role: UserRole;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const base = role === "admin" ? "/admin" : `/${role}`;
  const unread = items.filter((n) => !n.read_at).length;

  useEffect(() => {
    let active = true;
    supabase
      .from("notifications")
      .select("id, title, body, data, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (active && data) setItems(data as Notification[]);
      });

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const n = payload.new as Notification;
          setItems((prev) =>
            prev.some((x) => x.id === n.id) ? prev : [n, ...prev],
          );
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      setItems((prev) =>
        prev.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })),
      );
      supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .is("read_at", null)
        .then(() => {});
    }
  }

  function openItem(n: Notification) {
    setOpen(false);
    if (n.data?.job_id) router.push(`${base}/jobs/${n.data.job_id}`);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label="Notifications"
        className="relative rounded-lg border border-border px-2.5 py-1.5 text-sm transition-colors hover:bg-brand-light"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute right-0 z-20 mt-2 w-80 max-w-[90vw] overflow-hidden rounded-xl border border-border bg-card shadow-lg">
            <p className="border-b border-border px-4 py-2.5 text-sm font-semibold">
              Notifications
            </p>
            <div className="max-h-96 overflow-y-auto">
              {items.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted">
                  No notifications yet.
                </p>
              ) : (
                items.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => openItem(n)}
                    className="block w-full border-b border-border px-4 py-3 text-left last:border-0 hover:bg-brand-light"
                  >
                    <p className="text-sm font-semibold">{n.title}</p>
                    {n.body && <p className="mt-0.5 text-xs text-muted">{n.body}</p>}
                    <p className="mt-1 text-[10px] text-muted">
                      {timeAgo(n.created_at)}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
