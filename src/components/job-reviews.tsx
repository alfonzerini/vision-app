import { createClient } from "@/lib/supabase/server";
import { Stars } from "@/components/stars";
import { ReviewForm } from "@/components/review";

interface ReviewRow {
  reviewer_id: string;
  reviewee_id: string;
  rating: number;
  body: string | null;
}

/**
 * Reviews panel for a completed job: lets the current user leave a review of
 * the other party (once), and shows any review they received. Render only when
 * the job is completed.
 */
export async function JobReviews({
  jobId,
  currentUserId,
  otherPartyName,
}: {
  jobId: string;
  currentUserId: string;
  otherPartyName: string;
}) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reviews")
    .select("reviewer_id, reviewee_id, rating, body")
    .eq("job_id", jobId);
  const reviews = (data as ReviewRow[] | null) ?? [];

  const mine = reviews.find((r) => r.reviewer_id === currentUserId);
  const received = reviews.find((r) => r.reviewee_id === currentUserId);

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="text-lg font-bold">Reviews</h2>

      <div className="mt-4">
        {mine ? (
          <div>
            <p className="text-sm font-semibold">Your review</p>
            <Stars rating={mine.rating} className="text-xl" />
            {mine.body && <p className="mt-1 text-sm text-muted">{mine.body}</p>}
          </div>
        ) : (
          <ReviewForm jobId={jobId} revieweeName={otherPartyName} />
        )}
      </div>

      {received && (
        <div className="mt-6 border-t border-border pt-4">
          <p className="text-sm font-semibold">{otherPartyName} reviewed you</p>
          <Stars rating={received.rating} className="text-xl" />
          {received.body && (
            <p className="mt-1 text-sm text-muted">{received.body}</p>
          )}
        </div>
      )}
    </section>
  );
}
