"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type DocType = "public_liability_insurance" | "id_verification" | "vehicle";
type DocStatus = "pending" | "approved" | "rejected";

export interface DocumentRow {
  id: string;
  type: DocType;
  status: DocStatus;
  expiry_date: string | null;
  file_path: string;
}

const TYPE_LABEL: Record<DocType, string> = {
  public_liability_insurance: "Public liability insurance",
  id_verification: "Photo ID",
  vehicle: "Vehicle details",
};

const STATUS: Record<DocStatus, { label: string; className: string }> = {
  pending: { label: "Awaiting review", className: "bg-amber-100 text-amber-800" },
  approved: { label: "Approved", className: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-700" },
};

export function DocumentsSection({
  cleanerId,
  initialDocs,
}: {
  cleanerId: string;
  initialDocs: DocumentRow[];
}) {
  const supabase = createClient();
  const [docs, setDocs] = useState<DocumentRow[]>(initialDocs);
  const [type, setType] = useState<DocType>("public_liability_insurance");
  const [expiry, setExpiry] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);

    const ext = (file.name.split(".").pop() || "pdf").toLowerCase();
    const path = `${cleanerId}/${type}-${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("documents")
      .upload(path, file, { contentType: file.type });
    if (upErr) {
      setUploading(false);
      setError("That file couldn't be uploaded. Please try again.");
      return;
    }
    const { data: row, error: insErr } = await supabase
      .from("documents")
      .insert({
        cleaner_id: cleanerId,
        type,
        file_path: path,
        expiry_date:
          type === "public_liability_insurance" && expiry ? expiry : null,
        status: "pending",
      })
      .select("id, type, status, expiry_date, file_path")
      .single();
    setUploading(false);
    if (insErr || !row) {
      setError("Couldn't save that document. Please try again.");
      return;
    }
    setDocs((prev) => [row as DocumentRow, ...prev]);
    setExpiry("");
    e.target.value = "";
  }

  async function view(path: string) {
    const { data } = await supabase.storage
      .from("documents")
      .createSignedUrl(path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Optional for now — but uploading your insurance and ID means we can give
        you a verified badge in future, which customers trust.
      </p>

      {docs.length > 0 && (
        <ul className="space-y-2">
          {docs.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{TYPE_LABEL[d.type]}</p>
                <button
                  type="button"
                  onClick={() => view(d.file_path)}
                  className="text-xs text-brand underline"
                >
                  View
                </button>
                {d.expiry_date && (
                  <span className="ml-2 text-xs text-muted">
                    expires {d.expiry_date}
                  </span>
                )}
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS[d.status].className}`}
              >
                {STATUS[d.status].label}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-xl border border-dashed border-border p-4">
        {error && <p className="mb-2 text-sm font-medium text-red-600">{error}</p>}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 text-sm">
            <span className="mb-1 block font-semibold">Document type</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as DocType)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-base focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand"
            >
              <option value="public_liability_insurance">Public liability insurance</option>
              <option value="id_verification">Photo ID</option>
              <option value="vehicle">Vehicle details</option>
            </select>
          </label>
          {type === "public_liability_insurance" && (
            <label className="text-sm">
              <span className="mb-1 block font-semibold">Expiry date</span>
              <input
                type="date"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-base focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </label>
          )}
        </div>
        <label className="mt-3 block cursor-pointer rounded-xl border border-border px-4 py-2.5 text-center text-sm font-medium transition-colors hover:bg-brand-light">
          {uploading ? "Uploading…" : "📎 Upload document (image or PDF)"}
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={onFile}
            disabled={uploading}
            className="sr-only"
          />
        </label>
      </div>
    </div>
  );
}
