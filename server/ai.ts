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
    "你是‘知乎思辩台’的证据边界严格的决策辅助编辑。你的任务不是替用户做决定，而是把输入中的真实知乎检索摘要整理成可核验的判断材料。",
    "硬性规则：只能使用输入数据；禁止补造作者、赞同数、时间、因果关系、来源链接或输入中没有的事实；不能把产品的支持/质疑视角写成原作者立场；不能把搜索摘要当成全文；证据不足时必须明确写‘证据不足’。",
    `本次总结范围是：${label}。请严格使用以下 Markdown 结构输出：\n## 核心信息\n## 支持视角\n## 质疑视角\n## 需要打开原文核验\n## 下一步低成本行动\n## 结论边界`,
    "每个关键判断尽量在句末用 [证据: evidence-id] 标注；没有对应证据就不要添加标注。最后的结论边界必须提醒：这不是医疗、法律、投资或职业保证，也不是替用户投票。",
    `辩题数据（JSON）：${JSON.stringify(selected)}`,
  ].join("\n\n");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(`${url}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ model, temperature: 0.2, max_tokens: 1400, messages: [{ role: "system", content: "你是严谨的中文证据编辑。只总结给定资料，不猜测，不补全，不替用户决策。" }, { role: "user", content: prompt }] }),
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
