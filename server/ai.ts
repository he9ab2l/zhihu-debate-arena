const DEFAULT_TIMEOUT_MS = 30_000;

type SummaryScope = "evidence" | "debate" | "rounds";

function config() {
  return {
    url: process.env.AI_API_URL?.trim().replace(/\/$/, "") || null,
    key: process.env.AI_API_KEY?.trim() || null,
    model: process.env.AI_MODEL?.trim() || null,
  };
}

export function aiStatus() {
  const { url, key, model } = config();
  let provider: string | null = null;
  try { provider = url ? new URL(url).hostname : null; } catch { provider = null; }
  return { configured: Boolean(url && key && model && provider), provider, model: model || null };
}

export async function summarizeDebate(brief: any, scope: SummaryScope, evidenceId?: string) {
  const { url, key, model } = config();
  if (!url || !key || !model) return { ok: false as const, reason: "missing_ai_config" };
  const selected = scope === "evidence"
    ? { topic: brief.topic, evidence: (brief.evidence ?? []).filter((item: any) => !evidenceId || item.id === evidenceId) }
    : scope === "rounds"
      ? { topic: brief.topic, thesis: brief.thesis, rounds: brief.rounds, evidence: brief.evidence }
      : brief;
  const label = scope === "evidence" ? "单篇证据摘要" : scope === "rounds" ? "三回合交锋后的综合结论" : "整场辩题总结";
  const prompt = [
    "你是知乎思辩台的决策辅助总结器。只根据输入中的真实知乎检索摘要归纳，不补造来源、作者、数据或事实。",
    `当前范围：${label}。请输出中文，包含核心信息、支持视角、质疑视角、需要核验的条件、下一步低成本行动。`,
    "明确说明摘要不是全文；证据不足时直接说证据不足。不要替用户投票或给出绝对结论。",
    `辩题数据：${JSON.stringify(selected)}`,
  ].join("\n\n");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(`${url}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ model, temperature: 0.2, max_tokens: 1200, messages: [{ role: "system", content: "你输出严谨、简洁、来源边界清晰的中文决策辅助文字。" }, { role: "user", content: prompt }] }),
      signal: controller.signal,
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) return { ok: false as const, reason: `http_${response.status}` };
    const content = body?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) return { ok: false as const, reason: "empty_response" };
    return { ok: true as const, content: content.trim(), model };
  } catch (error) {
    return { ok: false as const, reason: error instanceof Error && error.name === "AbortError" ? "timeout" : "network" };
  } finally { clearTimeout(timer); }
}
