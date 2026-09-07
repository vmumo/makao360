import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Records that the signed-in user opened a sensitive record.
 * Feeds the admin access audit dashboard.
 */
export function useAccessLog(
  entityTable: string,
  entityId?: string | null,
  action = "view",
  meta: Record<string, unknown> = {},
) {
  useEffect(() => {
    if (!entityId) return;
    void supabase.rpc("log_data_access", {
      _entity_table: entityTable,
      _entity_id: entityId,
      _action: `${entityTable}.${action}`,
      _meta: meta as never,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityTable, entityId, action]);
}
