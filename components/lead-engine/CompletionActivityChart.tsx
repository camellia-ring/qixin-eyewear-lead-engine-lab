import { useMemo, useState } from "react";
import { IconCalendarStats, IconChevronDown } from "@tabler/icons-react";
import styles from "../LeadEngineApp.module.css";

type CompletionDay = { date: string; label: string; count: number };

export function CompletionActivityChart({
  days,
  historyLoading,
  onDaysChange,
  onLoadOlder,
  previousBefore,
  rows,
}: {
  days: 30 | 90;
  historyLoading: boolean;
  onDaysChange: (days: 30 | 90) => Promise<void>;
  onLoadOlder: () => Promise<void>;
  previousBefore: string | null;
  rows: CompletionDay[];
}) {
  const [selectedDate, setSelectedDate] = useState("");
  const chartRows = useMemo(() => rows.slice(0, days).reverse(), [days, rows]);
  const total = chartRows.reduce((sum, day) => sum + day.count, 0);
  const peak = Math.max(0, ...chartRows.map((day) => day.count));
  const average = chartRows.length ? Math.round((total / chartRows.length) * 10) / 10 : 0;
  const selectedDay = chartRows.find((day) => day.date === selectedDate) || chartRows.at(-1) || null;

  return <>
    <div className={styles.completionActivityHeader}>
      <div>
        <h2><IconCalendarStats size={20} />完成趋势</h2>
        <p className={styles.muted}>柱高表示每天首次自动合格并保存的客户数；悬停、聚焦或点击可查看精确数量。</p>
      </div>
      <div className={styles.historyWindowTabs} role="group" aria-label="完成趋势时间范围">
        <button type="button" aria-pressed={days === 30} disabled={historyLoading} onClick={() => void onDaysChange(30)}>30天</button>
        <button type="button" aria-pressed={days === 90} disabled={historyLoading} onClick={() => void onDaysChange(90)}>90天</button>
      </div>
    </div>

    <div className={styles.completionActivitySummary} aria-label={`近${days}天完成概览`}>
      <span>近{days}天完成 <b>{total}</b> 家</span>
      <span>日均 <b>{average}</b> 家</span>
      <span>最高单日 <b>{peak}</b> 家</span>
      <strong aria-live="polite">{selectedDay ? `${selectedDay.label} · ${selectedDay.count} 家` : "暂无完成记录"}</strong>
    </div>

    <div className={styles.completionChartViewport} aria-busy={historyLoading}>
      <div className={[styles.completionChart, days === 90 ? styles.completionChartWide : ""].filter(Boolean).join(" ")} role="group" aria-label={`最近${days}天每日完成客户柱状图`}>
        {chartRows.map((day, index) => {
          const barHeight = day.count ? Math.max(8, Math.round((day.count / Math.max(peak, 1)) * 68)) : 3;
          const showDate = index === 0 || index === chartRows.length - 1 || index % 7 === 0;
          return <button
            key={day.date}
            type="button"
            data-selected={selectedDay?.date === day.date}
            data-today={index === chartRows.length - 1}
            aria-label={`${day.date}，完成 ${day.count} 家`}
            title={`${day.date} · 完成 ${day.count} 家`}
            onClick={() => setSelectedDate(day.date)}
            onFocus={() => setSelectedDate(day.date)}
            onMouseEnter={() => setSelectedDate(day.date)}
          >
            <span data-zero={day.count === 0} style={{ height: `${barHeight}px` }} />
            <small>{showDate ? day.date.slice(5).replace("-", "/") : ""}</small>
          </button>;
        })}
      </div>
    </div>

    <details className={styles.completionHistoryDetails}>
      <summary><span>查看每日明细</span><small>已加载 {rows.length} 天</small><IconChevronDown size={17} /></summary>
      <p className={styles.muted}>按上海时区自然日统计；同一公司只在首次自动合格时计数，导入客户不计入。</p>
      <div className={styles.completionHistoryList}>{rows.map((day) => <article key={day.date}><div><b>{day.label}</b><small>{day.date}</small></div><strong>{day.count}</strong><span>家</span></article>)}</div>
      {previousBefore ? <button className={styles.historyMoreButton} type="button" disabled={historyLoading} onClick={() => void onLoadOlder()}><IconChevronDown size={17} />{historyLoading ? "正在读取…" : "查看更早 30 天"}</button> : <p className={styles.historyEnd}>已显示全部可追溯完成记录</p>}
    </details>
  </>;
}
