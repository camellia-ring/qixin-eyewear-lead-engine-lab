"use client";

import { useState } from "react";
import {
  CAMPAIGN_CUSTOMER_TYPES,
  CAMPAIGN_PRIORITIES,
  CAMPAIGN_PRODUCT_TRACKS,
  REGION_PRESETS,
  type RegionKey,
} from "@/lib/campaign-strategy";
import styles from "./LeadEngineApp.module.css";

type StrategyCampaign = {
  regionKey?: string;
  productTrack: string;
  productTracksJson?: string;
  targetCountriesJson: string;
  customerTypesJson: string;
  strategyPriority?: number;
};

function jsonList(value?: string, fallback: string[] = []) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : fallback;
  } catch {
    return fallback;
  }
}

export default function CampaignStrategyForm({ campaign }: { campaign?: StrategyCampaign }) {
  const initialRegion = campaign?.regionKey && campaign.regionKey in REGION_PRESETS ? campaign.regionKey as RegionKey : "";
  const initialProducts = jsonList(campaign?.productTracksJson, campaign?.productTrack ? [campaign.productTrack] : []);
  const initialTypes = jsonList(campaign?.customerTypesJson, campaign ? [] : CAMPAIGN_CUSTOMER_TYPES);
  const [regionKey, setRegionKey] = useState<RegionKey | "">(initialRegion);
  const [countries, setCountries] = useState(jsonList(campaign?.targetCountriesJson));
  const [productTracks, setProductTracks] = useState(initialProducts);
  const [customerTypes, setCustomerTypes] = useState(initialTypes);
  const preset = regionKey ? REGION_PRESETS[regionKey] : null;

  function chooseRegion(next: RegionKey | "") {
    setRegionKey(next);
    setCountries(next ? [...REGION_PRESETS[next].countries] : []);
  }

  function toggle(value: string, selected: string[], setSelected: (values: string[]) => void) {
    setSelected(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  }

  return (
    <div className={styles.strategyFields}>
      <label className={styles.field}>目标地区
        <select name="regionKey" required value={regionKey} onChange={(event) => chooseRegion(event.target.value as RegionKey | "")}>
          <option value="">请选择地区</option>
          {Object.entries(REGION_PRESETS).filter(([key]) => key !== "custom").map(([key, region]) => (
            <option key={key} value={key}>{region.label}</option>
          ))}
          <option value="custom">自定义地区</option>
        </select>
      </label>

      <label className={styles.field}>开发优先级
        <select name="strategyPriority" defaultValue={String(campaign?.strategyPriority || 50)}>
          {CAMPAIGN_PRIORITIES.map((priority) => <option key={priority.value} value={priority.value}>{priority.label}</option>)}
        </select>
      </label>

      <fieldset className={styles.strategyChoiceGroup}>
        <legend>产品赛道 <small>可多选</small></legend>
        <div className={styles.strategyChips}>
          {CAMPAIGN_PRODUCT_TRACKS.map((product) => (
            <label key={product.value} data-selected={productTracks.includes(product.value)}>
              <input
                type="checkbox"
                name="productTracks"
                value={product.value}
                checked={productTracks.includes(product.value)}
                required={!productTracks.length}
                onChange={() => toggle(product.value, productTracks, setProductTracks)}
              />
              {product.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.strategyChoiceGroup}>
        <legend>客户类型 <small>可多选，客户可同时拥有多个标签</small></legend>
        <div className={styles.strategyChips}>
          {CAMPAIGN_CUSTOMER_TYPES.map((type) => (
            <label key={type} data-selected={customerTypes.includes(type)}>
              <input type="checkbox" name="customerTypes" value={type} checked={customerTypes.includes(type)} onChange={() => toggle(type, customerTypes, setCustomerTypes)} />
              {type}
            </label>
          ))}
        </div>
      </fieldset>

      <details className={styles.countryPicker} open={Boolean(regionKey && regionKey !== "global")}>
        <summary>
          国家范围
          <span>{regionKey === "global" ? "全球，不限国家" : countries.length ? `已选 ${countries.length} 个` : "尚未选择"}</span>
        </summary>
        {preset?.countries.length ? (
          <>
            <div className={styles.countryPickerActions}>
              <button type="button" onClick={() => setCountries([...preset.countries])}>全选</button>
              <button type="button" onClick={() => setCountries([])}>清空</button>
            </div>
            <div className={styles.countryGrid}>
              {preset.countries.map((country) => (
                <label key={country} data-selected={countries.includes(country)}>
                  <input type="checkbox" name="targetCountries" value={country} checked={countries.includes(country)} onChange={() => toggle(country, countries, setCountries)} />
                  {country}
                </label>
              ))}
            </div>
          </>
        ) : regionKey === "custom" ? (
          <label className={styles.field}>国家（用分号分隔）
            <input name="targetCountries" defaultValue={countries.join("; ")} placeholder="United Arab Emirates; Saudi Arabia" />
          </label>
        ) : <p>{regionKey === "global" ? "全球策略会按所有可用公开来源运行。" : "先选择一个地区。"}</p>}
      </details>
    </div>
  );
}
