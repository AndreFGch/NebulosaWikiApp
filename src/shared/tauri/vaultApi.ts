import { invoke } from "@tauri-apps/api/core";
import type { MarkdownFile } from "../../domain/markdown/types";

export function listMarkdownFiles(): Promise<MarkdownFile[]> {
  return invoke<MarkdownFile[]>("list_markdown_files");
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
