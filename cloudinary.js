// cloudinary.js - Sube imágenes a Cloudinary automáticamente

class CloudinaryUploader {
    constructor() {
        // Usa la configuración de window
        this.config = window.CLOUDINARY_CONFIG;
        
        if (!this.config) {
            console.error('❌ CLOUDINARY_CONFIG no está definido');
            console.error('   Verificá que config.js se cargue antes que cloudinary.js');
            return;
        }
        
        console.log('📡 Inicializando Cloudinary...');
        console.log('   Cloud Name:', this.config.cloud_name);
    }

    /**
     * Sube una imagen a Cloudinary
     * @param {File} file - Archivo de imagen
     * @returns {Object} - {success: bool, url: string}
     */
    async uploadImage(file) {
        try {
            console.log('📤 Subiendo imagen:', file.name);
            
            // Validar que sea imagen
            if (!file.type.startsWith('image/')) {
                throw new Error('Solo se permiten imágenes');
            }

            // Validar tamaño (máx 10MB)
            if (file.size > 10 * 1024 * 1024) {
                throw new Error('La imagen es muy grande (máx 10MB)');
            }

            // Crear FormData con datos de Cloudinary
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', this.config.upload_preset);
            formData.append('cloud_name', this.config.cloud_name);
            
            // Opcional: organizar en carpetas
            formData.append('folder', 'terrenos_py');

            // Subir a Cloudinary
            const response = await fetch(
                `https://api.cloudinary.com/v1_1/${this.config.cloud_name}/image/upload`,
                {
                    method: 'POST',
                    body: formData
                }
            );

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Error ${response.status}: ${error}`);
            }

            const data = await response.json();
            
            console.log('✅ Imagen subida:', data.secure_url.substring(0, 50) + '...');
            
            return {
                success: true,
                url: data.secure_url, // URL pública de la imagen
                public_id: data.public_id,
                format: data.format
            };

        } catch (error) {
            console.error('❌ Error subiendo imagen:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Sube una imagen en formato base64
     * @param {string} base64String - Imagen en base64
     * @param {string} filename - Nombre del archivo
     * @returns {Object} - {success: bool, url: string}
     */

        /**
         * Sube un video a Cloudinary
         * @param {File} file - Video (mp4, mov, webm...)
         * @returns {Object} - {success: bool, url: string, public_id: string, format: string, resource_type:'video'}
         */
        async uploadVideo(file) {
            try {
                console.log('🎬 Subiendo video:', file.name);

                if (!file.type.startsWith('video/')) {
                    throw new Error('Solo se permiten videos');
                }

                // Validar tamaño (máx 100MB por seguridad; ajustá si querés)
                if (file.size > 100 * 1024 * 1024) {
                    throw new Error('El video es muy grande (máx 100MB)');
                }

                const formData = new FormData();
                formData.append('file', file);
                formData.append('upload_preset', this.config.upload_preset);
                formData.append('cloud_name', this.config.cloud_name);
                formData.append('folder', 'terrenos_py');

                const response = await fetch(
                    `https://api.cloudinary.com/v1_1/${this.config.cloud_name}/video/upload`,
                    { method: 'POST', body: formData }
                );

                if (!response.ok) {
                    const error = await response.text();
                    throw new Error(`Error ${response.status}: ${error}`);
                }

                const data = await response.json();

                console.log('✅ Video subido:', data.secure_url);

                return {
                    success: true,
                    url: data.secure_url,
                    public_id: data.public_id,
                    format: data.format,
                    resource_type: 'video'
                };

            } catch (error) {
                console.error('❌ Error subiendo video:', error);
                return { success: false, error: error.message };
            }
        }

        /**
         * Sube un archivo (imagen o video) a Cloudinary
         * @param {File} file
         * @returns {Object} - {success, url, public_id, format, resource_type}
         */
        async uploadMedia(file) {
            if (!file || !file.type) {
                return { success: false, error: 'Archivo inválido' };
            }
            if (file.type.startsWith('image/')) return await this.uploadImage(file);
            if (file.type.startsWith('video/')) return await this.uploadVideo(file);

            return { success: false, error: 'Tipo de archivo no soportado (solo imagen o video)' };
        }

        /**
         * Sube múltiples archivos (imágenes y/o videos)
         * @param {FileList|File[]} files
         * @returns {Array} - array de resultados {success,url,...}
         */
        async uploadMultipleMedia(files) {
            const resultados = [];
            const arr = Array.from(files || []);
            if (arr.length === 0) return resultados;

            for (let i = 0; i < arr.length; i++) {
                const file = arr[i];

                // Progreso (reutiliza tu UI si existe)
                if (window.mostrarProgresoSubida) {
                    // Texto sigue diciendo "Imagen", pero al menos muestra progreso
                    window.mostrarProgresoSubida(arr.length, i + 1);
                }

                const r = await this.uploadMedia(file);
                resultados.push(r);
            }

            return resultados;
        }

    async uploadBase64Image(base64String, filename) {
        try {
            console.log('📤 Convirtiendo base64 a archivo...');
            
            // Convertir base64 a Blob
            const response = await fetch(base64String);
            const blob = await response.blob();
            
            // Crear archivo desde blob
            const file = new File([blob], filename, { 
                type: blob.type,
                lastModified: Date.now()
            });

            // Subir el archivo
            return await this.uploadImage(file);

        } catch (error) {
            console.error('❌ Error procesando base64:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Sube múltiples imágenes
     * @param {Array} imagenesBase64 - Array de imágenes en base64
     * @param {string} terrenoId - ID del terreno
     * @returns {Array} - Array de URLs subidas
     */
    async uploadMultipleImages(imagenesBase64, terrenoId) {
        console.log(`🔄 Subiendo ${imagenesBase64.length} imágenes para terreno ${terrenoId}`);
        
        const resultados = [];
        
        for (let i = 0; i < imagenesBase64.length; i++) {
            const base64 = imagenesBase64[i];
            
            // Crear nombre único para cada imagen
            const extension = base64.split(';')[0].split('/')[1];
            const filename = `terreno_${terrenoId}_${i}_${Date.now()}.${extension}`;
            
            console.log(`  📤 Imagen ${i+1}/${imagenesBase64.length}...`);
            
            // Subir imagen
            const resultado = await this.uploadBase64Image(base64, filename);
            
            if (resultado.success) {
                resultados.push(resultado.url);
            } else {
                console.warn(`  ⚠️ Falló imagen ${i+1}: ${resultado.error}`);
                // Si falla, mantener el base64 como respaldo
                resultados.push(base64);
            }
        }
        
        return resultados;
    }
}

// Crear instancia global SOLO si no existe
if (!window.cloudinaryUploader) {
    window.cloudinaryUploader = new CloudinaryUploader();
    console.log('✅ CloudinaryUploader listo para usar');
} else {
    console.log('✅ CloudinaryUploader ya estaba inicializado');
}