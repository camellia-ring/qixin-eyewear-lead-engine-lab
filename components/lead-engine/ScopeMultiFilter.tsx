import styles from "../LeadEngineApp.module.css";

export function ScopeMultiFilter({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  function toggle(value: string) {
    onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  }

  return <details className={styles.scopeMultiFilter}>
    <summary><small>{label}</small><span>{selected.length ? `已选 ${selected.length} 项` : `全部${label}`}</span></summary>
    <div className={styles.scopeMultiPanel}>
      <div className={styles.scopeMultiActions}>
        <button type="button" onClick={() => onChange([...options])}>全选</button>
        <button type="button" onClick={() => onChange([])}>清空</button>
      </div>
      <div className={styles.scopeMultiOptions}>
        {options.map((option) => <label key={option} data-selected={selected.includes(option)}>
          <input type="checkbox" checked={selected.includes(option)} onChange={() => toggle(option)} />
          <span>{option}</span>
        </label>)}
      </div>
    </div>
  </details>;
}
