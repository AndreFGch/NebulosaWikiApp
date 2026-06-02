use serde::{Serialize, Deserialize};
use std::path::Path;

#[derive(Serialize, Deserialize)]
struct WikiConfig {
    wiki_root: String,
}

fn portable_data_dir() -> Result<std::path::PathBuf, String> {
    #[cfg(debug_assertions)]
    let base = {
        let manifest_dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        manifest_dir
            .parent()
            .ok_or_else(|| "No se pudo obtener la raíz del proyecto.".to_string())?
            .to_path_buf()
    };
    #[cfg(not(debug_assertions))]
    let base = {
        let exe = std::env::current_exe()
            .map_err(|e| format!("Error al obtener ruta del ejecutable: {}", e))?;
        exe.parent()
            .ok_or_else(|| "No se pudo obtener la carpeta del ejecutable.".to_string())?
            .to_path_buf()
    };
    let data = base.join("data");
    std::fs::create_dir_all(&data)
        .map_err(|e| format!("Error al crear data/: {}", e))?;
    Ok(data)
}

fn config_file_path(_app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = portable_data_dir()?;
    Ok(dir.join("settings.json"))
}

fn get_configured_wiki_root(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let config_path = config_file_path(app)?;
    let default_wiki = || -> std::path::PathBuf {
        portable_data_dir()
            .map(|d| d.join("wiki"))
            .unwrap_or_else(|_| std::path::PathBuf::from("data/wiki"))
    };
    if !config_path.exists() {
        let wiki = default_wiki();
        std::fs::create_dir_all(&wiki)
            .map_err(|e| format!("Error al crear wiki/: {}", e))?;
        return Ok(wiki);
    }
    let text = std::fs::read_to_string(&config_path)
        .map_err(|e| format!("Error al leer configuración: {}", e))?;
    let fallback = default_wiki().to_string_lossy().to_string();
    let cfg: WikiConfig = serde_json::from_str(&text)
        .unwrap_or(WikiConfig { wiki_root: fallback });
    Ok(std::path::PathBuf::from(cfg.wiki_root))
}

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
            let dir_name = path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
            if dir_name.starts_with('.') {
                continue;
            }
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

fn validate_within_wiki_root(
    root: &Path,
    candidate: &Path,
) -> Result<std::path::PathBuf, String> {
    let canonical_root = root
        .canonicalize()
        .map_err(|e| format!("Error al resolver la raíz de la wiki: {}", e))?;

    if candidate.exists() {
        let canonical = candidate
            .canonicalize()
            .map_err(|e| format!("Error al resolver la ruta candidata: {}", e))?;
        if !canonical.starts_with(&canonical_root) {
            return Err("Ruta no permitida: fuera de la wiki.".to_string());
        }
        Ok(canonical)
    } else {
        let parent = candidate
            .parent()
            .filter(|p| !p.as_os_str().is_empty())
            .ok_or_else(|| "Ruta no permitida: sin directorio padre válido.".to_string())?;
        let canonical_parent = parent
            .canonicalize()
            .map_err(|e| format!("Error al verificar carpeta padre: {}", e))?;
        if !canonical_parent.starts_with(&canonical_root) {
            return Err("Ruta no permitida: fuera de la wiki.".to_string());
        }
        Ok(candidate.to_path_buf())
    }
}

