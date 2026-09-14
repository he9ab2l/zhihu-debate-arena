import crypto from "node:crypto";

export type Evidence = {
  id: string;
  title: string;
  excerpt: string;
  url: string;
  authorName: string;
  authorBadge: string;
  contentType: string;
  authorityLevel: string;
  voteUpCount: number | null;
  commentCount: number | null;
  publishedAt: number | null;
  perspective: "支持视角" | "质疑视角";
};

export type DebateBrief = {
  id: string;
  topic: string;
  source: "zhihu";
  generatedAt: string;
  sourceNote: string;
  question: string;
  thesis: {
    pro: string;
    con: string;
  };
  rounds: Array<{
    name: string;
    prompt: string;
    pro: { claim: string; evidenceIds: string[] };
    con: { claim: string; evidenceIds: string[] };
  }>;
  evidence: Evidence[];
  synthesis: {
    summary: string;
    decisionChecks: string[];
    unresolved: string[];
  };
};

export type HotItem = { title: string; url: string; summary: string; thumbnailUrl: string };

const API_BASE = "https://developer.zhihu.com";
const DEFAULT_TIMEOUT_MS = 12_000;

function accessSecret() {
  const value = process.env.ZHIHU_ACCESS_SECRET?.trim();
  return value || null;
}

function headers() {
  const secret = accessSecret();
  if (!secret) return null;
  return {
    Authorization: `Bearer ${secret}`,
    "X-Request-Timestamp": String(Math.floor(Date.now() / 1000)),
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": "zhihu-debate-arena/2.0",
  };
}

async function requestJson(path: string, init: RequestInit = {}) {
  const authHeaders = headers();
  if (!authHeaders) return { ok: false as const, reason: "missing_secret" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { ...authHeaders, ...(init.headers ?? {}) },
      signal: controller.signal,
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) return { ok: false as const, reason: `http_${response.status}`, body };
    const code = body?.Code ?? body?.code;
    if (code !== undefined && Number(code) !== 0) {
      return { ok: false as const, reason: `api_${code}`, body };
    }
    return { ok: true as const, body };
  } catch (error) {
    return { ok: false as const, reason: error instanceof Error && error.name === "AbortError" ? "timeout" : "network" };
  } finally {
    clearTimeout(timer);
  }
}

