/** Minimal JSON fetch helper for the explorer API. */

import { demoGet, isDemo } from "./demo";

export async function getJSON<T = any>(url: string): Promise<T> {
  // Static demo builds have no server: answer from the bundled dataset.
  if (isDemo()) return demoGet<T>(url);

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    let message = res.statusText;
    try {
      message = (await res.json()).error || message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return res.json();
}
