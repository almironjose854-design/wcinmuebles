// api.js - Sistema con JSON Estático
class TerrenosAPI {
    constructor() {
        // API endpoint para obtener y guardar datos.
        // En producción, apunta al endpoint del servidor (definido en server.js).
        // Si se ejecuta sin servidor, seguirá funcionando desde data.json local.
        this.apiUrl = '/api/data';
        this.localStorageKey = 'terrenos_py_cache';
        this.terrenos = [];
        this.cargando = false;
    }

    async init() {
        console.log('📡 Inicializando API con JSON estático...');
        
        try {
            await this.cargarDesdeJSON();
            console.log(`✅ ${this.terrenos.length} terrenos cargados desde data.json`);
        } catch (error) {
            console.warn('⚠️ No se pudo cargar data.json, usando cache local:', error.message);
            this.cargarDesdeLocalStorage();
        }
    }

    async cargarDesdeJSON() {
        /*
         * Carga los terrenos desde el servidor o, en su defecto,
         * desde el archivo local `data.json`.  Esto permite que la
         * aplicación funcione tanto en producción con una API como en
         * entornos estáticos donde no exista el endpoint `/api/data`.
         */
        try {
            // Intentar leer desde la API
            const response = await fetch(this.apiUrl + '?v=' + Date.now());
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            if (data.terrenos && Array.isArray(data.terrenos)) {
                this.terrenos = data.terrenos;
                this.guardarEnLocalStorage();
                return true;
            }
            throw new Error('Formato JSON inválido');
        } catch (apiError) {
            console.warn('No se pudo cargar desde el API, intentando cargar data.json local...', apiError.message);
            try {
                // Fallback a data.json local
                const localResponse = await fetch('/data.json?v=' + Date.now());
                if (localResponse.ok) {
                    const localData = await localResponse.json();
                    if (localData.terrenos && Array.isArray(localData.terrenos)) {
                        this.terrenos = localData.terrenos;
                        this.guardarEnLocalStorage();
                        return true;
                    }
                    throw new Error('Formato JSON local inválido');
                }
                throw new Error(`HTTP ${localResponse.status}: ${localResponse.statusText}`);
            } catch (localError) {
                console.error('Error cargando data.json:', localError);
                // Propagar el error original del API para que init() lo capture
                throw apiError;
            }
        }
    }

    cargarDesdeLocalStorage() {
        try {
            const cache = localStorage.getItem(this.localStorageKey);
            if (cache) {
                const data = JSON.parse(cache);
                this.terrenos = data.terrenos || [];
            }
        } catch (error) {
            console.error('Error cargando cache local:', error);
            this.terrenos = [];
        }
    }

    guardarEnLocalStorage() {
        try {
            const data = {
                terrenos: this.terrenos,
                fechaActualizacion: new Date().toISOString()
            };
            localStorage.setItem(this.localStorageKey, JSON.stringify(data));
        } catch (error) {
            console.error('Error guardando cache local:', error);
        }
    }

    // Métodos de acceso a datos
    getTerrenos() {
        return [...this.terrenos];
    }

    getTotalTerrenos() {
        return this.terrenos.length;
    }

    getTerrenoPorId(id) {
        return this.terrenos.find(t => t.id === id);
    }

    buscarTerrenos(query) {
        if (!query.trim()) return this.getTerrenos();
        
        const busqueda = query.toLowerCase();
        return this.terrenos.filter(terreno => {
            return (
                (terreno.titulo && terreno.titulo.toLowerCase().includes(busqueda)) ||
                (terreno.ubicacion && terreno.ubicacion.toLowerCase().includes(busqueda)) ||
                (terreno.descripcion && terreno.descripcion.toLowerCase().includes(busqueda)) ||
                (terreno.moneda && terreno.moneda.toLowerCase().includes(busqueda))
            );
        });
    }

    getTerrenosDestacados() {
        return this.terrenos.filter(t => t.destacado);
    }

