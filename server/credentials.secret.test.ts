import { describe, expect, it } from "vitest";
import { fetchQuota } from "./zhihu";

describe("configured service credentials", () => {
  it.skipIf(!process.env.ZHIHU_ACCESS_SECRET?.trim())("validates the Zhihu Access Secret with the lightweight quota endpoint", async () => {
    const result = await fetchQuota();
    expect(result.ok).toBe(true);
    expect(Array.isArray(result.items)).toBe(true);
    expect(JSON.stringify(result)).not.toContain(process.env.ZHIHU_ACCESS_SECRET ?? "__missing__");
  }, 20_000);

  it.skipIf(!process.env.AI_API_URL?.trim() || !process.env.AI_API_KEY?.trim())("validates the AI API key without exposing it", async () => {
    const response = await fetch(`${process.env.AI_API_URL!.replace(/\/$/, "")}/models`, {
      headers: { Authorization: `Bearer ${process.env.AI_API_KEY!}`, Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
    expect(response.ok).toBe(true);
    const body = await response.text();
    expect(body).not.toContain(process.env.AI_API_KEY!);
  }, 25_000);
});
