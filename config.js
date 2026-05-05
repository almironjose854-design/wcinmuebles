// CONFIGURACIÓN TERREMOS PY - VERSIÓN JSON LOCAL
// ==============================================

// 1. CONFIGURACIÓN BÁSICA
const APP_CONFIG = {
    // Credenciales del administrador
    ADMIN: {
        // Credenciales de acceso al panel de administración.
        // Por seguridad, nunca dejes contraseñas en claro en producción.
        USERNAME: 'admin',
        PASSWORD: 'adminprueba2026*'
    },
    
    // Contacto WhatsApp
    WHATSAPP: '595985282935',
    
    // Imágenes por defecto
    DEFAULT_IMAGES: [
        'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1200&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=1200&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200&auto=format&fit=crop&q=80'
    ],
    
    // Configuración adicional
    MAX_IMAGES: 6,
    MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
    
    // Configuración del carrusel
    CAROUSEL: {
        AUTO_PLAY: true,
        AUTO_PLAY_INTERVAL: 5000,
        SHOW_NAVIGATION: true,
        SHOW_DOTS: true,
        TRANSITION_DURATION: 300
    },
    
    // Configuración de carga por lotes
    BATCH_CONFIG: {
        MAX_BATCH_ITEMS: 10,
        ALLOW_IMAGES: true,
        VALIDATE_REQUIRED: true
    },
    
    // Precios formateados
    formatPrice: (precio) => {
        if (!precio || precio <= 0) return 'Consultar precio';
        return `Gs. ${parseInt(precio).toLocaleString('es-PY')}`;
    },
    
    // Formatear fecha
    formatDate: (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-PY', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    },
    
    // Validar email
    validateEmail: (email) => {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },
    
    // Validar teléfono
    validatePhone: (phone) => {
        const re = /^[+]?[0-9\s\-\(\)]+$/;
        return re.test(phone);
    }
};

// 2. SITIO CONFIG
const SITE_CONFIG = {
    name: 'Terrenos PY',
    slogan: 'Tu terreno ideal en Paraguay',
    phone: '+595 985 282 935',
    email: 'info@terrenospy.com',
    address: 'Asunción, Paraguay',
    whatsapp: '595985282935',
    social: {
        facebook: '#',
        instagram: '#',
        twitter: '#',
        linkedin: '#'
    },
    business_hours: {
        monday_friday: '8:00 - 18:00',
        saturday: '9:00 - 13:00',
        sunday: 'Cerrado'
    },
    meta: {
        description: 'Plataforma líder en Paraguay para comprar y vender terrenos con confianza, rapidez y seguridad.',
        keywords: 'terrenos, paraguay, compra, venta, propiedades, inmobiliaria, lotes, terrenos py',
        author: 'Terrenos PY'
    }
};

// 3. CONFIGURACIÓN DE CLOUDINARY
// ⚠️ REEMPLAZÁ ESTOS DATOS CON LOS TUYOS ⚠️
const CLOUDINARY_CONFIG = {
    cloud_name: 'daqgezuva',      // Ej: "miempresa123"
    upload_preset: 'terrenos_py',     // DEBE ser "terrenos_py"
    api_key: '749499658289531',            // Ej: "123456789012345"
    
    // URL para subir imágenes (NO cambiar)
    api_url: 'https://api.cloudinary.com/v1_1/TU_CLOUD_NAME/image/upload'
};

// ⚠️ ATENCIÓN: Reemplazá "TU_CLOUD_NAME" con tu Cloud Name real
if (CLOUDINARY_CONFIG.cloud_name === 'TU_CLOUD_NAME') {
    console.error('❌ ERROR: Configurá Cloudinary en config.js');
    alert('⚠️ Configurá Cloudinary primero. Ve a config.js y poné tus datos.');
}

// 4. CATEGORÍAS DE TERRENOS
const CATEGORIES = {
    RESIDENTIAL: {
        id: 'residencial',
        name: 'Residencial',
        icon: 'fa-home',
        color: '#38a169'
    },
    COMMERCIAL: {
        id: 'comercial',
        name: 'Comercial',
        icon: 'fa-store',
        color: '#3182ce'
    },
    RURAL: {
        id: 'rural',
        name: 'Rural',
        icon: 'fa-tractor',
        color: '#805ad5'
    },
    INDUSTRIAL: {
        id: 'industrial',
        name: 'Industrial',
        icon: 'fa-industry',
        color: '#d69e2e'
    },
    CAMPESTRE: {
        id: 'campestre',
        name: 'Campestre',
        icon: 'fa-tree',
        color: '#38a169'
    },
    GENERAL: {
        id: 'general',
        name: 'General',
        icon: 'fa-landmark',
        color: '#718096'
    }
};

// 5. ESTADOS DE TERRENOS
const STATUS = {
    AVAILABLE: {
        id: 'disponible',
        name: 'Disponible',
        color: '#38a169',
        icon: 'fa-check-circle'
    },
    RESERVED: {
        id: 'reservado',
        name: 'Reservado',
        color: '#d69e2e',
        icon: 'fa-clock'
    },
    SOLD: {
        id: 'vendido',
        name: 'Vendido',
        color: '#718096',
        icon: 'fa-check'
    }
};

// 6. CONFIGURACIÓN DE MAPAS
const MAP_CONFIG = {
    DEFAULT_CENTER: {
        lat: -25.2637,
        lng: -57.5759
    },
    DEFAULT_ZOOM: 12,
    PROVIDER: 'google',
    STYLE: 'roadmap'
};

// Exportar configuración
window.APP_CONFIG = APP_CONFIG;
window.SITE_CONFIG = SITE_CONFIG;
window.CLOUDINARY_CONFIG = CLOUDINARY_CONFIG;
window.CATEGORIES = CATEGORIES;
window.STATUS = STATUS;
window.MAP_CONFIG = MAP_CONFIG;

console.log('✅ Terrenos PY - Configuración completa cargada');