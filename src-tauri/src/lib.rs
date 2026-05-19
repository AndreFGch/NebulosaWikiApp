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

#[tauri::command]
fn update_markdown_file(relative_path: String, content: String) -> Result<(), String> {
    if relative_path.contains("..") {
        return Err("Ruta no permitida: intento de escape detectado.".to_string());
    }

    let wiki_root = Path::new(r"D:\NebulosaWiki");
    let normalized = relative_path.replace('/', "\\");
    let candidate = wiki_root.join(&normalized);

    if candidate.extension().map_or(true, |e| e != "md") {
        return Err("Solo se pueden escribir archivos .md.".to_string());
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

    std::fs::write(&canonical, content.as_bytes())
        .map_err(|e| format!("Error al escribir el archivo: {}", e))
}

#[tauri::command]
fn create_markdown_file(relative_path: String, content: String) -> Result<(), String> {
    if relative_path.contains("..") {
        return Err("Ruta no permitida: intento de escape detectado.".to_string());
    }

    let normalized = relative_path.replace('/', "\\");

    if std::path::Path::new(&normalized).is_absolute() {
        return Err("Ruta no permitida: se rechaza ruta absoluta.".to_string());
    }

    let wiki_root = Path::new(r"D:\NebulosaWiki");
    let candidate = wiki_root.join(&normalized);

    if candidate.extension().map_or(true, |e| e != "md") {
        return Err("Solo se pueden crear archivos .md.".to_string());
    }

    const RESERVED: &[&str] = &[
        "CON", "PRN", "AUX", "NUL",
        "COM1","COM2","COM3","COM4","COM5","COM6","COM7","COM8","COM9",
        "LPT1","LPT2","LPT3","LPT4","LPT5","LPT6","LPT7","LPT8","LPT9",
    ];

    for component in std::path::Path::new(&normalized).components() {
        use std::path::Component;
        let name = match component {
            Component::Normal(os) => os.to_string_lossy().into_owned(),
            _ => return Err("Componente de ruta no permitido.".to_string()),
        };
        if name.is_empty() {
            return Err("Componente de ruta vacío no permitido.".to_string());
        }
        if name.chars().any(|c| matches!(c, '<' | '>' | ':' | '"' | '|' | '?' | '*')) {
            return Err(format!("Nombre inválido: carácter no permitido en \"{}\".", name));
        }
        let stem = name.split('.').next().unwrap_or("").to_uppercase();
        if RESERVED.contains(&stem.as_str()) {
            return Err(format!("Nombre reservado de Windows no permitido: {}.", stem));
        }
    }

    let canonical_root = wiki_root
        .canonicalize()
        .map_err(|e| format!("Error al resolver la raíz de la wiki: {}", e))?;

    if let Some(parent) = candidate.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Error al crear carpetas padre: {}", e))?;
        let canonical_parent = parent
            .canonicalize()
            .map_err(|e| format!("Error al verificar carpeta: {}", e))?;
        if !canonical_parent.starts_with(&canonical_root) {
            return Err("Ruta no permitida: fuera de la wiki.".to_string());
        }
    }

    use std::io::Write;
    let mut file = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&candidate)
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::AlreadyExists {
                "El archivo ya existe. Elegí un nombre diferente.".to_string()
            } else {
                format!("Error al crear el archivo: {}", e)
            }
        })?;
    file.write_all(content.as_bytes())
        .map_err(|e| format!("Error al escribir el contenido: {}", e))
}