    // Métodos para administrador (solo local)
async agregarTerreno(datos) {
    try {
        const nuevoTerreno = {
            id: 't' + Date.now() + Math.random().toString(36).substr(2, 9),
            ...datos,
            fechaCreacion: new Date().toISOString(),
            fechaActualizacion: new Date().toISOString()
        };

        console.log('🚀 Iniciando proceso de guardado...');
        console.log('📝 Datos recibidos:', {
                titulo: datos.titulo,
                ubicacion: datos.ubicacion, // <-- Se guarda la ubicación
                moneda: datos.moneda || 'Gs.',
            
                imagenesCount: datos.imagenes ? datos.imagenes.length : 0
            });

            // 🔥 SUBIR IMÁGENES A CLOUDINARY
            if (datos.imagenes && Array.isArray(datos.imagenes) && datos.imagenes.length > 0) {
                console.log('☁️ Iniciando subida a Cloudinary...');
                console.log(`📤 Total imágenes a subir: ${datos.imagenes.length}`);
                
                // Mostrar progreso
                if (window.mostrarProgresoSubida) {
                    window.mostrarProgresoSubida(datos.imagenes.length, 0);
                }
                
                // Subir todas las imágenes a Cloudinary
                const urlsSubidas = await this.subirImagenesACloudinary(
                    datos.imagenes,
                    nuevoTerreno.id
                );
                
                // Guardar las URLs de Cloudinary en el terreno
                nuevoTerreno.imagenes = urlsSubidas;
                console.log(`✅ ${urlsSubidas.length} imágenes procesadas`);
                
            } else {
                // Sin imágenes, usar una por defecto
                nuevoTerreno.imagenes = [APP_CONFIG.DEFAULT_IMAGES[0]];
                console.log('🖼️ Usando imagen por defecto');
            }

            // Guardar en memoria y localStorage
            this.terrenos.unshift(nuevoTerreno);
            this.guardarEnLocalStorage();
            // Persistir cambios en el servidor (no esperar su resultado para evitar bloquear la interfaz)
            this.guardarEnServidor().catch(() => {});

            console.log('🎉 Terreno guardado exitosamente');
            console.log('📊 Resumen:', {
                id: nuevoTerreno.id,
                titulo: nuevoTerreno.titulo,
                moneda: nuevoTerreno.moneda,
                precio: nuevoTerreno.precio,
                imagenes: nuevoTerreno.imagenes.length
            });

            return {
                success: true,
                message: 'Terreno agregado correctamente',
                terreno: nuevoTerreno
            };

        } catch (error) {
            console.error('❌ Error en agregarTerreno:', error);
            return {
                success: false,
                message: 'Error: ' + error.message
            };
        }
    }

