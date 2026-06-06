export interface MarkdownFile {
  title: string;
  path: string;
  relativePath: string;
  folder: string;
}

export type DetailMode = "preview" | "raw" | "edit";
export type MainView = "home" | "graph";
export type NoteTemplate = "simple" | "project" | "source" | "skill" | "session" | "index";
export type ToastKind = "success" | "error" | "info";

export interface ToastMessage {
  id: number;
  kind: ToastKind;
  message: string;
}

export interface ContentSearchResult {
  relativePath: string;
  title: string;
  folder: string;
  snippet: string;
}