#[tauri::command]
fn list_markdown_files(app_handle: tauri::AppHandle) -> Result<Vec<MarkdownFile>, String> {
    let wiki_root_buf = get_configured_wiki_root(&app_handle)?;
    let wiki_root = wiki_root_buf.as_path();
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
fn read_markdown_file(app_handle: tauri::AppHandle, relative_path: String) -> Result<String, String> {
    if relative_path.contains("..") {
        return Err("Ruta no permitida: intento de escape detectado.".to_string());
    }

    let wiki_root_buf = get_configured_wiki_root(&app_handle)?;
    let wiki_root = wiki_root_buf.as_path();
    let normalized = relative_path.replace('/', "\\");
    let candidate = wiki_root.join(&normalized);

    if candidate.extension().map_or(true, |e| e != "md") {
        return Err("Solo se pueden leer archivos .md.".to_string());
    }

    if !candidate.exists() {
        return Err(format!("Archivo no encontrado: {}", relative_path));
    }
    let canonical = validate_within_wiki_root(wiki_root, &candidate)?;

    std::fs::read_to_string(&canonical)
        .map_err(|e| format!("Error al leer el archivo: {}", e))
}

#[tauri::command]
fn update_markdown_file(app_handle: tauri::AppHandle, relative_path: String, content: String) -> Result<(), String> {
    if relative_path.contains("..") {
        return Err("Ruta no permitida: intento de escape detectado.".to_string());
    }

    let wiki_root_buf = get_configured_wiki_root(&app_handle)?;
    let wiki_root = wiki_root_buf.as_path();
    let normalized = relative_path.replace('/', "\\");
    let candidate = wiki_root.join(&normalized);

    if candidate.extension().map_or(true, |e| e != "md") {
        return Err("Solo se pueden escribir archivos .md.".to_string());
    }

    if !candidate.exists() {
        return Err(format!("Archivo no encontrado: {}", relative_path));
    }
    let canonical = validate_within_wiki_root(wiki_root, &candidate)?;

    std::fs::write(&canonical, content.as_bytes())
        .map_err(|e| format!("Error al escribir el archivo: {}", e))
}

#[tauri::command]
fn create_markdown_file(app_handle: tauri::AppHandle, relative_path: String, content: String) -> Result<(), String> {
    if relative_path.contains("..") {
        return Err("Ruta no permitida: intento de escape detectado.".to_string());
    }

    let normalized = relative_path.replace('/', "\\");

    if std::path::Path::new(&normalized).is_absolute() {
        return Err("Ruta no permitida: se rechaza ruta absoluta.".to_string());
    }

    let wiki_root_buf = get_configured_wiki_root(&app_handle)?;
    let wiki_root = wiki_root_buf.as_path();
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
fn delete_markdown_file(app_handle: tauri::AppHandle, relative_path: String) -> Result<(), String> {
    if relative_path.contains("..") {
        return Err("Ruta no permitida: intento de escape detectado.".to_string());
    }

    let wiki_root_buf = get_configured_wiki_root(&app_handle)?;
    let wiki_root = wiki_root_buf.as_path();
    let normalized = relative_path.replace('/', "\\");

    if Path::new(&normalized).is_absolute() {
        return Err("Ruta no permitida: se rechaza ruta absoluta.".to_string());
    }

    let candidate = wiki_root.join(&normalized);

    if candidate.extension().map_or(true, |e| e != "md") {
        return Err("Solo se pueden eliminar archivos .md.".to_string());
    }

    if !candidate.exists() {
        return Err(format!("Archivo no encontrado: {}", relative_path));
    }
    let canonical = validate_within_wiki_root(wiki_root, &candidate)?;

    if !canonical.is_file() {
        return Err("El archivo no existe o no es un archivo regular.".to_string());
    }

    std::fs::remove_file(&canonical)
        .map_err(|e| format!("Error al eliminar el archivo: {}", e))
}

#[tauri::command]
fn export_markdown_file(app_handle: tauri::AppHandle, relative_path: String, target_path: String) -> Result<(), String> {
    if relative_path.contains("..") {
        return Err("Ruta no permitida: intento de escape detectado.".to_string());
    }

    let normalized = relative_path.replace('/', "\\");
    if Path::new(&normalized).is_absolute() {
        return Err("Ruta no permitida: se rechaza ruta absoluta.".to_string());
    }

    let wiki_root_buf = get_configured_wiki_root(&app_handle)?;
    let wiki_root = wiki_root_buf.as_path();
    let source_candidate = wiki_root.join(&normalized);

    if source_candidate.extension().map_or(true, |e| e != "md") {
        return Err("Solo se pueden exportar archivos .md.".to_string());
    }

    if !source_candidate.exists() {
        return Err(format!("Archivo no encontrado: {}", relative_path));
    }
    let canonical_source = validate_within_wiki_root(wiki_root, &source_candidate)?;

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
fn import_markdown_file(app_handle: tauri::AppHandle, source_path: String, target_folder: String) -> Result<String, String> {
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

    let wiki_root_buf = get_configured_wiki_root(&app_handle)?;
    let wiki_root = wiki_root_buf.as_path();
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
fn export_wiki(app_handle: tauri::AppHandle, target_dir: String) -> Result<u32, String> {
    let td = target_dir.trim();
    if td.is_empty() {
        return Err("La carpeta destino es requerida.".to_string());
    }

    let wiki_root_buf = get_configured_wiki_root(&app_handle)?;
    let wiki_root = wiki_root_buf.as_path();
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

fn backup_timestamp() -> String {
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let secs_today = secs % 86400;
    let hh = secs_today / 3600;
    let mm = (secs_today % 3600) / 60;
    let ss = secs_today % 60;
    let mut days = (secs / 86400) as u32;
    let mut year = 1970u32;
    loop {
        let dy = if year % 4 == 0 && (year % 100 != 0 || year % 400 == 0) { 366 } else { 365 };
        if days < dy { break; }
        days -= dy;
        year += 1;
    }
    let leap = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
    let month_days: [u32; 12] = [31, if leap { 29 } else { 28 }, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let mut month = 1u32;
    for &d in &month_days {
        if days < d { break; }
        days -= d;
        month += 1;
    }
    let day = days + 1;
    format!("{:04}-{:02}-{:02}-{:02}{:02}{:02}", year, month, day, hh, mm, ss)
}

#[tauri::command]
fn backup_wiki(app_handle: tauri::AppHandle, target_base_dir: String) -> Result<String, String> {
    let tbd = target_base_dir.trim();
    if tbd.is_empty() {
        return Err("La carpeta base es requerida.".to_string());
    }

    let wiki_root_buf = get_configured_wiki_root(&app_handle)?;
    let wiki_root = wiki_root_buf.as_path();
    if !wiki_root.exists() {
        return Err(format!("La carpeta de la wiki no existe: {}", wiki_root.display()));
    }

    let canonical_root = wiki_root
        .canonicalize()
        .map_err(|e| format!("Error al resolver la raíz de la wiki: {}", e))?;

    let base = Path::new(tbd);
    if !base.exists() {
        return Err(format!("La carpeta base no existe: {}", tbd));
    }
    if !base.is_dir() {
        return Err("La carpeta base debe ser un directorio.".to_string());
    }

    let canonical_base = base
        .canonicalize()
        .map_err(|e| format!("Error al resolver carpeta base: {}", e))?;

    if canonical_base == canonical_root {
        return Err("No se puede hacer backup en la misma carpeta de la wiki.".to_string());
    }
    if canonical_base.starts_with(&canonical_root) {
        return Err("No se puede hacer backup dentro de la wiki.".to_string());
    }

    let folder_name = format!("NebulosaWiki-backup-{}", backup_timestamp());
    let backup_dir = canonical_base.join(&folder_name);

    if backup_dir.exists() {
        return Err(format!("La carpeta de backup ya existe: {}", backup_dir.display()));
    }

    std::fs::create_dir_all(&backup_dir)
        .map_err(|e| format!("Error al crear carpeta de backup: {}", e))?;

    let mut count: u32 = 0;
    walk_and_export(&canonical_root, &canonical_root, &backup_dir, &mut count)?;

    Ok(backup_dir.to_string_lossy().to_string())
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

fn normalize_search_text(input: &str) -> String {
    input
        .chars()
        .map(|c| match c {
            'á' | 'à' | 'ä' | 'â' | 'Á' | 'À' | 'Ä' | 'Â' => 'a',
            'é' | 'è' | 'ë' | 'ê' | 'É' | 'È' | 'Ë' | 'Ê' => 'e',
            'í' | 'ì' | 'ï' | 'î' | 'Í' | 'Ì' | 'Ï' | 'Î' => 'i',
            'ó' | 'ò' | 'ö' | 'ô' | 'Ó' | 'Ò' | 'Ö' | 'Ô' => 'o',
            'ú' | 'ù' | 'ü' | 'û' | 'Ú' | 'Ù' | 'Ü' | 'Û' => 'u',
            'ñ' | 'Ñ' => 'n',
            'ç' | 'Ç' => 'c',
            other => other,
        })
        .collect::<String>()
        .to_lowercase()
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
    query_norm: &str,
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
            walk_search(&path, root, query_lower, query_norm, results)?;
        } else if path.extension().map_or(false, |e| e.eq_ignore_ascii_case("md")) {
            let content = match std::fs::read_to_string(&path) {
                Ok(c) => c,
                Err(_) => continue,
            };
            if !normalize_search_text(&content).contains(query_norm) { continue; }
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
fn search_markdown_content(app_handle: tauri::AppHandle, query: String) -> Result<Vec<SearchResult>, String> {
    let q = query.trim();
    if q.len() < 2 {
        return Err("La búsqueda debe tener al menos 2 caracteres.".to_string());
    }
    let query_lower = q.to_lowercase();
    let query_norm = normalize_search_text(q);
    let wiki_root_buf = get_configured_wiki_root(&app_handle)?;
    let wiki_root = wiki_root_buf.as_path();
    if !wiki_root.exists() {
        return Err(format!("La carpeta de la wiki no existe: {}", wiki_root.display()));
    }
    let mut results = Vec::new();
    walk_search(wiki_root, wiki_root, &query_lower, &query_norm, &mut results)
        .map_err(|e| format!("Error al buscar: {}", e))?;
    Ok(results)
}

#[tauri::command]
fn get_wiki_root(app_handle: tauri::AppHandle) -> Result<String, String> {
    let root = get_configured_wiki_root(&app_handle)?;
    Ok(root.to_string_lossy().into_owned())
}

#[tauri::command]
fn set_wiki_root(app_handle: tauri::AppHandle, path: String) -> Result<String, String> {
    let p = path.trim();
    if p.is_empty() {
        return Err("La ruta no puede estar vacía.".to_string());
    }
    let candidate = std::path::Path::new(p);
    if !candidate.exists() {
        return Err(format!("La carpeta no existe: {}", p));
    }
    if !candidate.is_dir() {
        return Err("La ruta debe ser una carpeta.".to_string());
    }
    let canonical = candidate
        .canonicalize()
        .map_err(|e| format!("Error al resolver la ruta: {}", e))?;

    let config_path = config_file_path(&app_handle)?;
    let cfg = WikiConfig { wiki_root: canonical.to_string_lossy().into_owned() };
    let text = serde_json::to_string_pretty(&cfg)
        .map_err(|e| format!("Error al serializar configuración: {}", e))?;
    std::fs::write(&config_path, text.as_bytes())
        .map_err(|e| format!("Error al guardar configuración: {}", e))?;

    Ok(canonical.to_string_lossy().into_owned())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let data_dir = portable_data_dir()
                .expect("No se pudo determinar el directorio portable de datos");
            let webview_dir = data_dir.join("webview");
            std::fs::create_dir_all(&webview_dir)
                .expect("No se pudo crear el directorio de datos de WebView");
            tauri::WebviewWindowBuilder::new(
                app.handle(),
                "main",
                tauri::WebviewUrl::App("index.html".into()),
            )
            .title("Nebulosa Wiki")
            .inner_size(800.0, 600.0)
            .data_directory(webview_dir)
            .build()
            .expect("No se pudo crear la ventana principal");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_markdown_files,
            read_markdown_file,
            update_markdown_file,
            create_markdown_file,
            delete_markdown_file,
            import_markdown_file,
            export_markdown_file,
            export_wiki,
            backup_wiki,
            search_markdown_content,
            get_wiki_root,
            set_wiki_root
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    struct TempDir(std::path::PathBuf);
    impl TempDir {
        fn new(suffix: &str) -> Self {
            let p = std::env::temp_dir().join(format!("nebulosa_test_{}", suffix));
            let _ = std::fs::remove_dir_all(&p);
            std::fs::create_dir_all(&p).unwrap();
            Self(p)
        }
        fn path(&self) -> &std::path::Path {
            &self.0
        }
    }
    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn normalize_search_text_removes_accents() {
        assert_eq!(normalize_search_text("árbol"), "arbol");
        assert_eq!(normalize_search_text("búsqueda"), "busqueda");
        assert_eq!(normalize_search_text("André"), "andre");
        assert_eq!(normalize_search_text("acción"), "accion");
        assert_eq!(normalize_search_text("comunicación"), "comunicacion");
        assert_eq!(normalize_search_text("niño"), "nino");
    }

    #[test]
    fn content_search_matches_without_accents() {
        let normalized =
            normalize_search_text("Vestibulum búsqueda árbol comunicación acción André.");
        assert!(normalized.contains("busqueda"));
        assert!(normalized.contains("arbol"));
        assert!(normalized.contains("comunicacion"));
        assert!(normalized.contains("accion"));
        assert!(normalized.contains("andre"));
    }

    #[test]
    fn walk_dir_ignores_hidden_folders() {
        let td = TempDir::new("walk_hidden");
        let root = td.path();
        std::fs::create_dir_all(root.join("notes")).unwrap();
        std::fs::write(root.join("notes").join("test.md"), "# Test").unwrap();
        std::fs::create_dir_all(root.join(".nebulosa")).unwrap();
        std::fs::write(root.join(".nebulosa").join("hidden.md"), "hidden").unwrap();

        let mut results = Vec::new();
        walk_dir(root, root, &mut results).unwrap();

        let paths: Vec<&str> = results.iter().map(|f| f.relative_path.as_str()).collect();
        assert!(paths.contains(&"notes/test.md"), "notes/test.md debe aparecer");
        assert!(!paths.iter().any(|p| p.contains(".nebulosa")), ".nebulosa no debe aparecer");
    }

    #[test]
    fn walk_and_export_ignores_hidden() {
        let src = TempDir::new("export_src");
        let dst = TempDir::new("export_dst");
        std::fs::create_dir_all(src.path().join("notes")).unwrap();
        std::fs::write(src.path().join("notes").join("visible.md"), "visible").unwrap();
        std::fs::create_dir_all(src.path().join(".nebulosa")).unwrap();
        std::fs::write(src.path().join(".nebulosa").join("hidden.md"), "hidden").unwrap();

        let mut count = 0u32;
        walk_and_export(src.path(), src.path(), dst.path(), &mut count).unwrap();

        assert_eq!(count, 1, "solo un archivo visible debe exportarse");
        assert!(dst.path().join("notes").join("visible.md").exists());
        assert!(!dst.path().join(".nebulosa").exists());
    }

    #[test]
    fn path_traversal_check_detects_dotdot() {
        let allow = |p: &str| !p.contains("..");
        assert!(!allow("../evil.md"), "../evil.md debe rechazarse");
        assert!(!allow("notes/../../../etc/passwd"), "escape profundo debe rechazarse");
        assert!(allow("notes/test.md"), "ruta válida debe permitirse");
        assert!(allow("subfolder/deep/file.md"), "ruta anidada válida debe permitirse");
    }

    #[test]
    fn absolute_path_check_detects_absolute() {
        #[cfg(windows)]
        {
            assert!(std::path::Path::new("C:\\evil.md").is_absolute(), "ruta absoluta Windows debe detectarse");
        }
        assert!(!std::path::Path::new("notes\\test.md").is_absolute(), "ruta relativa debe pasar");
        assert!(!std::path::Path::new("relative.md").is_absolute(), "archivo relativo debe pasar");
    }

    #[test]
    fn search_title_extracts_h1() {
        let c = "# Mi Nota\n\nContenido de la nota";
        assert_eq!(extract_search_title(c, "fallback"), "Mi Nota");
    }

    #[test]
    fn search_title_extracts_frontmatter() {
        let c = "---\ntitulo: Título FM\n---\n\nContenido";
        assert_eq!(extract_search_title(c, "fallback"), "Título FM");
    }

    #[test]
    fn search_title_falls_back_to_stem() {
        let c = "contenido sin encabezado ni frontmatter";
        assert_eq!(extract_search_title(c, "mi-stem"), "mi-stem");
    }

    #[test]
    fn snippet_centers_on_query() {
        let c = "inicio del texto buscar_esto final del texto";
        let s = extract_snippet(c, "buscar_esto", 40);
        assert!(s.contains("buscar_esto"), "snippet debe contener el término buscado");
    }

    #[test]
    fn validate_within_root_allows_existing_file() {
        let td = TempDir::new("vwwr_existing");
        let root = td.path();
        std::fs::create_dir_all(root.join("notes")).unwrap();
        let file = root.join("notes").join("nota.md");
        std::fs::write(&file, "contenido").unwrap();

        let result = validate_within_wiki_root(root, &file);
        assert!(result.is_ok(), "archivo dentro del root debe permitirse");
    }

    #[test]
    fn validate_within_root_allows_new_file_via_parent() {
        let td = TempDir::new("vwwr_new_file");
        let root = td.path();
        std::fs::create_dir_all(root.join("notes")).unwrap();
        let new_file = root.join("notes").join("nueva-nota.md");

        let result = validate_within_wiki_root(root, &new_file);
        assert!(result.is_ok(), "archivo nuevo con parent válido debe permitirse");
    }

    #[test]
    fn validate_within_root_rejects_path_outside_root() {
        let td = TempDir::new("vwwr_outside");
        let root = td.path().join("wiki");
        std::fs::create_dir_all(&root).unwrap();
        let outside = td.path().join("other.md");
        std::fs::write(&outside, "evil").unwrap();

        let result = validate_within_wiki_root(&root, &outside);
        assert!(result.is_err(), "archivo fuera del root debe rechazarse");
        assert!(result.unwrap_err().contains("fuera de la wiki"));
    }
}
