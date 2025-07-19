const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * 🧹 Script Node.js para eliminar archivos vacíos del repositorio
 * Funciona en Windows, Linux y macOS
 */

console.log('🔍 Buscando archivos vacíos en el repositorio...');

// Cambiar al directorio del proyecto
const projectRoot = path.dirname(__dirname);
process.chdir(projectRoot);

try {
    // Obtener lista de archivos tracked por git
    const gitFiles = execSync('git ls-files', { encoding: 'utf8' })
        .split('\n')
        .filter(file => file.trim() !== '');

    // Buscar archivos vacíos
    const emptyFiles = [];
    
    for (const file of gitFiles) {
        try {
            const filePath = path.join(projectRoot, file);
            if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                if (stats.size === 0) {
                    emptyFiles.push(file);
                }
            }
        } catch (error) {
            // Ignorar errores de archivos individuales
        }
    }

    console.log(`📊 Archivos vacíos encontrados: ${emptyFiles.length}`);

    if (emptyFiles.length === 0) {
        console.log('✅ No se encontraron archivos vacíos para eliminar.');
        process.exit(0);
    }

    // Mostrar la lista de archivos vacíos
    console.log('\n📋 Lista de archivos vacíos:');
    emptyFiles.forEach(file => {
        console.log(`   - ${file}`);
    });

    // En Node.js no podemos hacer input interactivo fácilmente,
    // así que mostraremos los comandos a ejecutar
    console.log('\n💡 Para eliminar estos archivos, ejecuta los siguientes comandos:');
    console.log('\n🗑️ Comandos git rm:');
    emptyFiles.forEach(file => {
        console.log(`git rm "${file}"`);
    });

    console.log('\n📝 O ejecuta todos de una vez:');
    const gitRmCommand = `git rm ${emptyFiles.map(f => `"${f}"`).join(' ')}`;
    console.log(gitRmCommand);

    console.log('\n⚠️ Después de ejecutar los comandos:');
    console.log('git commit -m "Remove empty files"');

    console.log('\n✨ Script completado.');

} catch (error) {
    console.error('❌ Error ejecutando el script:', error.message);
    process.exit(1);
}
