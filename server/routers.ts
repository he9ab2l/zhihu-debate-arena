import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { insertDebate, listPersistedDebates, parsePayload, getPersistedDebate } from "./db";
import { buildDebate, fetchHot, fetchQuota, hasSecret, searchZhihu, sourceStatus } from "./zhihu";
import { aiStatus, summarizeDebate } from "./ai";

const createBuckets = new Map<string, { started: number; count: number }>();

function clientKey(req: { headers: Record<string, unknown>; socket?: { remoteAddress?: string } }) {
  return String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "anonymous").split(",")[0].trim();
}

function canCreate(req: Parameters<typeof clientKey>[0]) {
  const key = clientKey(req);
  const now = Date.now();
  const current = createBuckets.get(key);
  if (!current || now - current.started > 60_000) {
    createBuckets.set(key, { started: now, count: 1 });
    return true;
  }
  if (current.count >= 8) return false;
  current.count += 1;
  return true;
}

function hydrate(row: { payload: string }) {
  return parsePayload(row);
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  arena: router({
    status: publicProcedure.query(() => ({ ...sourceStatus(), demoAvailable: false })),
    aiStatus: publicProcedure.query(() => aiStatus()),

    list: publicProcedure.query(async () => {
      const persisted = await listPersistedDebates(100);
      return persisted.map(hydrate).filter((item): item is NonNullable<ReturnType<typeof hydrate>> => Boolean(item && item.source === "zhihu"));
    }),

    get: publicProcedure.input(z.object({ id: z.string().min(1).max(64) })).query(async ({ input }) => {
      const row = await getPersistedDebate(input.id);
      const brief = row ? hydrate(row) : null;
      return brief?.source === "zhihu" ? brief : null;
    }),

    create: protectedProcedure.input(z.object({ topic: z.string().trim().min(2, "议题至少需要 2 个字").max(120, "议题最多 120 个字") })).mutation(async ({ input, ctx }) => {
      if (!hasSecret()) throw new Error("知乎开放平台尚未配置 Access Secret，暂时无法进行真实检索。");
      if (!canCreate(ctx.req)) throw new Error("请求过于频繁，请稍后再试。");
      const search = await searchZhihu(input.topic, 8);
      if (!search.ok) throw new Error(`知乎检索失败（${search.reason}），未生成无来源的演示结果。`);
      if (search.items.length === 0) throw new Error("知乎检索没有返回可核验来源，未生成辩题。");
      const brief = buildDebate(input.topic, search.items);
      const ownerOpenId = ctx.user?.openId ?? null;
      await insertDebate({ id: brief.id, topic: brief.topic, source: brief.source, ownerOpenId, payload: JSON.stringify(brief) });
      return { brief, search: { available: search.ok, reason: search.reason, count: search.items.length } };
    }),

    summarize: publicProcedure.input(z.object({ id: z.string().min(1).max(64), scope: z.enum(["evidence", "debate", "rounds"]), evidenceId: z.string().max(128).optional() })).mutation(async ({ input }) => {
      const row = await getPersistedDebate(input.id);
      const brief = row ? hydrate(row) : null;
      if (!brief || brief.source !== "zhihu") throw new Error("只能总结已保存的真实知乎辩题。");
      const result = await summarizeDebate(brief, input.scope, input.evidenceId);
      if (!result.ok) throw new Error(`AI 总结暂不可用（${result.reason}）。`);
      return result;
    }),

    hot: publicProcedure.input(z.object({ limit: z.number().int().min(1).max(30).default(12) }).optional()).query(async ({ input }) => {
      const result = await fetchHot(input?.limit ?? 12);
      return { ...result, configured: hasSecret() };
    }),

    quota: publicProcedure.query(async () => {
      const result = await fetchQuota();
      return { ...result, configured: hasSecret() };
    }),
  }),
});

export type AppRouter = typeof appRouter;
