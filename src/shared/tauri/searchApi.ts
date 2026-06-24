import { invoke } from "@tauri-apps/api/core";

export interface ContentSearchResult {
  relativePath: string;
  title: string;
  folder: string;
  snippet: string;
}

export function searchMarkdownContent(query: string): Promise<ContentSearchResult[]> {
  return invoke<ContentSearchResult[]>("search_markdown_content", { query });
}
