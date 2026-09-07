import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { track } from "@/lib/analytics";

export function useRouteAnalytics() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    void track("page_view", { path });
  }, [path]);
}
