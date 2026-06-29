import { invoke } from "@tauri-apps/api/core";
import type { MarkdownFile } from "../../domain/markdown/types";
import { sortMarkdownFilesByRelativePath } from "../../domain/markdown/relativePathOrder";

export async function listMarkdownFiles(): Promise<MarkdownFile[]> {
  const files = await invoke<MarkdownFile[]>("list_markdown_files");
  return sortMarkdownFilesByRelativePath(files);
}

export function readMarkdownFile(relativePath: string): Promise<string> {
  return invoke<string>("read_markdown_file", { relativePath });
}

export function createMarkdownFile(relativePath: string, content: string): Promise<void> {
  return invoke("create_markdown_file", { relativePath, content });
}

export function updateMarkdownFile(relativePath: string, content: string): Promise<void> {
  return invoke("update_markdown_file", { relativePath, content });
}
