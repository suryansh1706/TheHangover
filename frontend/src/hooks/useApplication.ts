import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../api";
import { categories } from "../constants";
import { numOrNull, splitList } from "../utils/format";
import type { Analytics } from "../types";
import { useAction } from "./useAction";
import { useAuth } from "./useAuth";
import { useExperiences } from "./useExperiences";
import { useGroups } from "./useGroups";

export function useApplication() {
  const location = useLocation();
  const navigate = useNavigate();
  const setPage = useCallback((page: string) => navigate(page === "discover" ? "/" : `/${page}`), [navigate]);
  const action = useAction();
  const { setError } = action;
  const groupActionsRef = useRef<{ loadGroups: () => Promise<void>; clearGroups: () => void }>({
    loadGroups: async () => {},
    clearGroups: () => {},
  });
  const authGroupActions = useMemo(
    () => ({
      loadGroups: () => groupActionsRef.current.loadGroups(),
      clearGroups: () => groupActionsRef.current.clearGroups(),
    }),
    [],
  );
  const auth = useAuth(authGroupActions, action.act, action.setError, action.setNotice, setPage);
  const groups = useGroups(auth.user, action.act, action.setError, action.setNotice, setPage);
  groupActionsRef.current = { loadGroups: groups.loadGroups, clearGroups: groups.clearGroups };
  const experiences = useExperiences(auth.user, action.act, action.setError, action.setNotice);
  const [feedbackId, setFeedbackId] = useState("");
  const [analytics, setAnalytics] = useState<Analytics | null>(null);

  useEffect(() => {
    if (auth.user && location.pathname === "/analytics")
      api<Analytics>("/api/analytics")
        .then(setAnalytics)
        .catch((reason: unknown) =>
          setError(reason instanceof Error ? reason.message : "Could not load analytics"),
        );
  }, [setError, auth.user, location.pathname]);

  const pageContext = {
    ...action,
    ...auth,
    ...groups,
    ...experiences,
    setPage,
    categories,
    numOrNull,
    splitList,
    feedbackId,
    setFeedbackId,
    analytics,
  };
  return {
    ...action,
    ...auth,
    ...groups,
    ...experiences,
    feedbackId,
    setFeedbackId,
    analytics,
    pageContext,
  };
}
