import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TagHub {
  id: string;
  name: string;
  tags: string[];
}

/** Loads age-band-scoped local tag hubs when the user has local hubs enabled. */
export function useTagHubs(enabled: boolean): TagHub[] {
  const [hubs, setHubs] = useState<TagHub[]>([]);

  useEffect(() => {
    if (!enabled) {
      setHubs([]);
      return;
    }
    let alive = true;
    void (async () => {
      const { data: hubRows } = await supabase
        .from("tag_hubs")
        .select("id, name")
        .order("name", { ascending: true })
        .limit(30);
      if (!alive || !hubRows || hubRows.length === 0) {
        if (alive) setHubs([]);
        return;
      }
      const ids = hubRows.map((h) => h.id);
      const { data: memberRows } = await supabase
        .from("tag_hub_members")
        .select("hub_id, tag")
        .in("hub_id", ids);
      if (!alive) return;
      const byHub = new Map<string, string[]>();
      for (const m of memberRows ?? []) {
        const list = byHub.get(m.hub_id) ?? [];
        list.push(m.tag);
        byHub.set(m.hub_id, list);
      }
      setHubs(
        hubRows
          .map((h) => ({ id: h.id, name: h.name, tags: byHub.get(h.id) ?? [] }))
          .filter((h) => h.tags.length > 0),
      );
    })();
    return () => {
      alive = false;
    };
  }, [enabled]);

  return hubs;
}