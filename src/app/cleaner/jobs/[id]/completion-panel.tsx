"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { startJob, completeJob } from "../actions";
import type { JobStatus } from "@/lib/types";

interface Photo {
  id: string;
  url: string;
}

export function CompletionPanel({
  jobId,
  cleanerId,
  status,
  initialPhotos,
  minPhotos,
}: {
  jobId: string;
  cleanerId: string;
  status: JobStatus;
  initialPhotos: Photo[];
  minPhotos: number;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enough = photos.length >= minPhotos;

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setError(null);
    setUploading(true);
    for (const file of files) {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${jobId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("job-media")
        .upload(path, file, { upsert: false });
      if (upErr) {
        setError("A photo failed to upload. Please try again.");
        continue;
      }
      const { data: row, error: insErr } = await supabase
        .from("completion_evidence")
        .insert({
          job_id: jobId,
          cleaner_id: cleanerId,
          kind: "after",
          file_path: path,
        })
        .select("id")
        .single();
      if (insErr || !row) {
        setError("A photo couldn't be saved. Please try again.");
        continue;
      }
      const { data: signed } = await supabase.storage
        .from("job-media")
        .createSignedUrl(path, 3600);
      if (signed?.signedUrl) {
        setPhotos((p) => [...p, { id: row.id, url: signed.signedUrl }]);
      }
    }
    setUploading(false);
    e.target.value = "";
  }

  async function handleStart() {
    setBusy(true);
    setError(null);
    const res = await startJob(jobId);
    setBusy(false);
    if (res.error) setError(res.error);
    else router.refresh();
  }

  function handleComplete() {
    setError(null);
    if (!("geolocation" in navigator)) {
      setError("Your device can't share its location, which is required to complete a job.");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const res = await completeJob(
          jobId,
          pos.coords.latitude,
          pos.coords.longitude,
        );
        setBusy(false);
        if (res.error) setError(res.error);
        else router.refresh();
      },
      () => {
        setBusy(false);
        setError(
          "We need your location to confirm you're at the property. Please allow location access and try again.",
        );
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  const editable = status === "assigned" || status === "in_progress";

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {/* Photo grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <div key={p.id} className="relative aspect-square overflow-hidden rounded-lg border border-border">
              <Image src={p.url} alt="Job photo" fill sizes="120px" className="object-cover" unoptimized />
            </div>
          ))}
        </div>
      )}

      {editable && (
        <>
          <p className="text-sm text-muted">
            {photos.length} of {minPhotos} required photos uploaded.
          </p>

          <label className="block cursor-pointer rounded-xl border-2 border-dashed border-border p-4 text-center text-sm font-medium transition-colors hover:border-brand">
            {uploading ? "Uploading…" : "📷 Add after-photos"}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              onChange={handleFiles}
              disabled={uploading || busy}
              className="sr-only"
            />
          </label>

          <div className="flex flex-col gap-2 sm:flex-row">
            {status === "assigned" && (
              <button
                type="button"
                onClick={handleStart}
                disabled={busy}
                className="flex-1 rounded-xl border-2 border-brand px-4 py-3 font-semibold text-brand transition-colors hover:bg-brand-light disabled:opacity-60"
              >
                Mark as started
              </button>
            )}
            <button
              type="button"
              onClick={handleComplete}
              disabled={!enough || busy}
              title={!enough ? `Upload at least ${minPhotos} photos first` : undefined}
              className="flex-1 rounded-xl bg-brand px-4 py-3 font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
            >
              {busy ? "Please wait…" : "Mark job complete"}
            </button>
          </div>
          <p className="text-xs text-muted">
            Completing requires at least {minPhotos} photos and that you&apos;re at
            the property (we check your location).
          </p>
        </>
      )}
    </div>
  );
}
