import { headers } from "next/headers";
import { SITE_URL } from "@/lib/stripe/env";

/**
 * The public origin of the current request (e.g. https://vision-app-peach.vercel.app
 * or http://localhost:3000), for building external redirect/return URLs. Falls
 * back to NEXT_PUBLIC_SITE_URL when headers aren't available.
 */
export async function getBaseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.includes("localhost") ? "http" : "https");
  return host ? `${proto}://${host}` : SITE_URL;
}
