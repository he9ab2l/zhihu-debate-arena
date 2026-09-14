import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowUpRight, BookOpen, Check, CircleHelp, Clock3, FileText, Flame, Github, Lightbulb, Loader2, Moon, PanelLeft, Play, Scale, Search, ShieldCheck, Sparkles, Sun, Users, X } from "lucide-react";

const FALLBACK_SUGGESTIONS = [
  "AI 时代，普通人应该先做产品还是先补系统知识？",
  "第一份工作，要优先选择成长速度还是生活确定性？",
  "大学生是否应该把时间投入到一个长期副业？",
];

function formatTime(value: string | Date | undefined) {
  if (!value) return "刚刚";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "刚刚" : date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

function SourceBadge({ source }: { source: "zhihu" | "demo" }) {
  return source === "zhihu" ? (
    <Badge className="source-badge source-badge-live"><span className="status-dot" />知乎站内检索</Badge>
  ) : (
    <Badge variant="outline" className="source-badge"><span className="status-dot status-dot-muted" />演示框架</Badge>
  );
}

export default function Home() {
  const { toggleTheme, theme } = useTheme();
  const auth = useAuth();
  const [topic, setTopic] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const [hotOpen, setHotOpen] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const utils = trpc.useUtils();
  const briefsQuery = trpc.arena.list.useQuery();
  const statusQuery = trpc.arena.status.useQuery();
  const hotQuery = trpc.arena.hot.useQuery({ limit: 10 });
  const quotaQuery = trpc.arena.quota.useQuery();
  const createMutation = trpc.arena.create.useMutation({
    onSuccess: async ({ brief, search }) => {
      setActiveId(brief.id);
      setRound(0);
      setTopic("");
      await utils.arena.list.invalidate();
      toast.success(search.available ? "已用知乎站内检索生成辩题" : "已生成演示框架", { description: search.available ? `收录 ${search.count} 条可核验来源。` : "配置 Access Secret 后可切换到真实检索。" });
    },
    onError: (error) => toast.error("生成失败", { description: error.message }),
  });

  const briefs = briefsQuery.data ?? [];
  const active = useMemo(() => briefs.find(item => item?.id === activeId) ?? briefs[0], [briefs, activeId]);
  const activeRound = active?.rounds?.[round] ?? active?.rounds?.[0];
  const suggestions = (active?.topic ? FALLBACK_SUGGESTIONS.filter(item => item !== active.topic) : FALLBACK_SUGGESTIONS).slice(0, 3);

  const selectBrief = (id: string) => {
    setActiveId(id);
    setRound(0);
    if (window.innerWidth < 900) window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const create = () => {
    const value = topic.trim();
    if (value.length < 2) {
      toast.error("议题太短", { description: "请至少输入 2 个字，尽量把冲突条件说具体。" });
      return;
    }
    createMutation.mutate({ topic: value });
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/" className="brand" aria-label="知乎思辩台首页">
            <span className="brand-mark"><Scale size={17} strokeWidth={2.4} /></span>
            <span><strong>知乎思辩台</strong><small>DEBATE ARENA</small></span>
          </Link>
          <div className="topbar-actions">
            <div className={`connection-pill ${statusQuery.data?.configured ? "is-live" : ""}`} title={statusQuery.data?.note}>
              <span className="status-dot" />
              <span>{statusQuery.data?.configured ? "真实检索已接入" : "演示模式"}</span>
            </div>
            <button className="icon-button" onClick={() => toggleTheme?.()} aria-label={theme === "dark" ? "切换浅色模式" : "切换深色模式"}>{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button>
            {auth.isAuthenticated ? <Button variant="outline" size="sm" onClick={() => auth.logout()}>退出</Button> : <Button variant="outline" size="sm" onClick={() => startLogin()}>登录保存</Button>}
          </div>
        </div>
      </header>

      <main className="workspace">
        <aside className="sidebar-panel">
          <div className="sidebar-heading"><div><span className="eyebrow">WORKSPACE</span><h2>我的辩题</h2></div><PanelLeft size={18} className="muted-icon" /></div>
          <div className="sidebar-tabs">
            <button className="sidebar-tab is-active">已生成 <span>{briefs.length}</span></button>
            <button className="sidebar-tab" onClick={() => setHotOpen(true)}>今日热榜 <Flame size={14} /></button>
          </div>
          <div className="brief-list" aria-live="polite">
            {briefsQuery.isLoading ? Array.from({ length: 3 }).map((_, i) => <div className="brief-skeleton" key={i} />) : briefs.map((item) => (
              <button key={item.id} className={`brief-list-item ${active?.id === item.id ? "is-active" : ""}`} onClick={() => selectBrief(item.id)}>
                <span className="list-item-index">{String(briefs.indexOf(item) + 1).padStart(2, "0")}</span>
                <span className="list-item-copy"><strong>{item.topic}</strong><small><SourceBadge source={item.source} /> {formatTime(item.generatedAt)}</small></span>
              </button>
            ))}
          </div>
          <div className="sidebar-footer">
            <div className="mini-stat"><span><ShieldCheck size={14} />数据边界</span><strong>不伪造论据</strong></div>
            <p>真实摘要只来自知乎开放平台；没有凭证时，系统会把演示内容标成演示内容。</p>
          </div>
        </aside>

        <section className="main-panel">
          <div className="hero-block">
            <div className="hero-kicker"><Sparkles size={15} />从观点交锋里找到自己的判断条件</div>
            <h1>先把分歧摆在桌面上，<em>再做决定。</em></h1>
            <p className="hero-lead">知乎思辩台不替你投票。它把同一议题的支持与质疑，整理成可核验的证据卡、三回合交锋与行动前检查清单。</p>
            <div className="topic-composer">
              <div className="composer-top"><CircleHelp size={16} /><span>输入一个你正在犹豫的议题</span><span className="char-count">{topic.length}/120</span></div>
              <div className="composer-row"><Input value={topic} onChange={event => setTopic(event.target.value)} onKeyDown={event => { if (event.key === "Enter") create(); }} placeholder="例如：要不要为了稳定放弃擅长的事？" maxLength={120} /><Button onClick={create} disabled={createMutation.isPending}>{createMutation.isPending ? <Loader2 className="spin" size={16} /> : <Play size={16} fill="currentColor" />} {createMutation.isPending ? "整理中" : "开始拆解"}</Button></div>
              <div className="suggestion-row"><span>试试：</span>{suggestions.map(item => <button key={item} onClick={() => setTopic(item)}>{item}</button>)}</div>
            </div>
          </div>

          {briefsQuery.isLoading ? <div className="loading-card"><Loader2 className="spin" />正在加载辩题工作台…</div> : active ? <>
            <div className="brief-header">
              <div className="brief-title-block"><div className="brief-meta"><SourceBadge source={active.source} /><span><Clock3 size={13} /> {formatTime(active.generatedAt)}</span></div><h2>{active.topic}</h2><p>{active.question}</p></div>
              <div className="brief-actions"><Button variant="outline" size="sm" onClick={() => navigator.clipboard?.writeText(window.location.href).then(() => toast.success("链接已复制"))}><ArrowUpRight size={15} />分享</Button><Sheet open={evidenceOpen} onOpenChange={setEvidenceOpen}><SheetTrigger asChild><Button variant="outline" size="sm"><BookOpen size={15} />证据库 <span className="button-count">{active.evidence?.length ?? 0}</span></Button></SheetTrigger><SheetContent className="evidence-sheet"><SheetHeader><SheetTitle>证据库 <span>{active.evidence?.length ?? 0} 条</span></SheetTitle></SheetHeader><div className="sheet-note"><ShieldCheck size={16} />每条卡片都保留知乎原文链接。摘要不是全文，打开来源核验上下文。</div><div className="evidence-stack">{(active.evidence ?? []).length ? active.evidence.map((item: any) => <EvidenceCard key={item.id} item={item} />) : <EmptyEvidence />}</div></SheetContent></Sheet></div>
            </div>

            <section className="thesis-grid" aria-label="双方主张"><ThesisCard side="pro" label="支持视角" title="先争取上限" text={active.thesis?.pro ?? ""} /><div className="versus"><span>VS</span><i /></div><ThesisCard side="con" label="质疑视角" title="先守住下限" text={active.thesis?.con ?? ""} /></section>

            <section className="rounds-section"><div className="section-heading"><div><span className="eyebrow">THE EXCHANGE</span><h3>三回合交锋</h3></div><span className="section-caption">观点是材料，条件才是结论</span></div><Tabs value={String(round)} onValueChange={value => setRound(Number(value))} className="round-tabs"><TabsList>{(active.rounds ?? []).map((item: any, index: number) => <TabsTrigger key={item.name} value={String(index)}><span>0{index + 1}</span>{item.name}</TabsTrigger>)}</TabsList>{(active.rounds ?? []).map((item: any, index: number) => <TabsContent key={item.name} value={String(index)}><div className="round-intro"><div className="round-number">0{index + 1}</div><div><h4>{item.name}</h4><p>{item.prompt}</p></div></div><div className="exchange-grid"><ArgumentCard side="pro" label="支持视角" argument={item.pro} evidence={active.evidence ?? []} /><ArgumentCard side="con" label="质疑视角" argument={item.con} evidence={active.evidence ?? []} /></div></TabsContent>)}</Tabs></section>

            <section className="synthesis-card"><div className="section-heading"><div><span className="eyebrow">THE TAKEAWAY</span><h3>把分歧变成检查清单</h3></div><Lightbulb size={20} /></div><p className="synthesis-summary">{active.synthesis?.summary}</p><div className="check-grid">{(active.synthesis?.decisionChecks ?? []).map((item: string, index: number) => <div className="check-item" key={item}><span>0{index + 1}</span><p>{item}</p></div>)}</div><Separator /><div className="unresolved"><strong><FileText size={15} />还没有被解决的部分</strong>{(active.synthesis?.unresolved ?? []).map((item: string) => <span key={item}><X size={13} />{item}</span>)}</div></section>
          </> : <div className="empty-workspace"><Search size={24} /><h2>从一个议题开始</h2><p>输入你的真实问题，系统会先尝试调用知乎站内搜索；没有凭证时也会保留一套不伪造来源的拆解框架。</p></div>}
        </section>
      </main>

      <footer className="site-footer"><span>知乎思辩台 · 2026 黑客松作品</span><span className="footer-links"><a href="https://developer.zhihu.com/profile" target="_blank" rel="noreferrer">开放平台 <ArrowUpRight size={12} /></a><a href="https://github.com/he9ab2l/zhihu-debate-arena" target="_blank" rel="noreferrer"><Github size={13} /> GitHub</a><span><Users size={13} /> {auth.user?.name ?? "访客模式"}</span></span></footer>

      <Sheet open={hotOpen} onOpenChange={setHotOpen}><SheetContent className="hot-sheet"><SheetHeader><SheetTitle><Flame size={18} />今日热榜</SheetTitle></SheetHeader><div className="sheet-note"><ShieldCheck size={16} />热榜只用于发现议题。点击后会填入输入框，不会自动消耗站内检索额度。</div><div className="hot-list">{hotQuery.isLoading ? <div className="loading-card"><Loader2 className="spin" />正在读取榜单…</div> : hotQuery.data?.items?.map((item: any) => <button key={item.rank + item.title} className="hot-item" onClick={() => { setTopic(item.title); setHotOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); }}><span>{String(item.rank).padStart(2, "0")}</span><div><strong>{item.title}</strong><small>{item.summary || "打开后查看原始讨论"}</small></div><ArrowUpRight size={15} /></button>)}</div></SheetContent></Sheet>

      <Sheet><SheetTrigger asChild><button className="source-fab" aria-label="查看数据源状态"><span className={`status-dot ${statusQuery.data?.configured ? "" : "status-dot-muted"}`} /><span>数据源</span></button></SheetTrigger><SheetContent><SheetHeader><SheetTitle>数据源与额度</SheetTitle></SheetHeader><div className="source-panel"><div className={`source-status ${statusQuery.data?.configured ? "live" : "demo"}`}><div className="status-icon">{statusQuery.data?.configured ? <Check size={17} /> : <CircleHelp size={17} />}</div><div><strong>{statusQuery.data?.configured ? "知乎开放平台已连接" : "当前是演示模式"}</strong><p>{statusQuery.data?.note}</p></div></div><div className="source-rule"><ShieldCheck size={16} /><span>Access Secret 只在服务端使用，不会返回前端、写入 GitHub 或出现在日志。</span></div><div className="quota-heading"><strong>今日额度</strong><span>{quotaQuery.data?.configured ? "来自开放平台实时查询" : "配置密钥后可读取"}</span></div>{quotaQuery.data?.ok && quotaQuery.data.items.length ? quotaQuery.data.items.slice(0, 5).map((item: any) => <div className="quota-row" key={item.id}><div><span>{item.name}</span><b>{item.remaining} / {item.total}</b></div><div className="quota-bar"><i style={{ width: `${item.total ? Math.min(100, (item.used / item.total) * 100) : 0}%` }} /></div></div>) : <div className="quota-empty"><CircleHelp size={17} /><span>这里不会显示估算数字。配置 Access Secret 后才显示真实额度。</span></div>}<Button variant="outline" className="full-button" onClick={() => window.open("https://developer.zhihu.com/profile", "_blank", "noopener,noreferrer")}>前往知乎开放平台 <ArrowUpRight size={15} /></Button></div></SheetContent></Sheet>
    </div>
  );
}

function ThesisCard({ side, label, title, text }: { side: "pro" | "con"; label: string; title: string; text: string }) {
  return <article className={`thesis-card thesis-${side}`}><div className="card-kicker"><span className="stance-marker" />{label}</div><h3>{title}</h3><p>{text}</p><span className="card-arrow"><ArrowUpRight size={16} /></span></article>;
}

function ArgumentCard({ side, label, argument, evidence }: { side: "pro" | "con"; label: string; argument: { claim: string; evidenceIds: string[] }; evidence: any[] }) {
  const linked = evidence.filter(item => argument.evidenceIds?.includes(item.id));
  return <article className={`argument-card argument-${side}`}><div className="argument-label"><span className="stance-marker" />{label}</div><p>{argument.claim}</p>{linked.length ? <div className="linked-source"><BookOpen size={14} /><span>来自 {linked[0].authorName} 的检索摘要</span><a href={linked[0].url} target="_blank" rel="noreferrer" aria-label="打开知乎原文"><ArrowUpRight size={14} /></a></div> : <div className="linked-source is-demo"><CircleHelp size={14} /><span>暂无真实来源 · 演示框架</span></div>}</article>;
}

function EvidenceCard({ item }: { item: any }) {
  return <article className="evidence-card"><div className="evidence-top"><Badge variant="outline">{item.contentType}</Badge><span>{item.perspective}</span></div><h4>{item.title}</h4><p>{item.excerpt}</p><div className="evidence-bottom"><span>{item.authorName}{item.authorBadge ? ` · ${item.authorBadge}` : ""}</span><a href={item.url} target="_blank" rel="noreferrer">打开原文 <ArrowUpRight size={13} /></a></div></article>;
}

function EmptyEvidence() {
  return <div className="empty-evidence"><BookOpen size={25} /><strong>还没有真实论据</strong><p>当前只展示可交互的演示框架，不会用虚构作者或赞同数填充这里。</p></div>;
}