function clean(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function asNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeSearchItem(item: any, index: number): Evidence | null {
  const title = clean(item?.Title);
  const excerpt = clean(item?.ContentText);
  const url = clean(item?.Url);
  if (!title || !url || !excerpt) return null;
  return {
    id: clean(item?.ContentID, `evidence-${index + 1}`),
    title,
    excerpt: excerpt.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    url,
    authorName: clean(item?.AuthorName, "知乎答主"),
    authorBadge: clean(item?.AuthorBadgeText),
    contentType: clean(item?.ContentType, "内容"),
    authorityLevel: clean(item?.AuthorityLevel),
    voteUpCount: asNumber(item?.VoteUpCount),
    commentCount: asNumber(item?.CommentCount),
    publishedAt: asNumber(item?.EditTime),
    perspective: index % 2 === 0 ? "支持视角" : "质疑视角",
  };
}

export async function searchZhihu(topic: string, count = 8) {
  const result = await requestJson(`/api/v1/content/zhihu_search?Query=${encodeURIComponent(topic)}&Count=${Math.min(Math.max(count, 1), 10)}`);
  if (!result.ok) return { ok: false as const, reason: result.reason, items: [] as Evidence[] };
  const rawItems = Array.isArray(result.body?.Data?.Items) ? result.body.Data.Items : [];
  const items = rawItems.map(normalizeSearchItem).filter(Boolean) as Evidence[];
  return { ok: true as const, reason: null, items };
}

export async function fetchHot(limit = 12) {
  if (!accessSecret()) return { ok: false as const, reason: "missing_secret", items: [] };
  const result = await requestJson(`/api/v1/content/hot_list?Limit=${Math.min(Math.max(limit, 1), 30)}`);
  if (!result.ok) return { ok: false as const, reason: result.reason, items: [] };
  const rawItems = Array.isArray(result.body?.Data?.Items) ? result.body.Data.Items : [];
  return {
    ok: true as const,
    reason: null,
    items: rawItems.map((item: any, index: number) => ({
      title: clean(item?.Title),
      url: clean(item?.Url),
      summary: clean(item?.Summary),
      thumbnailUrl: clean(item?.ThumbnailUrl),
      rank: index + 1,
    })).filter((item: HotItem) => item.title && item.url),
  };
}

export async function fetchQuota() {
  const result = await requestJson("/api/v1/quota");
  if (!result.ok) return { ok: false as const, reason: result.reason, items: [] };
  const items = Array.isArray(result.body?.Data) ? result.body.Data : [];
  return {
    ok: true as const,
    reason: null,
    items: items.map((item: any) => ({
      id: clean(item?.APIID),
      name: clean(item?.APIName, "未命名能力"),
      total: asNumber(item?.TotalQuota) ?? 0,
      used: asNumber(item?.TotalUsed) ?? 0,
      remaining: asNumber(item?.RemainingQuota) ?? 0,
    })),
  };
}

function compactTopic(topic: string) {
  return topic.replace(/[“”"「」]/g, "").replace(/[？?。！!]+$/, "");
}

function makeId() {
  return crypto.randomBytes(8).toString("hex");
}

function evidenceFor(items: Evidence[], perspective: Evidence["perspective"]) {
  return items.filter(item => item.perspective === perspective).slice(0, 3);
}

export function buildDebate(topic: string, items: Evidence[]): DebateBrief {
  const normalizedTopic = compactTopic(topic);
  if (items.length === 0) throw new Error("没有真实知乎证据，不能生成辩题。");
  const support = evidenceFor(items, "支持视角");
  const challenge = evidenceFor(items, "质疑视角");
  const proIds = support.map(item => item.id);
  const conIds = challenge.map(item => item.id);
  const sourceNote = "本次辩题由知乎开放平台站内搜索结果整理。左右两侧是阅读视角，不等同于原作者自称的立场；请打开原文核验上下文。";
  const insufficient = "当前检索结果没有足够的该视角摘要；请打开原文核验，或换一个更具体的议题重新检索。";
  const proClaim = support[0]?.excerpt || insufficient;
  const conClaim = challenge[0]?.excerpt || insufficient;
  const rounds = [
    { name: "立论", prompt: "先明确你愿意为哪一个结果下注。", pro: { claim: proClaim, evidenceIds: proIds.slice(0, 1) }, con: { claim: conClaim, evidenceIds: conIds.slice(0, 1) } },
    { name: "攻防", prompt: "把对方的隐含前提翻出来，再检查它是否适合你的处境。", pro: { claim: support[1]?.excerpt || insufficient, evidenceIds: proIds.slice(1, 2) }, con: { claim: challenge[1]?.excerpt || insufficient, evidenceIds: conIds.slice(1, 2) } },
    { name: "终局", prompt: "把观点转换成今天能执行的判断条件，而不是替你做决定。", pro: { claim: support[2]?.excerpt || insufficient, evidenceIds: proIds.slice(2, 3) }, con: { claim: challenge[2]?.excerpt || insufficient, evidenceIds: conIds.slice(2, 3) } },
  ];
  return {
    id: makeId(),
    topic,
    source: "zhihu",
    generatedAt: new Date().toISOString(),
    sourceNote,
    question: `关于“${normalizedTopic}”，什么条件下值得选择？`,
    thesis: { pro: "优先争取上限，并用小步试错换取信息。", con: "优先守住下限，并把不可逆风险挡在门外。" },
    rounds,
    evidence: items,
    synthesis: {
      summary: `围绕“${normalizedTopic}”的检索结果呈现出两种稳定张力：一侧强调增量与主动权，另一侧强调容错与退出成本。更可靠的结论不是简单投票，而是把你的资源、时间和最坏情况代入。`,
      decisionChecks: [
        "如果选择失败，损失是否可逆？多久能回到原点？",
        "你当前拥有多长的时间、现金流和支持网络作为安全垫？",
        "能否先做一个一到两周的低成本试验，再扩大投入？",
      ],
      unresolved: [
        "检索摘要不等于完整回答，作者上下文和时间有效性仍需打开原文核验。",
        "同一观点在不同人的资源约束下，结论可能完全相反。",
      ],
    },
  };
}

export function hasSecret() {
  return Boolean(accessSecret());
}

export function sourceStatus() {
  return {
    configured: hasSecret(),
    provider: "知乎开放平台 HTTP API",
    note: hasSecret() ? "服务端已配置 Access Secret；凭证不会返回浏览器。" : "未配置 Access Secret；当前只能浏览已保存结果，无法发起真实检索。",
  };
}
