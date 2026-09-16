"use client";

import { Fragment, useEffect, useRef, useState, type FormEvent } from "react";
import type { GeminiResearchResult } from "@/lib/gemini-research";
import { safeResearchUrl, validateSearchSuggestions } from "@/lib/google-search-suggestions";
import { api } from "./model";
import styles from "../LeadEngineApp.module.css";

type Readiness = { ready: boolean; model: string; reason: string | null };
const CONFIGURATION_MESSAGES: Record<string, string> = {
  free_tier_not_confirmed: "当前运行环境尚未完成免费资格核验，真实请求已关闭。",
  verified_model_mismatch: "模型配置已变化，需要核对该模型的免费资格。",
  invalid_model: "模型配置无效。",
  project_id_missing: "尚未记录密钥所属项目。",
  api_key_missing: "服务端尚未载入 Gemini 密钥。",
  key_hash_invalid: "尚未将免费资格与当前密钥对应。",
  key_hash_mismatch: "密钥已变化，需要重新对应项目和免费资格。",
};

function SearchSuggestions({ html }: { html: string | null }) {
  const host = useRef<HTMLDivElement>(null);
  const status = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (!host.current || !status.current) return;
    const root = host.current.shadowRoot || host.current.attachShadow({ mode: "open" });
    root.replaceChildren();
    const content = html ? validateSearchSuggestions(html, document) : null;
    status.current.textContent = content ? "Google 搜索建议" : html ? "展示要求未通过：搜索建议未通过安全校验。" : "展示要求未通过：响应未提供 Google 搜索建议。";
    if (content) root.append(content);
    return () => { root.replaceChildren(); };
  }, [html]);
  return <section aria-label="Google 搜索建议"><p ref={status} role="status" /><div className={styles.geminiSuggestions} ref={host} /></section>;
}

function Answer({ result }: { result: GeminiResearchResult }) {
  const markers = new Map<number, Set<number>>();
  for (const support of result.supports) {
    if (!Number.isInteger(support.endIndex) || support.endIndex < 0 || support.endIndex > result.answer.length) continue;
    const sources = markers.get(support.endIndex) || new Set<number>();
    for (const index of support.sourceIndices) if (result.citations[index] && safeResearchUrl(result.citations[index].url)) sources.add(index);
    markers.set(support.endIndex, sources);
  }
  const ordered = [...markers].sort(([a], [b]) => a - b);
  const parts = ordered.map(([end, sources], markerIndex) => {
    const text = result.answer.slice(markerIndex ? ordered[markerIndex - 1][0] : 0, end);
    return <Fragment key={end}>{text}<sup>{[...sources].map((index) => <a key={index} href={result.citations[index].url} target="_blank" rel="noopener noreferrer" aria-label={`来源 ${index + 1}：${result.citations[index].title}`}>[{index + 1}]</a>)}</sup></Fragment>;
  });
  return <div className={styles.geminiAnswer}>{parts}{result.answer.slice(ordered.at(-1)?.[0] ?? 0)}</div>;
}

export function GeminiResearchPanel() {
  const [query, setQuery] = useState("");
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<GeminiResearchResult | null>(null);
  const request = useRef<AbortController | null>(null);
  const submitting = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    void api<Readiness>("/api/research/gemini", { signal: controller.signal })
      .then(setReadiness).catch(() => { if (!controller.signal.aborted) setError("无法检查研究服务配置，请稍后重新打开页面。"); });
    return () => { controller.abort(); request.current?.abort(); };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current || !readiness?.ready || !query.trim()) return;
    submitting.current = true;
    const controller = new AbortController();
    request.current = controller;
    setPending(true); setError(""); setResult(null);
    try {
      const data = await api<GeminiResearchResult>("/api/research/gemini", {
        method: "POST", body: JSON.stringify({ query: query.trim() }), signal: controller.signal,
      });
      if (!controller.signal.aborted) setResult(data);
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "研究请求未完成。");
    } finally {
      submitting.current = false;
      if (!controller.signal.aborted) setPending(false);
    }
  }

  const token = (value: number | null) => value === null ? "未提供" : value.toLocaleString();
  return <details className={styles.advancedSection} open>
    <summary><span>Google 联网研究</span><small>人工单次研究</small></summary>
    <section className={styles.toolSection} aria-label="Google 联网研究">
      <p className={styles.muted}>提交公开行业问题，查看回答与来源。结果仅在当前页面展示，不保存或导入客户；请勿提交客户隐私。</p>
      <form onSubmit={submit} className={styles.geminiForm}>
        <label className={styles.field}>研究问题<textarea name="gemini-query" value={query} onChange={(event) => setQuery(event.target.value)} maxLength={2000} rows={3} required disabled={pending} placeholder="例如：下一届 MIDO 眼镜展的官方日期和举办地点是什么？" /></label>
        <div className={styles.geminiActions}><button type="submit" className={styles.primaryButton} disabled={!readiness?.ready || pending || !query.trim()}>{pending ? "正在研究…" : "开始单次研究"}</button>{result ? <button type="button" className={styles.secondaryButton} onClick={() => { setResult(null); setQuery(""); }}>清除本次结果</button> : null}</div>
      </form>
      {!readiness ? <p className={styles.muted}>正在检查研究服务配置…</p> : <p className={styles.muted}>{readiness.model}{!readiness.ready ? ` · ${CONFIGURATION_MESSAGES[readiness.reason || ""] || "研究服务尚未就绪"}` : " · 单次请求，不自动重试"}</p>}
      {pending ? <p role="status">正在等待 Google 回答；请勿重复提交。</p> : null}
      {error ? <p role="alert" className={styles.runError}>{error}</p> : null}
      {result ? <article className={styles.geminiResult}>
        <p role="status"><strong>{result.groundingStatus === "verified" ? "搜索依据已验证" : "未验证联网结果"}</strong></p>
        <Answer result={result} />
        <SearchSuggestions html={result.searchSuggestionHtml} />
        <section aria-label="回答来源"><h3>回答来源</h3>{result.citations.length ? <ol className={styles.geminiSources}>{result.citations.map((source, index) => safeResearchUrl(source.url) ? <li key={`${index}-${source.url}`}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title || `来源 ${index + 1}`}</a></li> : null)}</ol> : <p>未提供可验证的来源引用。</p>}</section>
        <details><summary>本次验证信息</summary><dl className={styles.geminiMeta}>
          <div><dt>请求模型</dt><dd>{result.requestedModel}</dd></div><div><dt>返回模型</dt><dd>{result.returnedModel || "未提供"}</dd></div><div><dt>耗时</dt><dd>{(result.durationMs / 1000).toFixed(1)} 秒</dd></div>
          <div><dt>输入 / 输出 Token</dt><dd>{token(result.usage.promptTokens)} / {token(result.usage.outputTokens)}</dd></div><div><dt>思考 / 总 Token</dt><dd>{token(result.usage.thoughtTokens)} / {token(result.usage.totalTokens)}</dd></div>
          <div><dt>搜索查询</dt><dd>{result.searchQueries.join("；") || "未提供"}</dd></div>
        </dl></details>
      </article> : null}
    </section>
  </details>;
}
