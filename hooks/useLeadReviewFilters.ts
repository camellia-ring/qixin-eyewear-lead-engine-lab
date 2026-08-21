import { useState } from "react";

export function useLeadReviewFilters() {
  const [statusFilter, setStatusFilter] = useState("needs_review");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [contactFilter, setContactFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [specialFilter, setSpecialFilter] = useState("all");
  const [sortBy, setSortBy] = useState("score_desc");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  function clearFilters() {
    setStatusFilter("all");
    setGradeFilter("all");
    setCountryFilter("all");
    setTypeFilter("all");
    setProductFilter("all");
    setContactFilter("all");
    setSourceFilter("all");
    setSpecialFilter("all");
    setSearch("");
    setPage(1);
  }

  return {
    statusFilter, gradeFilter, countryFilter, typeFilter, productFilter, contactFilter,
    sourceFilter, specialFilter, sortBy, page, search, setStatusFilter, setGradeFilter,
    setCountryFilter, setTypeFilter, setProductFilter, setContactFilter, setSourceFilter,
    setSpecialFilter, setSortBy, setPage, setSearch, clearFilters,
  };
}
