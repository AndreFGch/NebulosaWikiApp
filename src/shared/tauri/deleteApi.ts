import { invoke } from "@tauri-apps/api/core";

export function deleteMarkdownFile(relativePath: string): Promise<void> {
  return invoke("delete_markdown_file", { relativePath });
}
