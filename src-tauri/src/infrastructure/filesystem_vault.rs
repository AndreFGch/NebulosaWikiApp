use std::fs::OpenOptions;
use std::io::Write;
use std::path::{Path, PathBuf};

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

/// Construye una ruta temporal única y oculta en el mismo directorio que
/// `destination`, a partir de su nombre de archivo.
fn build_temp_path(destination: &Path) -> std::io::Result<PathBuf> {
    let parent = destination.parent().ok_or_else(|| {
        std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "La ruta destino no tiene directorio padre.",
        )
    })?;
    let file_name = destination
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| {
            std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "La ruta destino no tiene nombre de archivo válido.",
            )
        })?;
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let pid = std::process::id();
    Ok(parent.join(format!(".{}.{}.{}.tmp", file_name, pid, nanos)))
}

/// Escribe `content` en `destination` de forma atómica: el contenido se
/// escribe primero en un archivo temporal oculto dentro del mismo
/// directorio padre, se sincroniza a disco y recién entonces sustituye al
/// destino mediante `rename`. El destino nunca se borra antes de tener el
/// reemplazo listo: si falla la escritura o el rename, el archivo destino
/// (si existía) queda intacto y únicamente se limpia el temporal.
pub fn write_markdown_atomic(destination: &Path, content: &[u8]) -> std::io::Result<()> {
    let temp_path = build_temp_path(destination)?;

    let mut temp_file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temp_path)?;

    let write_result = temp_file
        .write_all(content)
        .and_then(|_| temp_file.sync_all());
    drop(temp_file);

    if let Err(e) = write_result {
        let _ = std::fs::remove_file(&temp_path);
        return Err(e);
    }

    if let Err(e) = std::fs::rename(&temp_path, destination) {
        let _ = std::fs::remove_file(&temp_path);
        return Err(e);
    }

    Ok(())
}

/// Crea `destination` de forma exclusiva: falla si ya existe (no lo toca
/// ni lo sobrescribe). Escribe `content`, sincroniza a disco y cierra el
/// archivo. Si la escritura o el `sync_all` fallan, elimina únicamente el
/// archivo que esta misma llamada acaba de crear.
pub fn create_markdown_exclusive(destination: &Path, content: &[u8]) -> std::io::Result<()> {
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(destination)?;

    let write_result = file.write_all(content).and_then(|_| file.sync_all());
    drop(file);

    if let Err(e) = write_result {
        let _ = std::fs::remove_file(destination);
        return Err(e);
    }

    Ok(())
}

#[cfg(test)]
mod atomic_write_tests {
    use super::{create_markdown_exclusive, write_markdown_atomic};

    struct TempDir(std::path::PathBuf);
    impl TempDir {
        fn new(suffix: &str) -> Self {
            let p = std::env::temp_dir().join(format!("nebulosa_atomic_test_{}", suffix));
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

    fn no_leftover_temp_files(dir: &std::path::Path) -> bool {
        std::fs::read_dir(dir)
            .unwrap()
            .filter_map(|e| e.ok())
            .all(|e| !e.file_name().to_string_lossy().ends_with(".tmp"))
    }

    #[test]
    fn creates_new_note_with_exact_content() {
        let td = TempDir::new("create");
        let target = td.path().join("nota.md");

        write_markdown_atomic(&target, b"# Nota nueva").unwrap();

        assert_eq!(std::fs::read_to_string(&target).unwrap(), "# Nota nueva");
        assert!(no_leftover_temp_files(td.path()));
    }

    #[test]
    fn replaces_existing_note_content() {
        let td = TempDir::new("replace");
        let target = td.path().join("nota.md");
        std::fs::write(&target, "contenido viejo").unwrap();

        write_markdown_atomic(&target, b"contenido nuevo").unwrap();

        assert_eq!(std::fs::read_to_string(&target).unwrap(), "contenido nuevo");
        assert!(no_leftover_temp_files(td.path()));
    }

    #[test]
    fn cleans_up_temp_file_when_rename_fails_against_directory_target() {
        let td = TempDir::new("rename_fail");
        let target = td.path().join("nota_dir");
        std::fs::create_dir_all(&target).unwrap();

        let result = write_markdown_atomic(&target, b"contenido");

        assert!(result.is_err());
        assert!(
            target.is_dir(),
            "el destino original debe permanecer intacto"
        );
        assert!(no_leftover_temp_files(td.path()));
    }

    #[test]
    fn preserves_existing_destination_until_replacement_succeeds() {
        let td = TempDir::new("preserve");
        let target = td.path().join("nota.md");
        std::fs::write(&target, "original intacto").unwrap();

        write_markdown_atomic(&target, b"reemplazo").unwrap();

        assert_eq!(std::fs::read_to_string(&target).unwrap(), "reemplazo");
    }

    #[test]
    fn exclusive_create_succeeds_on_new_path() {
        let td = TempDir::new("exclusive_new");
        let target = td.path().join("nota.md");

        create_markdown_exclusive(&target, b"# Nota nueva").unwrap();

        assert_eq!(std::fs::read_to_string(&target).unwrap(), "# Nota nueva");
        assert!(no_leftover_temp_files(td.path()));
    }

    #[test]
    fn exclusive_create_fails_and_preserves_existing_note() {
        let td = TempDir::new("exclusive_collision");
        let target = td.path().join("nota.md");
        std::fs::write(&target, "contenido original").unwrap();

        let result = create_markdown_exclusive(&target, b"contenido nuevo intentado");

        assert!(result.is_err());
        assert_eq!(
            result.unwrap_err().kind(),
            std::io::ErrorKind::AlreadyExists
        );
        assert_eq!(
            std::fs::read_to_string(&target).unwrap(),
            "contenido original"
        );
    }
}
