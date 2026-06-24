import { invoke } from "@tauri-apps/api/core";

export function importMarkdownFile(sourcePath: string, targetFolder: string): Promise<string> {
  return invoke<string>("import_markdown_file", { sourcePath, targetFolder });
}

export function exportMarkdownFile(relativePath: string, targetPath: string): Promise<void> {
  return invoke("export_markdown_file", { relativePath, targetPath });
}

export function exportWiki(targetDir: string): Promise<number> {
  return invoke<number>("export_wiki", { targetDir });
}

export function backupWiki(targetBaseDir: string): Promise<string> {
  return invoke<string>("backup_wiki", { targetBaseDir });
}
