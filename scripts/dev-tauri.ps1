$ErrorActionPreference = "Stop"

$env:CARGO_TARGET_DIR = "C:\Temp\NebulosaWikiTarget"

Write-Host "Nebulosa Wiki - modo desarrollo" -ForegroundColor Cyan
Write-Host "Repositorio: D:\Aplicaciones\NebulosaWikiApp"
Write-Host "Cargo target: $env:CARGO_TARGET_DIR"
Write-Host ""

npm run tauri dev
