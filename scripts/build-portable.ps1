$ErrorActionPreference = "Stop"

# Ruta al exe compilado por Tauri (CARGO_TARGET_DIR definido en dev-tauri.ps1)
$env:CARGO_TARGET_DIR = "C:\Temp\NebulosaWikiTarget"
$ExePath  = "C:\Temp\NebulosaWikiTarget\release\nebulosa-wiki.exe"

$RepoRoot  = "D:\Aplicaciones\NebulosaWikiApp"
$OutDir    = "$RepoRoot\releases\NebulosaWiki-Portable"
$ZipPath   = "$RepoRoot\releases\NebulosaWiki-Portable-v0.1.1.zip"

Write-Host "=== Nebulosa Wiki - Build Portable ===" -ForegroundColor Cyan
Write-Host ""

# 1. Build release
Write-Host "1. Compilando release..." -ForegroundColor Yellow
Set-Location $RepoRoot

# Sanitizar rutas de compilacion del binario (no exponer paths locales en strings del exe)
$env:RUSTFLAGS = "--remap-path-prefix=$RepoRoot=. --remap-path-prefix=$env:USERPROFILE=C:\Users\user"
Write-Host "   RUSTFLAGS: $env:RUSTFLAGS" -ForegroundColor DarkGray

npm run tauri:build

# Limpiar RUSTFLAGS para no afectar herramientas posteriores
$env:RUSTFLAGS = ""

# 2. Verificar exe
if (-not (Test-Path $ExePath)) {
    Write-Error "No se encontro el ejecutable en: $ExePath"
    exit 1
}

# 3. Limpiar y crear estructura portable
Write-Host "2. Creando estructura portable..." -ForegroundColor Yellow
if (Test-Path $OutDir) { Remove-Item -Recurse -Force $OutDir }
New-Item -ItemType Directory -Force "$OutDir\data\wiki" | Out-Null

# 4. Copiar ejecutable
Write-Host "3. Copiando ejecutable..." -ForegroundColor Yellow
Copy-Item $ExePath "$OutDir\Nebulosa Wiki.exe"

# 5. README portable
Write-Host "4. Creando README-PORTABLE.txt..." -ForegroundColor Yellow
$ReadmeContent = @"
Nebulosa Wiki - Portable

Como usar:
1. Descomprimir esta carpeta en cualquier ubicacion.
2. Ejecutar Nebulosa Wiki.exe.
3. La configuracion se guarda en ./data/settings.json.
4. La wiki por defecto se guarda en ./data/wiki.
5. Los datos del WebView se guardan en ./data/webview.

No requiere instalacion tradicional.
No usa AppData. Todo queda dentro de esta carpeta.

Para cambiar la ruta de la wiki:
Abrir la app, ir al panel de Ajustes y cambiar la ruta.
"@
$ReadmeContent | Out-File -FilePath "$OutDir\README-PORTABLE.txt" -Encoding utf8

# 6. Comprimir
Write-Host "5. Comprimiendo..." -ForegroundColor Yellow
if (Test-Path $ZipPath) { Remove-Item -Force $ZipPath }
Compress-Archive -Path $OutDir -DestinationPath $ZipPath

Write-Host ""
Write-Host "=== Listo ===" -ForegroundColor Green
Write-Host "Carpeta: $OutDir"
Write-Host "ZIP:     $ZipPath"
