# 🧹 Script para eliminar archivos vacíos del repositorio
# PowerShell Script para Windows

Write-Host "🔍 Buscando archivos vacíos en el repositorio..." -ForegroundColor Cyan

# Cambiar al directorio del proyecto
Set-Location -Path (Get-Item $PSScriptRoot).Parent.FullName

# Buscar archivos vacíos (0 bytes) que están siendo tracked por git
$emptyFiles = @()
$allFiles = git ls-files

foreach ($file in $allFiles) {
    if (Test-Path $file) {
        $fileInfo = Get-Item $file
        if ($fileInfo.Length -eq 0) {
            $emptyFiles += $file
        }
    }
}

Write-Host "📊 Archivos vacíos encontrados: $($emptyFiles.Count)" -ForegroundColor Yellow

if ($emptyFiles.Count -eq 0) {
    Write-Host "✅ No se encontraron archivos vacíos para eliminar." -ForegroundColor Green
    exit 0
}

# Mostrar la lista de archivos vacíos
Write-Host "`n📋 Lista de archivos vacíos:" -ForegroundColor Yellow
foreach ($file in $emptyFiles) {
    Write-Host "   - $file" -ForegroundColor Red
}

# Preguntar confirmación
$confirmation = Read-Host "`n⚠️ ¿Deseas eliminar estos archivos? (y/N)"

if ($confirmation -eq 'y' -or $confirmation -eq 'Y') {
    Write-Host "`n🗑️ Eliminando archivos vacíos..." -ForegroundColor Red
    
    $removedCount = 0
    foreach ($file in $emptyFiles) {
        try {
            # Usar git rm para eliminar el archivo del repositorio
            git rm $file
            Write-Host "   ✅ Eliminado: $file" -ForegroundColor Green
            $removedCount++
        } catch {
            Write-Host "   ❌ Error eliminando: $file" -ForegroundColor Red
            Write-Host "      Error: $_" -ForegroundColor Red
        }
    }
    
    Write-Host "`n📊 Resumen:" -ForegroundColor Cyan
    Write-Host "   Archivos eliminados: $removedCount" -ForegroundColor Green
    Write-Host "   Archivos con errores: $($emptyFiles.Count - $removedCount)" -ForegroundColor Red
    
    if ($removedCount -gt 0) {
        Write-Host "`n💡 Los archivos han sido eliminados del índice de Git." -ForegroundColor Yellow
        Write-Host "   Usa 'git commit -m `"Remove empty files`"' para confirmar los cambios." -ForegroundColor Yellow
        Write-Host "   O usa 'git reset' para deshacer si fue un error." -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ Operación cancelada. No se eliminaron archivos." -ForegroundColor Yellow
}

Write-Host "`n✨ Script completado." -ForegroundColor Green
