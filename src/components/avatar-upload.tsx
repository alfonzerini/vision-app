"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/avatar";

/** Lets a user upload/replace their profile photo (public avatars bucket). */
export function AvatarUpload({
  userId,
  initialUrl,
  name,
}: {
  userId: string;
  initialUrl: string | null;
  name: string | null;
}) {
  const supabase = createClient();
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);

    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${userId}/avatar.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      setUploading(false);
      setError("That photo couldn't be uploaded. Please try another.");
      return;
    }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    const newUrl = `${pub.publicUrl}?t=${Date.now()}`;
    const { error: updErr } = await supabase
      .from("profiles")
      .update({ avatar_url: newUrl })
      .eq("id", userId);
    setUploading(false);
    if (updErr) {
      setError("Couldn't save your photo. Please try again.");
      return;
    }
    setUrl(newUrl);
    e.target.value = "";
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar url={url} name={name} size={72} />
      <div>
        <label className="inline-block cursor-pointer rounded-xl border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-brand-light">
          {uploading ? "Uploading…" : url ? "Change photo" : "Add a photo"}
          <input
            type="file"
            accept="image/*"
            onChange={onFile}
            disabled={uploading}
            className="sr-only"
          />
        </label>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        <p className="mt-1 text-xs text-muted">
          A clear photo of your face helps customers trust you.
        </p>
      </div>
    </div>
  );
}