    async subirImagenesACloudinary(imagenesBase64, terrenoId) {
        try {
            const urlsFinales = [];
            
            // Verificar si Cloudinary está configurado
            if (!window.CLOUDINARY_CONFIG || 
                !window.CLOUDINARY_CONFIG.cloud_name || 
                window.CLOUDINARY_CONFIG.cloud_name === 'TU_CLOUD_NAME') {
                
                console.warn('⚠️ Cloudinary no configurado, guardando imágenes en base64');
                
                // Si no está configurado, mantener las imágenes en base64
                for (const base64 of imagenesBase64) {
                    urlsFinales.push(base64);
                }
                
                return urlsFinales;
            }
            
            // Si Cloudinary está configurado, subir las imágenes
            if (!window.cloudinaryUploader) {
                throw new Error('CloudinaryUploader no disponible');
            }
            
            console.log(`🔄 Subiendo ${imagenesBase64.length} imágenes a Cloudinary...`);
            
            for (let i = 0; i < imagenesBase64.length; i++) {
                const base64 = imagenesBase64[i];
                
                // Actualizar progreso
                if (window.mostrarProgresoSubida) {
                    window.mostrarProgresoSubida(imagenesBase64.length, i + 1);
                }
                
                // Verificar si ya es una URL de Cloudinary
                if (base64.startsWith('https://res.cloudinary.com/')) {
                    console.log(`  ✅ Imagen ${i+1}: Ya es URL de Cloudinary`);
                    urlsFinales.push(base64);
                    continue;
                }
                
                // Verificar si es base64
                if (base64.startsWith('data:image')) {
                    try {
                        // Subir a Cloudinary
                        const extension = base64.split(';')[0].split('/')[1] || 'jpg';
                        const filename = `terreno_${terrenoId}_${i}_${Date.now()}.${extension}`;
                        
                        console.log(`  📤 Imagen ${i+1}: Subiendo como ${filename}...`);
                        
                        const resultado = await window.cloudinaryUploader.uploadBase64Image(
                            base64, 
                            filename
                        );
                        
                        if (resultado.success) {
                            urlsFinales.push(resultado.url);
                            console.log(`    ✅ Subida exitosa: ${resultado.url.substring(0, 50)}...`);
                        } else {
                            console.warn(`    ⚠️ Falló la subida: ${resultado.error}`);
                            // Mantener base64 como respaldo
                            urlsFinales.push(base64);
                        }
                        
                    } catch (error) {
                        console.error(`    ❌ Error subiendo imagen ${i+1}:`, error);
                        // Mantener base64 como respaldo
                        urlsFinales.push(base64);
                    }
                } else {
                    // Si no es base64 ni URL de Cloudinary, mantener como está
                    urlsFinales.push(base64);
                }
            }
            
            console.log(`✅ Proceso completado: ${urlsFinales.length} imágenes procesadas`);
            return urlsFinales;
            
        } catch (error) {
            console.error('❌ Error en subirImagenesACloudinary:', error);
            
            // En caso de error, devolver las imágenes originales
            return imagenesBase64;
        }
    }

    async actualizarTerreno(id, datos) {
        try {
            const index = this.terrenos.findIndex(t => t.id === id);
            if (index === -1) {
                return {
                    success: false,
                    message: 'Terreno no encontrado'
                };
            }

            // Mantener datos existentes
            const terrenoActualizado = {
                ...this.terrenos[index],
                ...datos,
                fechaActualizacion: new Date().toISOString(),
                id // Mantener el ID original
            };

            // Procesar imágenes actualizadas
            if (datos.imagenes && Array.isArray(datos.imagenes)) {
                // Subir nuevas imágenes a Cloudinary si son base64
                const imagenesProcesadas = [];
                for (const img of datos.imagenes) {
                    if (img.startsWith('data:image')) {
                        // Es una nueva imagen en base64, subir a Cloudinary
                        const resultado = await this.subirImagenesACloudinary([img], id);
                        if (resultado.length > 0) {
                            imagenesProcesadas.push(resultado[0]);
                        }
                    } else {
                        // Ya es una URL, mantenerla
                        imagenesProcesadas.push(img);
                    }
                }
                terrenoActualizado.imagenes = imagenesProcesadas;
            }

            this.terrenos[index] = terrenoActualizado;
            this.guardarEnLocalStorage();
            // Persistir los cambios en el servidor
            this.guardarEnServidor().catch(() => {});

            return {
                success: true,
                message: 'Terreno actualizado correctamente',
                terreno: terrenoActualizado
            };

        } catch (error) {
            console.error('Error actualizando terreno:', error);
            return {
                success: false,
                message: 'Error al actualizar el terreno'
            };
        }
    }

    async borrarTerreno(id) {
        try {
            const inicialLength = this.terrenos.length;
            this.terrenos = this.terrenos.filter(t => t.id !== id);
            
            if (this.terrenos.length < inicialLength) {
                this.guardarEnLocalStorage();
                // Persistir la eliminación en el servidor
                this.guardarEnServidor().catch(() => {});
                return {
                    success: true,
                    message: 'Terreno eliminado correctamente'
                };
            }
            
            return {
                success: false,
                message: 'Terreno no encontrado'
            };
            
        } catch (error) {
            console.error('Error borrando terreno:', error);
            return {
                success: false,
                message: 'Error al eliminar el terreno'
            };
        }
    }

