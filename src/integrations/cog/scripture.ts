import { supabase } from "@/integrations/supabase/client";

export type Translation = "web" | "kjv" | "asv";

export type ScripturePassage = {
  canonical: string;
  book: string;
  chapter: number;
  translation: Translation;
  verses: { verse: number; text: string }[];
};

const cache = new Map<string, ScripturePassage>();
const keyOf = (ref: string, t: Translation) => `${t}|${ref.trim().toLowerCase()}`;

export async function fetchPassage(
  reference: string,
  translation: Translation = "web",
): Promise<ScripturePassage> {
  const k = keyOf(reference, translation);
  const hit = cache.get(k);
  if (hit) return hit;

  const { data, error } = await supabase.functions.invoke<ScripturePassage>("fetch-scripture", {
    body: { reference, translation },
  });
  if (error) throw error;
  if (!data) throw new Error("No passage returned");

  cache.set(k, data);
  return data;
}