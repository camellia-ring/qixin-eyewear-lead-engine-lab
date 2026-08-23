import { useState } from "react";

export function useLeadReviewFilters() {
  const [statusFilter, setStatusFilter] = useState("needs_review");
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

  function clearFilters() {
    setStatusFilter("all");
    setGradeFilter("all");
    setRegionFilter("all");
    setCountryFilter("all");
    setTypeFilters([]);
    setProductFilters([]);
    setContactFilter("all");
    setSourceFilter("all");
    setSpecialFilter("all");
    setSearch("");
    setPage(1);
  }

  return {
    statusFilter, gradeFilter, regionFilter, countryFilter, typeFilters, productFilters, contactFilter,
    sourceFilter, specialFilter, sortBy, page, search, setStatusFilter, setGradeFilter,
    setRegionFilter, setCountryFilter, setTypeFilters, setProductFilters, setContactFilter, setSourceFilter,
    setSpecialFilter, setSortBy, setPage, setSearch, clearFilters,
  };
}
