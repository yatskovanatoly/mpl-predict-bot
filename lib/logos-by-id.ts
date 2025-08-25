const BASE_PATH = "/mpl-teams-logos"
const getPath = (team: string) => `${BASE_PATH}/${team}.png`

export const logosMap: Record<string, string> = {
  "5296": getPath("shit"),
  "18308": getPath("flirt"),
  "14120": getPath("td"),
  "2178": getPath("raketa"),
  "7118": getPath("petruch"),
  "40283": getPath("baldyozh"),
  "35749": getPath("bedros"),
  "2182": getPath("kid"),
  "9021": getPath("drugi"),
  "9018": getPath("chns"),
  "40343": getPath("sd"),
  "29818": getPath("kleschi"),
  "5326": getPath("vp"),
}
