/**
 * Canonicalizes city names so "København", "KBH", "Copenhagen", and "CPH"
 * all resolve to the same city key ("copenhagen").
 */
const ALIASES: Record<string, string> = {
  kobenhavn: "copenhagen",
  koebenhavn: "copenhagen",
  kbh: "copenhagen",
  copenhagen: "copenhagen",
  cph: "copenhagen",
  "kbh k": "copenhagen",
  "kbh n": "copenhagen",
  "kbh s": "copenhagen",
  "kbh v": "copenhagen",
  "kbh o": "copenhagen",
  frederiksberg: "copenhagen",
  aarhus: "aarhus",
  arhus: "aarhus",
  "aarhus c": "aarhus",
  "aarhus n": "aarhus",
  "aarhus v": "aarhus",
  odense: "odense",
  "odense c": "odense",
  "odense m": "odense",
  "odense s": "odense",
  aalborg: "aalborg",
  alborg: "aalborg",
  malmo: "malmo",
  malmoe: "malmo",
  goteborg: "gothenburg",
  gothenburg: "gothenburg",
  stockholm: "stockholm",
  sthlm: "stockholm",
  oslo: "oslo",
  berlin: "berlin",
  london: "london",
  ldn: "london",
  "new york": "new york",
  nyc: "new york",
  "new york city": "new york",
  "los angeles": "los angeles",
  la: "los angeles",
};

export function normalizeCityKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replaceAll("ø", "o")
    .replaceAll("ö", "o")
    .replaceAll("æ", "ae")
    .replaceAll("ä", "a")
    .replaceAll("å", "aa")
    .replaceAll("ü", "u")
    .replaceAll("é", "e")
    .replaceAll("è", "e")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (!cleaned) return null;
  return ALIASES[cleaned] ?? cleaned;
}

export function sameCity(a: string | null | undefined, b: string | null | undefined): boolean {
  const ka = normalizeCityKey(a);
  const kb = normalizeCityKey(b);
  return Boolean(ka && kb && ka === kb);
}