#[tauri::command]
fn delete_markdown_file(relative_path: String) -> Result<(), String> {
    if relative_path.contains("..") {
        return Err("Ruta no permitida: intento de escape detectado.".to_string());
    }

    let wiki_root = Path::new(r"D:\NebulosaWiki");
    let normalized = relative_path.replace('/', "\\");

    if Path::new(&normalized).is_absolute() {
        return Err("Ruta no permitida: se rechaza ruta absoluta.".to_string());
    }

    let candidate = wiki_root.join(&normalized);

    if candidate.extension().map_or(true, |e| e != "md") {
        return Err("Solo se pueden eliminar archivos .md.".to_string());
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

    if !canonical.is_file() {
        return Err("El archivo no existe o no es un archivo regular.".to_string());
    }

    std::fs::remove_file(&canonical)
        .map_err(|e| format!("Error al eliminar el archivo: {}", e))
}

#[tauri::command]
fn export_markdown_file(relative_path: String, target_path: String) -> Result<(), String> {
    if relative_path.contains("..") {
        return Err("Ruta no permitida: intento de escape detectado.".to_string());
    }

    let normalized = relative_path.replace('/', "\\");
    if Path::new(&normalized).is_absolute() {
        return Err("Ruta no permitida: se rechaza ruta absoluta.".to_string());
    }

    let wiki_root = Path::new(r"D:\NebulosaWiki");
    let source_candidate = wiki_root.join(&normalized);

    if source_candidate.extension().map_or(true, |e| e != "md") {
        return Err("Solo se pueden exportar archivos .md.".to_string());
    }

    let canonical_root = wiki_root
        .canonicalize()
        .map_err(|e| format!("Error al resolver la raíz de la wiki: {}", e))?;

    let canonical_source = source_candidate
        .canonicalize()
        .map_err(|_| format!("Archivo no encontrado: {}", relative_path))?;

    if !canonical_source.starts_with(&canonical_root) {
        return Err("Ruta no permitida: fuera de la wiki.".to_string());
    }

    if !canonical_source.is_file() {
        return Err("El archivo no existe o no es un archivo regular.".to_string());
    }

    let target = Path::new(&target_path);
    if target.extension().map_or(true, |e| !e.eq_ignore_ascii_case("md")) {
        return Err("La ruta destino debe terminar en .md.".to_string());
    }

    if target.exists() {
        return Err(format!("El archivo ya existe en el destino: {}", target_path));
    }

    if let Some(parent) = target.parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Error al crear carpeta destino: {}", e))?;
        }
    }

    std::fs::copy(&canonical_source, target)
        .map_err(|e| format!("Error al exportar el archivo: {}", e))?;

    Ok(())
}

#[tauri::command]
fn import_markdown_file(source_path: String, target_folder: String) -> Result<String, String> {
    const ALLOWED_FOLDERS: &[&str] = &[
        "notes", "projects", "sources", "sessions", "skills", "indexes",
    ];
    if !ALLOWED_FOLDERS.contains(&target_folder.as_str()) {
        return Err(format!("Carpeta no permitida: {}", target_folder));
    }

    let source = Path::new(&source_path);
    if !source.exists() {
        return Err(format!("El archivo no existe: {}", source_path));
    }
    if !source.is_file() {
        return Err("La ruta no corresponde a un archivo.".to_string());
    }
    if source.extension().map_or(true, |e| !e.eq_ignore_ascii_case("md")) {
        return Err("Solo se pueden importar archivos .md.".to_string());
    }

    let file_name = source
        .file_name()
        .ok_or_else(|| "No se pudo obtener el nombre del archivo.".to_string())?
        .to_string_lossy()
        .into_owned();

    if file_name.chars().any(|c| matches!(c, '<' | '>' | ':' | '"' | '|' | '?' | '*')) {
        return Err(format!("Nombre inválido: carácter no permitido en \"{}\".", file_name));
    }

    const RESERVED: &[&str] = &[
        "CON", "PRN", "AUX", "NUL",
        "COM1","COM2","COM3","COM4","COM5","COM6","COM7","COM8","COM9",
        "LPT1","LPT2","LPT3","LPT4","LPT5","LPT6","LPT7","LPT8","LPT9",
    ];
    let stem = Path::new(&file_name)
        .file_stem()
        .unwrap_or_default()
        .to_string_lossy()
        .to_uppercase();
    if RESERVED.contains(&stem.as_str()) {
        return Err(format!("Nombre reservado de Windows no permitido: {}.", stem));
    }

    let wiki_root = Path::new(r"D:\NebulosaWiki");
    let canonical_root = wiki_root
        .canonicalize()
        .map_err(|e| format!("Error al resolver la raíz de la wiki: {}", e))?;

    let dest_dir = wiki_root.join(&target_folder);
    std::fs::create_dir_all(&dest_dir)
        .map_err(|e| format!("Error al crear carpeta destino: {}", e))?;

    let canonical_dir = dest_dir
        .canonicalize()
        .map_err(|e| format!("Error al verificar carpeta: {}", e))?;
    if !canonical_dir.starts_with(&canonical_root) {
        return Err("Ruta no permitida: fuera de la wiki.".to_string());
    }

    let dest = dest_dir.join(&file_name);
    if dest.exists() {
        return Err(format!(
            "El archivo ya existe en la wiki: {}/{}",
            target_folder, file_name
        ));
    }

    std::fs::copy(source, &dest)
        .map_err(|e| format!("Error al copiar el archivo: {}", e))?;

    Ok(format!("{}/{}", target_folder, file_name))
}

