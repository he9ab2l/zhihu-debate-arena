import { afterEach, describe, expect, it, vi } from "vitest";
import { summarizeDebate } from "./ai";

const originalEnv = { AI_API_URL: process.env.AI_API_URL, AI_API_KEY: process.env.AI_API_KEY, AI_MODEL: process.env.AI_MODEL };

const sampleBrief = {
  topic: "普通人要不要转行",
  question: "什么条件下值得选择？",
  thesis: { pro: "争取上限", con: "守住下限" },
  evidence: [{ id: "evidence-1", title: "转行经验", authorName: "答主", perspective: "支持视角", excerpt: "x".repeat(2400) }],
  rounds: [{ name: "立论", prompt: "明确下注", pro: { claim: "尝试", evidenceIds: ["evidence-1"] }, con: { claim: "核验", evidenceIds: [] } }],
  synthesis: { decisionChecks: ["先做小实验"], unresolved: ["需要打开原文"] },
};

afterEach(() => {
  process.env.AI_API_URL = originalEnv.AI_API_URL;
  process.env.AI_API_KEY = originalEnv.AI_API_KEY;
  process.env.AI_MODEL = originalEnv.AI_MODEL;
  vi.unstubAllGlobals();
});

describe("AI 总结适配层", () => {
  it("压缩长摘要并发送严格的证据边界提示词", async () => {
    process.env.AI_API_URL = "https://ai.example.test/v1";
    process.env.AI_API_KEY = "test-key";
    process.env.AI_MODEL = "gemini-3.8-flash";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: "## 核心信息\n证据不足。" } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await summarizeDebate(sampleBrief, "rounds");
    expect(result).toMatchObject({ ok: true, model: "gemini-3.8-flash" });
    const request = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    const prompt = request.messages[1].content as string;
    expect(prompt).toContain("禁止补造作者、赞同数");
    expect(prompt).toContain("[证据: evidence-id]");
    expect(prompt.length).toBeLessThan(7000);
  });

  it("缺少配置时不发起外部请求", async () => {
    delete process.env.AI_API_URL;
    delete process.env.AI_API_KEY;
    delete process.env.AI_MODEL;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(summarizeDebate(sampleBrief, "evidence", "evidence-1")).resolves.toEqual({ ok: false, reason: "missing_ai_config" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
