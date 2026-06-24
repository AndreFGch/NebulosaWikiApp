import { invoke } from "@tauri-apps/api/core";

export function getWikiRoot(): Promise<string> {
  return invoke<string>("get_wiki_root");
}

export function setWikiRoot(path: string): Promise<string> {
  return invoke<string>("set_wiki_root", { path });
}
