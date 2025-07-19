#!/bin/bash

# 🧹 Script para eliminar archivos vacíos del repositorio
# Bash Script para Linux/macOS

echo "🔍 Buscando archivos vacíos en el repositorio..."

# Cambiar al directorio del proyecto
cd "$(dirname "$0")/.."

# Buscar archivos vacíos (0 bytes) que están siendo tracked por git
empty_files=()
while IFS= read -r -d '' file; do
    if [[ -f "$file" && ! -s "$file" ]]; then
        empty_files+=("$file")
    fi
done < <(git ls-files -z)

echo "📊 Archivos vacíos encontrados: ${#empty_files[@]}"

if [[ ${#empty_files[@]} -eq 0 ]]; then
    echo "✅ No se encontraron archivos vacíos para eliminar."
    exit 0
fi

# Mostrar la lista de archivos vacíos
echo ""
echo "📋 Lista de archivos vacíos:"
for file in "${empty_files[@]}"; do
    echo "   - $file"
done

# Preguntar confirmación
echo ""
read -p "⚠️ ¿Deseas eliminar estos archivos? (y/N): " confirmation

if [[ "$confirmation" =~ ^[Yy]$ ]]; then
    echo ""
    echo "🗑️ Eliminando archivos vacíos..."
    
    removed_count=0
    error_count=0
    
    for file in "${empty_files[@]}"; do
        if git rm "$file" 2>/dev/null; then
            echo "   ✅ Eliminado: $file"
            ((removed_count++))
        else
            echo "   ❌ Error eliminando: $file"
            ((error_count++))
        fi
    done
    
    echo ""
    echo "📊 Resumen:"
    echo "   Archivos eliminados: $removed_count"
    echo "   Archivos con errores: $error_count"
    
    if [[ $removed_count -gt 0 ]]; then
        echo ""
        echo "💡 Los archivos han sido eliminados del índice de Git."
        echo "   Usa 'git commit -m \"Remove empty files\"' para confirmar los cambios."
        echo "   O usa 'git reset' para deshacer si fue un error."
    fi
else
    echo "❌ Operación cancelada. No se eliminaron archivos."
fi

echo ""
echo "✨ Script completado."
