use std::path::Path;

/// True si la entrada es un symlink o, en Windows, un reparse point
/// (junction, mount point, etc). Estas entradas nunca se siguen.
fn is_link_like(metadata: &std::fs::Metadata) -> bool {
    if metadata.file_type().is_symlink() {
        return true;
    }
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x400;
        if metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0 {
            return true;
        }
    }
    false
}

/// Recorre `dir` de forma recursiva y segura dentro del vault.
///
/// `root` es la raíz original (usada para calcular rutas relativas, igual
/// que antes) y `canonical_root` es esa misma raíz ya canonicalizada una
/// sola vez por el llamador. Por cada entrada:
/// - se ignoran nombres ocultos (empiezan con '.') y los que `skip_dir`
///   marque como excluidos (p. ej. "node_modules");
/// - se ignoran symlinks y reparse points/junctions sin seguirlos ni
///   descender por ellos;
/// - se valida que la ruta canónica de la entrada permanezca dentro de
///   `canonical_root` antes de procesarla o recursar.
///
/// `on_file` recibe la ruta original (no canonicalizada, para no filtrar
/// el prefijo `\\?\` de Windows hacia contratos existentes) y la ruta
/// relativa a `root`. El filtrado por extensión queda a cargo del
/// llamador, igual que antes.
pub fn walk_vault_entries<F>(
    dir: &Path,
    root: &Path,
    canonical_root: &Path,
    skip_dir: &dyn Fn(&str) -> bool,
    on_file: &mut F,
) -> std::io::Result<()>
where
    F: FnMut(&Path, &Path) -> std::io::Result<()>,
{
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') || skip_dir(&name) {
            continue;
        }

        let metadata = match path.symlink_metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };
        if is_link_like(&metadata) {
            continue;
        }

        let canonical = match path.canonicalize() {
            Ok(c) => c,
            Err(_) => continue,
        };
        if !canonical.starts_with(canonical_root) {
            continue;
        }

        if metadata.is_dir() {
            walk_vault_entries(&path, root, canonical_root, skip_dir, on_file)?;
        } else if metadata.is_file() {
            let relative = path.strip_prefix(root).unwrap_or(&path);
            on_file(&path, relative)?;
        }
    }
    Ok(())
}