fn walk_and_export(
    dir: &Path,
    root: &Path,
    target_root: &Path,
    count: &mut u32,
) -> Result<(), String> {
    for entry in std::fs::read_dir(dir)
        .map_err(|e| format!("Error al leer directorio: {}", e))?
    {
        let entry = entry.map_err(|e| format!("Error al leer entrada: {}", e))?;
        let path = entry.path();
        if path.is_dir() {
            let dir_name = path.file_name().unwrap_or_default().to_string_lossy();
            if dir_name.starts_with('.') || dir_name == "node_modules" {
                continue;
            }
            walk_and_export(&path, root, target_root, count)?;
        } else if path.extension().map_or(false, |e| e.eq_ignore_ascii_case("md")) {
            let relative = path
                .strip_prefix(root)
                .map_err(|_| "Error al calcular ruta relativa.".to_string())?;
            let dest = target_root.join(relative);
            if let Some(parent) = dest.parent() {
                std::fs::create_dir_all(parent)
                    .map_err(|e| format!("Error al crear subcarpeta: {}", e))?;
            }
            if dest.exists() {
                return Err(format!(
                    "El archivo ya existe en el destino: {}",
                    relative.to_string_lossy().replace('\\', "/")
                ));
            }
            std::fs::copy(&path, &dest)
                .map_err(|e| format!("Error al copiar {}: {}", relative.to_string_lossy(), e))?;
            *count += 1;
        }
    }
    Ok(())
}

