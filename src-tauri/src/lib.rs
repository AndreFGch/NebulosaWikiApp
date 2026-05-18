use serde::Serialize;
use std::path::Path;

#[derive(Serialize)]
pub struct MarkdownFile {
    pub title: String,
    pub path: String,
    #[serde(rename = "relativePath")]
    pub relative_path: String,
    pub folder: String,
}

fn walk_dir(dir: &Path, root: &Path, results: &mut Vec<MarkdownFile>) -> std::io::Result<()> {
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            walk_dir(&path, root, results)?;
        } else if path.extension().map_or(false, |e| e == "md") {
            let relative = path.strip_prefix(root).unwrap_or(&path);
            let relative_path = relative.to_string_lossy().replace('\\', "/");
            let folder = relative
                .parent()
                .map(|p| p.to_string_lossy().replace('\\', "/"))
                .unwrap_or_default();
            let title = path
                .file_stem()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_default();
            results.push(MarkdownFile {
                title,
                path: path.to_string_lossy().to_string(),
                relative_path,
                folder,
            });
        }
    }
    Ok(())
}

#[tauri::command]
fn list_markdown_files() -> Result<Vec<MarkdownFile>, String> {
    let wiki_root = Path::new(r"D:\NebulosaWiki");
    if !wiki_root.exists() {
        return Err(format!(
            "La carpeta de la wiki no existe: {}",
            wiki_root.display()
        ));
    }
    let mut results = Vec::new();
    walk_dir(wiki_root, wiki_root, &mut results)
        .map_err(|e| format!("Error al leer la wiki: {}", e))?;
    results.sort_by(|a, b| a.relative_path.cmp(&b.relative_path));
    Ok(results)
}

#[tauri::command]
fn read_markdown_file(relative_path: String) -> Result<String, String> {
    if relative_path.contains("..") {
        return Err("Ruta no permitida: intento de escape detectado.".to_string());
    }

    let wiki_root = Path::new(r"D:\NebulosaWiki");
    let normalized = relative_path.replace('/', "\\");
    let candidate = wiki_root.join(&normalized);

    if candidate.extension().map_or(true, |e| e != "md") {
        return Err("Solo se pueden leer archivos .md.".to_string());
    }

    let canonical = candidate
        .canonicalize()
        .map_err(|_| format!("Archivo no encontrado: {}", relative_path))?;

    let canonical_root = wiki_root
        .canonicalize()
        .map_err(|e| format!("Error al resolver la raíz de la wiki: {}", e))?;

    if !canonical.starts_with(&canonical_root) {
        return Err("Ruta no permitida: fuera de la wiki.".to_string());
    }

    std::fs::read_to_string(&canonical)
        .map_err(|e| format!("Error al leer el archivo: {}", e))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![list_markdown_files, read_markdown_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