    async agregarTerrenosEnLote(terrenosArray) {
        try {
            let exitosos = 0;
            let fallidos = 0;
            
            for (const datos of terrenosArray) {
                const resultado = await this.agregarTerreno(datos);
                if (resultado.success) {
                    exitosos++;
                } else {
                    fallidos++;
                }
            }
            
            // Una vez procesado el lote, persistir cambios en el servidor.
            this.guardarEnServidor().catch(() => {});
            return {
                success: true,
                message: `Lote procesado: ${exitosos} exitosos, ${fallidos} fallidos`,
                resultados: { exitosos, fallidos }
            };
            
        } catch (error) {
            console.error('Error procesando lote:', error);
            return {
                success: false,
                message: 'Error procesando el lote: ' + error.message
            };
        }
    }

    exportarJSON() {
        try {
            const data = {
                terrenos: this.terrenos,
                metadata: {
                    totalTerrenos: this.terrenos.length,
                    fechaGeneracion: new Date().toISOString(),
                    version: '3.0',
                    generadoPor: 'Sistema Terrenos PY',
                    soportaMoneda: true
                }
            };

            const jsonString = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = `terrenos_py_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            return {
                success: true,
                message: 'JSON exportado correctamente'
            };

        } catch (error) {
            console.error('Error exportando JSON:', error);
            return {
                success: false,
                message: 'Error exportando JSON: ' + error.message
            };
        }
    }

    async importarJSON(file) {
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            
            if (!data.terrenos || !Array.isArray(data.terrenos)) {
                throw new Error('Formato JSON inválido');
            }
            
            this.terrenos = data.terrenos;
            this.guardarEnLocalStorage();
            // Persistir los datos importados en el servidor
            this.guardarEnServidor().catch(() => {});

            return {
                success: true,
                message: `Importados ${data.terrenos.length} terrenos correctamente`
            };
            
        } catch (error) {
            console.error('Error importando JSON:', error);
            return {
                success: false,
                message: 'Error importando JSON: ' + error.message
            };
        }
    }

    limpiarCache() {
        try {
            localStorage.removeItem(this.localStorageKey);
            this.terrenos = [];
            
            // Actualizar el archivo en el servidor para reflejar la lista vacía.
            // No esperamos el resultado para no bloquear la interfaz.
            this.guardarEnServidor().catch(() => {});

            return {
                success: true,
                message: 'Cache limpiado correctamente'
            };
            
        } catch (error) {
            console.error('Error limpiando cache:', error);
            return {
                success: false,
                message: 'Error limpiando cache: ' + error.message,
                error: error.message
            };
        }
    }

    /**
     * Guarda la lista de terrenos en el servidor enviando un PUT
     * a la URL configurada en this.apiUrl. Si la petición falla,
     * se escribe un mensaje en consola y se devuelve false.
     *
     * @returns {Promise<boolean>} true si se guardó correctamente, false si hubo error
     */
    async guardarEnServidor() {
        try {
            const payload = { terrenos: this.terrenos };
            const response = await fetch(this.apiUrl, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return true;
        } catch (error) {
            console.error('Error guardando en servidor:', error);
            return false;
        }
    }

    // Método especial para generar JSON para servidor
    generarJSONParaServidor() {
        try {
            const data = {
                terrenos: this.terrenos,
                metadata: {
                    totalTerrenos: this.terrenos.length,
                    fechaActualizacion: new Date().toISOString(),
                    version: '3.0',
                    generadoPor: 'Sistema Terrenos PY',
                    ultimaModificacion: new Date().toISOString(),
                    soportaMoneda: true
                }
            };

            const jsonString = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = `data.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            return {
                success: true,
                message: 'data.json generado para servidor'
            };

        } catch (error) {
            console.error('Error generando JSON para servidor:', error);
            return {
                success: false,
                message: 'Error generando JSON para servidor'
            };
        }
    }
}

// Instancia global
window.terrenosAPI = new TerrenosAPI();