import { useState } from "react";
import {
  dateInReportingTimeZone,
  shiftReportingAnchor,
  type CompletionPeriodKind,
} from "@/lib/reporting-period";

export type CompletionPeriodFilter = "all" | CompletionPeriodKind;

export function useLeadReviewFilters() {
  const [reviewState, setReviewState] = useState<"unreviewed" | "reviewed">("unreviewed");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [productFilters, setProductFilters] = useState<string[]>([]);
  const [contactFilter, setContactFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [specialFilter, setSpecialFilter] = useState("all");
  const [sortBy, setSortBy] = useState("score_desc");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [completionPeriod, setCompletionPeriod] = useState<CompletionPeriodFilter>("all");
  const [completionAnchor, setCompletionAnchor] = useState(() => dateInReportingTimeZone());

  function selectCompletionPeriod(value: CompletionPeriodFilter) {
    setCompletionPeriod(value);
    setCompletionAnchor(dateInReportingTimeZone());
    setPage(1);
  }

  function shiftCompletionPeriod(direction: -1 | 1) {
    if (completionPeriod === "all") return;
    setCompletionAnchor((current) => shiftReportingAnchor(completionPeriod, current, direction));
    setPage(1);
  }

  function resetCompletionPeriod() {
    setCompletionAnchor(dateInReportingTimeZone());
    setPage(1);
  }

  function clearFilters() {
    setReviewState("unreviewed");
    setGradeFilter("all");
    setRegionFilter("all");
    setCountryFilter("all");
    setTypeFilters([]);
    setProductFilters([]);
    setContactFilter("all");
    setSourceFilter("all");
    setSpecialFilter("all");
    setSearch("");
    setCompletionPeriod("all");
    setCompletionAnchor(dateInReportingTimeZone());
    setPage(1);
  }

  return {
    reviewState, gradeFilter, regionFilter, countryFilter, typeFilters, productFilters, contactFilter,
    sourceFilter, specialFilter, sortBy, page, search, setReviewState, setGradeFilter,
    setRegionFilter, setCountryFilter, setTypeFilters, setProductFilters, setContactFilter, setSourceFilter,
    setSpecialFilter, setSortBy, setPage, setSearch, completionPeriod, completionAnchor,
    selectCompletionPeriod, shiftCompletionPeriod, resetCompletionPeriod, clearFilters,
  };
}