#[tauri::command]
fn export_wiki(target_dir: String) -> Result<u32, String> {
    let td = target_dir.trim();
    if td.is_empty() {
        return Err("La carpeta destino es requerida.".to_string());
    }

    let wiki_root = Path::new(r"D:\NebulosaWiki");
    if !wiki_root.exists() {
        return Err(format!(
            "La carpeta de la wiki no existe: {}",
            wiki_root.display()
        ));
    }

    let canonical_root = wiki_root
        .canonicalize()
        .map_err(|e| format!("Error al resolver la raíz de la wiki: {}", e))?;

    let target = Path::new(td);
    std::fs::create_dir_all(target)
        .map_err(|e| format!("Error al crear carpeta destino: {}", e))?;

    let canonical_target = target
        .canonicalize()
        .map_err(|e| format!("Error al resolver carpeta destino: {}", e))?;

    if canonical_target == canonical_root {
        return Err("No se puede exportar hacia la misma carpeta raíz de la wiki.".to_string());
    }
    if canonical_target.starts_with(&canonical_root) {
        return Err("No se puede exportar hacia una subcarpeta dentro de la wiki.".to_string());
    }

    let mut count: u32 = 0;
    walk_and_export(&canonical_root, &canonical_root, &canonical_target, &mut count)?;
    Ok(count)
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct SearchResult {
    relative_path: String,
    title: String,
    folder: String,
    snippet: String,
}

fn extract_search_title(content: &str, stem: &str) -> String {
    if content.starts_with("---\n") || content.starts_with("---\r\n") {
        if let Some(close) = content.find("\n---") {
            let fm = &content[4..close];
            for line in fm.lines() {
                let lower = line.to_lowercase();
                if lower.starts_with("titulo:") || lower.starts_with("title:") {
                    if let Some(colon) = line.find(':') {
                        let val = line[colon + 1..].trim().trim_matches(|c| c == '\'' || c == '"');
                        if !val.is_empty() {
                            return val.to_string();
                        }
                    }
                }
            }
        }
    }
    for line in content.lines() {
        let t = line.trim();
        if t.starts_with("# ") {
            return t[2..].trim().to_string();
        }
    }
    stem.to_string()
}

fn extract_snippet(content: &str, query_lower: &str, max_chars: usize) -> String {
    let content_lower = content.to_lowercase();
    if let Some(byte_pos) = content_lower.find(query_lower) {
        let char_pos = content[..byte_pos].chars().count();
        let total = content.chars().count();
        let half = max_chars / 2;
        let start = char_pos.saturating_sub(half);
        let end = (start + max_chars).min(total);
        let snippet: String = content.chars().skip(start).take(end - start).collect();
        let mut s = String::new();
        if start > 0 { s.push('…'); }
        s.push_str(snippet.trim());
        if end < total { s.push('…'); }
        s
    } else {
        content.chars().take(max_chars).collect()
    }
}

fn walk_search(
    dir: &Path,
    root: &Path,
    query_lower: &str,
    results: &mut Vec<SearchResult>,
) -> std::io::Result<()> {
    if results.len() >= 30 { return Ok(()); }
    for entry in std::fs::read_dir(dir)? {
        if results.len() >= 30 { break; }
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            let name = path.file_name().unwrap_or_default().to_string_lossy();
            if name.starts_with('.') || name == "node_modules" { continue; }
            walk_search(&path, root, query_lower, results)?;
        } else if path.extension().map_or(false, |e| e.eq_ignore_ascii_case("md")) {
            let content = match std::fs::read_to_string(&path) {
                Ok(c) => c,
                Err(_) => continue,
            };
            if !content.to_lowercase().contains(query_lower) { continue; }
            let relative = path.strip_prefix(root).unwrap_or(&path);
            let relative_path = relative.to_string_lossy().replace('\\', "/");
            let folder = relative
                .iter()
                .next()
                .map(|c| c.to_string_lossy().into_owned())
                .unwrap_or_default();
            let stem = path.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default();
            let title = extract_search_title(&content, &stem);
            let snippet = extract_snippet(&content, query_lower, 160);
            results.push(SearchResult { relative_path, title, folder, snippet });
        }
    }
    Ok(())
}

#[tauri::command]
fn search_markdown_content(query: String) -> Result<Vec<SearchResult>, String> {
    let q = query.trim();
    if q.len() < 2 {
        return Err("La búsqueda debe tener al menos 2 caracteres.".to_string());
    }
    let query_lower = q.to_lowercase();
    let wiki_root = Path::new(r"D:\NebulosaWiki");
    if !wiki_root.exists() {
        return Err(format!("La carpeta de la wiki no existe: {}", wiki_root.display()));
    }
    let mut results = Vec::new();
    walk_search(wiki_root, wiki_root, &query_lower, &mut results)
        .map_err(|e| format!("Error al buscar: {}", e))?;
    Ok(results)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![list_markdown_files, read_markdown_file, update_markdown_file, create_markdown_file, delete_markdown_file, import_markdown_file, export_markdown_file, export_wiki, search_markdown_content])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
