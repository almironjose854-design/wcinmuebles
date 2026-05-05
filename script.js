// script.js - Sistema principal con JSON Local
// Versión 5.0 - Agregado soporte para moneda (USD/Gs.)

// Variables globales
let propiedades = [];
let editandoId = null;
let currentUser = null;
let carouselInterval = null;


// ==================== HELPERS DOM (evita errores por IDs faltantes) ====================

function setTextSafe(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value ?? '';
}

function setHtmlSafe(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = value ?? '';
}

function setAttrSafe(id, attr, value) {
    const el = document.getElementById(id);
    if (el) el.setAttribute(attr, value ?? '');
}

/**
 * Normaliza links de Google Maps para que funcionen dentro de un <iframe>.
 * - Si ya es embed, lo deja.
 * - Si es un link con ?q=..., agrega output=embed.
 * - Si es un link con @lat,lng o place, intenta convertirlo a q=.
 */
function normalizeMapUrl(url) {
    if (!url) return '';
    let u = String(url).trim();
    if (!u) return '';

    // Ya es embed
    if (u.includes('/maps/embed') || u.includes('output=embed')) return u;

    // Short links (maps.app.goo.gl / goo.gl) no siempre permiten embed directo
    if (u.includes('maps.app.goo.gl') || u.includes('goo.gl/maps')) return u;

    try {
        const parsed = new URL(u);

        // Si ya es google maps, intentamos agregar output=embed
        if (parsed.hostname.includes('google.') && parsed.pathname.includes('/maps')) {
            // Caso 1: link con q=
            const q = parsed.searchParams.get('q');
            if (q) {
                parsed.searchParams.set('output', 'embed');
                parsed.pathname = '/maps';
                return parsed.toString();
            }

            // Caso 2: link con @lat,lng (ej: /maps/@-25.3,-57.6,15z)
            const atMatch = parsed.pathname.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
            if (atMatch) {
                const qll = `${atMatch[1]},${atMatch[2]}`;
                return `https://www.google.com/maps?q=${encodeURIComponent(qll)}&output=embed`;
            }

            // Caso 3: cualquier otro link maps -> usar como search query (mejor que nada)
            return `https://www.google.com/maps?q=${encodeURIComponent(parsed.href)}&output=embed`;
        }

        // No es google maps: tratamos como "q" genérico
        return `https://www.google.com/maps?q=${encodeURIComponent(parsed.href)}&output=embed`;

    } catch (e) {
        // Si no es URL válida, lo mandamos como búsqueda
        return `https://www.google.com/maps?q=${encodeURIComponent(u)}&output=embed`;
    }
}


/**
 * Preview de imágenes y videos en admin
 */
function setupMediaPreview(inputId, previewId) {
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    if (!input || !preview) return;

    input.addEventListener('change', () => {
        preview.innerHTML = '';
        const files = Array.from(input.files || []).slice(0, 10);

        files.forEach((file) => {
            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'position:relative;width:100px;height:100px;border-radius:8px;overflow:hidden;background:#f3f3f3;display:flex;align-items:center;justify-content:center;';

            if (file.type && file.type.startsWith('video/')) {
                const vid = document.createElement('video');
                vid.src = URL.createObjectURL(file);
                vid.muted = true;
                vid.playsInline = true;
                vid.preload = 'metadata';
                vid.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
                wrapper.appendChild(vid);

                const badge = document.createElement('div');
                badge.textContent = 'VIDEO';
                badge.style.cssText = 'position:absolute;bottom:6px;left:6px;font-size:10px;background:rgba(0,0,0,.7);color:#fff;padding:2px 6px;border-radius:999px;';
                wrapper.appendChild(badge);
            } else if (file.type && file.type.startsWith('image/')) {
                const img = document.createElement('img');
                img.src = URL.createObjectURL(file);
                img.alt = 'preview';
                img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
                wrapper.appendChild(img);
            } else {
                const span = document.createElement('span');
                span.textContent = 'Archivo';
                span.style.cssText = 'font-size:12px;color:#666;';
                wrapper.appendChild(span);
            }

            preview.appendChild(wrapper);
        });
    });
}
// ==================== PROGRESO DE SUBIDA ====================

function mostrarProgresoSubida(total, actual) {
    let progressDiv = document.getElementById('uploadProgress');
    
    if (!progressDiv) {
        progressDiv = document.createElement('div');
        progressDiv.id = 'uploadProgress';
        progressDiv.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.8);
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
        `;
        
        progressDiv.innerHTML = `
            <div style="background: white; padding: 30px; border-radius: 12px; text-align: center; max-width: 400px;">
                <div style="width: 50px; height: 50px; border: 3px solid var(--light-gray); 
                            border-top-color: var(--accent); border-radius: 50%; 
                            animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
                <h3 style="color: var(--primary); margin-bottom: 10px;">Subiendo a Cloudinary...</h3>
                <p id="uploadStatus" style="color: var(--gray); margin-bottom: 10px;">Iniciando...</p>
                <div style="width: 100%; height: 8px; background: var(--light-gray); 
                            border-radius: 4px; overflow: hidden;">
                    <div id="uploadBar" style="width: 0%; height: 100%; background: var(--accent); 
                                               transition: width 0.3s;"></div>
                </div>
            </div>
        `;
        
        document.body.appendChild(progressDiv);
    }
    
    if (total > 0) {
        const porcentaje = Math.round((actual / total) * 100);
        const statusText = document.getElementById('uploadStatus');
        const progressBar = document.getElementById('uploadBar');
        
        if (statusText) {
            statusText.textContent = `Imagen ${actual} de ${total} (${porcentaje}%)`;
        }
        
        if (progressBar) {
            progressBar.style.width = `${porcentaje}%`;
        }
        
        if (actual >= total) {
            setTimeout(() => {
                if (progressDiv && progressDiv.parentNode) {
                    progressDiv.style.opacity = '0';
                    progressDiv.style.transition = 'opacity 0.5s';
                    setTimeout(() => {
                        if (progressDiv.parentNode) {
                            progressDiv.parentNode.removeChild(progressDiv);
                        }
                    }, 500);
                }
            }, 2000);
        }
    }
}

window.mostrarProgresoSubida = mostrarProgresoSubida;

// ==================== FUNCIÓN DE NOTIFICACIÓN ====================

function mostrarNotificacion(mensaje, tipo = 'success') {
    try {
        const notificacionesExistentes = document.querySelectorAll('.notification');
        notificacionesExistentes.forEach(n => n.remove());
        
        const notificacion = document.createElement('div');
        notificacion.className = `notification ${tipo}`;
        
        let icono = 'fa-check-circle';
        if (tipo === 'error') icono = 'fa-exclamation-circle';
        if (tipo === 'warning') icono = 'fa-exclamation-triangle';
        if (tipo === 'info') icono = 'fa-info-circle';
        
        notificacion.innerHTML = `
            <i class="fas ${icono}"></i>
            <span>${mensaje}</span>
        `;
        
        document.body.appendChild(notificacion);
        
        setTimeout(() => {
            notificacion.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (notificacion.parentNode) {
                    notificacion.parentNode.removeChild(notificacion);
                }
            }, 300);
        }, 3000);
        
    } catch (error) {
        console.error('Error mostrando notificación:', error);
        alert(mensaje);
    }
}

// ==================== FUNCIONES DE CARRUSEL UNIFICADAS ====================

function initCarousel(images, containerId = 'carouselTrack', dotsId = 'carouselDots') {
    const track = document.getElementById(containerId);
    const dots = document.getElementById(dotsId);
    
    if (!track || !dots) {
        console.error('Elementos del carrusel no encontrados');
        return;
    }
    
    // Limpiar
    track.innerHTML = '';
    dots.innerHTML = '';
    
    // Si no hay imágenes, usar una por defecto
    if (!images || images.length === 0) {
        images = APP_CONFIG.DEFAULT_IMAGES;
    }
    
    console.log(`🎠 Inicializando carrusel con ${images.length} imágenes`);
    
    
// Crear slides (soporta imágenes y videos)
images.forEach((item, index) => {
    const slide = document.createElement('div');
    slide.className = 'carousel-slide';

    // Compatibilidad: si viene como string, es imagen
    const media = (typeof item === 'string')
        ? { type: 'image', url: item }
        : { type: (item.type || 'image'), url: (item.url || item.src || '') , poster: item.poster || item.thumb || '' };

    if (media.type === 'video') {
        const posterAttr = media.poster ? ` poster="${media.poster}"` : '';
        slide.innerHTML = `
            <video src="${media.url}" controls playsinline preload="metadata"${posterAttr}></video>
        `;
    } else {
        slide.innerHTML = `<img src="${media.url}" alt="Imagen ${index + 1}" loading="lazy">`;
    }

    track.appendChild(slide);
// Crear puntos
        const dot = document.createElement('button');
        dot.className = 'carousel-dot' + (index === 0 ? ' active' : '');
        dot.setAttribute('onclick', `goToSlide(${index})`);
        dot.setAttribute('aria-label', `Ir a imagen ${index + 1}`);
        dots.appendChild(dot);
    });
    
    // Inicializar variable global
    window.currentSlide = 0;
    updateCarousel(containerId, dotsId);
    
    // Iniciar autoplay si está configurado
    if (APP_CONFIG.CAROUSEL.AUTO_PLAY) {
        startCarouselAutoPlay();
    }
}

function updateCarousel(containerId = 'carouselTrack', dotsId = 'carouselDots') {
    const track = document.getElementById(containerId);
    const dots = document.querySelectorAll(`#${dotsId} .carousel-dot, .carousel-dot`);
    const slides = track ? track.querySelectorAll('.carousel-slide') : [];
    
    if (!track || slides.length === 0) return;
    
    // Mover track
    track.style.transform = `translateX(-${window.currentSlide * 100}%)`;
    
    // Actualizar puntos
    dots.forEach((dot, index) => {
        if (dot) {
            dot.classList.toggle('active', index === window.currentSlide);
        }
    });
}

window.nextSlide = function() {
    const track = document.getElementById('carouselTrack');
    const slides = track ? track.querySelectorAll('.carousel-slide') : [];
    if (slides.length === 0) return;
    
    window.currentSlide = (window.currentSlide + 1) % slides.length;
    updateCarousel();
}

window.prevSlide = function() {
    const track = document.getElementById('carouselTrack');
    const slides = track ? track.querySelectorAll('.carousel-slide') : [];
    if (slides.length === 0) return;
    
    window.currentSlide = (window.currentSlide - 1 + slides.length) % slides.length;
    updateCarousel();
}

window.goToSlide = function(index) {
    const track = document.getElementById('carouselTrack');
    const slides = track ? track.querySelectorAll('.carousel-slide') : [];
    if (slides.length === 0) return;
    
    window.currentSlide = index;
    updateCarousel();
}

//function startCarouselAutoPlay() {
   // if (carouselInterval) clearInterval(carouselInterval);
    
    //carouselInterval = setInterval(() => {
      //  window.nextSlide();
    //}, APP_CONFIG.CAROUSEL.AUTO_PLAY_INTERVAL);
//}

function stopCarouselAutoPlay() {
    if (carouselInterval) {
        clearInterval(carouselInterval);
        carouselInterval = null;
    }
}

// Eventos para pausar autoplay
document.addEventListener('DOMContentLoaded', function() {
    const carousel = document.querySelector('.carousel');
    if (carousel) {
        carousel.addEventListener('mouseenter', stopCarouselAutoPlay);
        carousel.addEventListener('mouseleave', startCarouselAutoPlay);
        carousel.addEventListener('touchstart', stopCarouselAutoPlay);
    }
});

// ==================== INICIALIZACIÓN ====================

document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Terrenos PY - Iniciando aplicación...');
    
    try {
        await terrenosAPI.init();
        propiedades = terrenosAPI.getTerrenos();
        console.log(`✅ ${propiedades.length} terrenos cargados`);
        actualizarEstadisticas();
        
    } catch (error) {
        console.error('❌ Error inicializando API:', error);
        mostrarNotificacion('Error cargando datos.', 'error');
    }
    
    const path = window.location.pathname.split('/').pop();
    
    if (path === 'admin.html') {
        inicializarAdmin();
    } else if (path === 'property.html') {
        inicializarDetalle();
    } else {
        inicializarHome();
    }
    
    mejorarResponsividad();
    window.addEventListener('resize', mejorarResponsividad);
});

// ==================== FUNCIONES DE UTILIDAD ====================

function formatoNumero(num) {
    if (num === null || num === undefined || isNaN(num)) return '0';
    return Number(num).toLocaleString('es-PY');
}

function formatoPrecio(precio, moneda = 'Gs.') {
    if (!precio || precio <= 0) return 'Consultar precio';
    const simboloMoneda = moneda === 'USD' ? 'USD $' : 'Gs.';
    return `${simboloMoneda} ${formatoNumero(precio)}`;
}

function actualizarEstadisticas() {
    const total = terrenosAPI.getTotalTerrenos();
    const destacados = terrenosAPI.getTerrenosDestacados().length;
    const disponibles = terrenosAPI.getTerrenos().filter(t => t.estado === 'disponible').length;
    
    const totalElement = document.getElementById('totalTerrenos');
    if (totalElement) totalElement.textContent = total;
    
    const totalAdmin = document.getElementById('totalTerrenosCount');
    if (totalAdmin) totalAdmin.textContent = total;
    
    const destacadosElement = document.getElementById('destacadosCount');
    if (destacadosElement) destacadosElement.textContent = destacados;
    
    const disponiblesElement = document.getElementById('disponiblesCount');
    if (disponiblesElement) disponiblesElement.textContent = disponibles;
    
    const sysTotal = document.getElementById('sysTotalTerrenos');
    if (sysTotal) sysTotal.textContent = total;
}

// ==================== PÁGINA PRINCIPAL ====================

function inicializarHome() {
    console.log('🏠 Inicializando página principal...');
    
    const container = document.getElementById('propertiesContainer');
    if (container) {
        renderizarTerrenosHome(container);
    }
    
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            buscarTerrenos(this.value);
        });
    }
}

function renderizarTerrenosHome(container) {
    if (!container) return;
    
    const terrenosActuales = terrenosAPI.getTerrenos();
    container.innerHTML = '';
    
    if (terrenosActuales.length === 0) {
        container.innerHTML = `
            <div class="no-properties" style="grid-column: 1/-1; text-align: center; padding: 40px;">
                <i class="fas fa-home" style="font-size: 3rem; color: #ccc; margin-bottom: 20px;"></i>
                <h3 style="color: #666; margin-bottom: 10px;">No hay terrenos disponibles</h3>
            </div>
        `;
        return;
    }
    
    terrenosActuales.forEach(terreno => {
        const card = crearTarjetaTerreno(terreno, false);
        container.appendChild(card);
    });
}
function crearTarjetaTerreno(terreno, esAdmin = false) {
    const card = document.createElement('div');
    card.className = 'property-card fade-in';
    if (terreno.destacado) card.classList.add('destacado');
    card.dataset.id = terreno.id;
    
    const img = document.createElement('img');
    img.src = terreno.imagenes && terreno.imagenes.length > 0 
        ? terreno.imagenes[0] 
        : APP_CONFIG.DEFAULT_IMAGES[0];
    img.alt = terreno.titulo || 'Terreno';
    img.className = 'property-image';
    
    if (!esAdmin) {
        img.style.cursor = 'pointer';
        img.addEventListener('click', () => {
            window.location.href = `property.html?id=${terreno.id}`;
        });
    }
    
    card.appendChild(img);
    
    const content = document.createElement('div');
    content.className = 'property-content';
    
    const title = document.createElement('h3');
    title.className = 'property-title';
    if (!esAdmin) {
        const titleLink = document.createElement('a');
        titleLink.href = `property.html?id=${terreno.id}`;
        titleLink.textContent = terreno.titulo || 'Terreno sin título';
        titleLink.style.cssText = 'color: inherit; text-decoration: none;';
        title.appendChild(titleLink);
    } else {
        title.textContent = terreno.titulo || 'Terreno sin título';
    }
    content.appendChild(title);
    
    const location = document.createElement('div');
    location.className = 'property-location';
    location.innerHTML = `<i class="fas fa-map-marker-alt"></i><span>${terreno.ubicacion || 'Sin ubicación'}</span>`;
    content.appendChild(location);
    
    const price = document.createElement('div');
    price.className = 'property-price';
    price.textContent = formatoPrecio(terreno.precio, terreno.moneda || 'Gs.');
    content.appendChild(price);
    
    const description = document.createElement('p');
    description.className = 'property-description';
    if (terreno.descripcion) {
        const descCorta = terreno.descripcion.length > 120 
            ? terreno.descripcion.substring(0, 120) + '...' 
            : terreno.descripcion;
        description.textContent = descCorta;
    }
    content.appendChild(description);
    
    const meta = document.createElement('div');
    meta.className = 'property-meta';
    meta.innerHTML = `
        <span><i class="fas fa-expand"></i> ${formatoNumero(terreno.tamaño)} m²</span>
        <span><i class="fas fa-${terreno.estado === 'disponible' ? 'check-circle' : 'clock'}"></i> ${terreno.estado || 'disponible'}</span>
        <span><i class="far fa-calendar"></i> ${new Date(terreno.fechaCreacion).toLocaleDateString()}</span>
    `;
    content.appendChild(meta);
    
    card.appendChild(content);
    return card;
}

function buscarTerrenos(query) {
    const container = document.getElementById('propertiesContainer');
    if (!container) return;
    
    if (!query.trim()) {
        renderizarTerrenosHome(container);
        return;
    }
    
    const resultados = terrenosAPI.buscarTerrenos(query);
    container.innerHTML = '';
    
    if (resultados.length === 0) {
        container.innerHTML = `
            <div class="no-results" style="grid-column: 1/-1; text-align: center; padding: 40px;">
                <i class="fas fa-search" style="font-size: 3rem; color: #ccc; margin-bottom: 20px;"></i>
                <h3 style="color: #666; margin-bottom: 10px;">No se encontraron resultados</h3>
                <p style="color: #999;">Intenta con otros términos de búsqueda</p>
            </div>
        `;
        return;
    }
    
    resultados.forEach(terreno => {
        const card = crearTarjetaTerreno(terreno, false);
        container.appendChild(card);
    });
}

// ==================== ADMINISTRACIÓN ====================

function inicializarAdmin() {
    console.log('⚙️ Inicializando panel de administración...');
    // Actualizar año en el pie de página del panel
    const yearEl = document.getElementById('yearAdmin');
    if (yearEl) {
        yearEl.textContent = new Date().getFullYear();
    }

    configurarLogin();
    configurarFormulario();
    configurarTabs();
    configurarSistema();
    configurarImportacionExportacion();
    configurarCargaPorLotes();
    verificarLoginPrev();
}

function configurarLogin() {
    const loginForm = document.getElementById('loginForm');
    const loginSection = document.getElementById('loginSection');
    const dashboardSection = document.getElementById('dashboardSection');
    
    if (!loginForm) return;
    
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();
        
        console.log('🔐 Intento de login:', { username, password });
        
        const credencialesValidas = {
            usuario: APP_CONFIG.ADMIN.USERNAME,
            contraseña: APP_CONFIG.ADMIN.PASSWORD
        };
        
        if (username === credencialesValidas.usuario && password === credencialesValidas.contraseña) {
            console.log('✅ Credenciales correctas');
            
            sessionStorage.setItem('terrenos_admin_logueado', 'true');
            sessionStorage.setItem('terrenos_admin_usuario', username);
            
            propiedades = terrenosAPI.getTerrenos();
            
            if (loginSection) loginSection.style.display = 'none';
            if (dashboardSection) dashboardSection.style.display = 'block';
            
            cargarTerrenosAdmin();
            actualizarEstadisticasAdmin();
            
            mostrarNotificacion('Inicio de sesión exitoso', 'success');
            
        } else {
            console.log('❌ Credenciales incorrectas');
            mostrarNotificacion('Usuario o contraseña incorrectos', 'error');
            
            document.getElementById('username').style.borderColor = 'var(--danger)';
            document.getElementById('password').style.borderColor = 'var(--danger)';
            
            setTimeout(() => {
                document.getElementById('username').style.borderColor = '';
                document.getElementById('password').style.borderColor = '';
            }, 2000);
        }
    });
    
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (confirm('¿Cerrar sesión del administrador?')) {
                sessionStorage.removeItem('terrenos_admin_logueado');
                sessionStorage.removeItem('terrenos_admin_usuario');
                location.reload();
            }
        });
    }
}

function verificarLoginPrev() {
    const estaLogueado = sessionStorage.getItem('terrenos_admin_logueado') === 'true';
    
    console.log('🔍 Verificando login previo:', { estaLogueado });
    
    if (estaLogueado) {
        const loginSection = document.getElementById('loginSection');
        const dashboardSection = document.getElementById('dashboardSection');
        
        propiedades = terrenosAPI.getTerrenos();
        
        if (loginSection) loginSection.style.display = 'none';
        if (dashboardSection) dashboardSection.style.display = 'block';
        
        cargarTerrenosAdmin();
        actualizarEstadisticasAdmin();
    } else {
        console.log('👤 No hay sesión activa');
    }
}

async function cargarTerrenosAdmin() {
    const container = document.getElementById('adminPropertiesTable');
    const countElement = document.getElementById('propertyCount');
    
    if (!container) return;
    
    const terrenosActuales = terrenosAPI.getTerrenos();
    propiedades = terrenosActuales;
    
    if (countElement) {
        countElement.textContent = `${terrenosActuales.length} terrenos`;
    }
    
    container.innerHTML = '';
    
    if (terrenosActuales.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 40px;">
                    <div style="display: inline-block; text-align: center;">
                        <i class="fas fa-home" style="font-size: 3rem; color: var(--light-gray); margin-bottom: 15px;"></i>
                        <p style="color: var(--gray);">No hay terrenos cargados</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    terrenosActuales.forEach(terreno => {
        const row = document.createElement('tr');
        const fecha = new Date(terreno.fechaActualizacion).toLocaleDateString('es-PY');
        const imgUrl = terreno.imagenes && terreno.imagenes.length > 0 ? terreno.imagenes[0] : APP_CONFIG.DEFAULT_IMAGES[0];
        
        row.innerHTML = `
            <td style="font-size: 0.85rem; color: var(--gray);">${terreno.id.substring(0, 8)}...</td>
            <td>
                <img src="${imgUrl}" 
                     alt="${terreno.titulo}" 
                     style="width: 50px; height: 50px; object-fit: cover; border-radius: 6px; border: 1px solid var(--light-gray);">
            </td>
            <td>
                <div style="font-weight: 600; color: var(--primary);">${terreno.titulo}</div>
            </td>
            <td>${terreno.ubicacion}</td>
            <td style="font-weight: 600; color: var(--accent);">
                ${terreno.moneda || 'Gs.'} ${formatoNumero(terreno.precio)}
            </td>
            <td>${formatoNumero(terreno.tamaño)} m²</td>
            <td>
                <span class="status-badge" style="
                    background: ${terreno.estado === 'disponible' ? 'var(--success)' : terreno.estado === 'reservado' ? 'var(--warning)' : 'var(--gray)'};
                    color: white;
                    padding: 4px 10px;
                    border-radius: 20px;
                    font-size: 0.85rem;
                    display: inline-block;
                ">
                    ${terreno.estado}
                </span>
            </td>
            <td style="font-size: 0.9rem; color: var(--gray);">${fecha}</td>
            <td>
                <div style="display: flex; gap: 8px;">
                    <button class="btn-secondary" 
                            onclick="editarTerreno('${terreno.id}')"
                            style="padding: 6px 12px; font-size: 0.85rem;">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-warning" 
                            onclick="eliminarTerrenoAdmin('${terreno.id}')"
                            style="background: var(--danger); padding: 6px 12px; font-size: 0.85rem; border: none; color: white; border-radius: 6px; cursor: pointer;">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        
        container.appendChild(row);
    });
}

function actualizarEstadisticasAdmin() {
    const total = terrenosAPI.getTotalTerrenos();
    const destacados = terrenosAPI.getTerrenosDestacados().length;
    const disponibles = terrenosAPI.getTerrenos().filter(t => t.estado === 'disponible').length;
    
    document.getElementById('totalTerrenosCount').textContent = total;
    document.getElementById('destacadosCount').textContent = destacados;
    document.getElementById('disponiblesCount').textContent = disponibles;
    document.getElementById('sysTotalTerrenos').textContent = total;
}

// ==================== CONFIGURACIÓN DE FORMULARIO ====================

function configurarFormulario() {
    const form = document.getElementById('propertyForm');
    if (!form) return;
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        console.log('📝 Iniciando guardado de terreno...');
        
        const datos = {
            titulo: document.getElementById('propTitle').value,
            ubicacion: document.getElementById('propLocation').value, // Este campo captura la ubicación
            precio: document.getElementById('propPrice').value,
            moneda: document.getElementById('propCurrency').value,
            tamaño: document.getElementById('propSize').value,
            descripcion: document.getElementById('propDescription').value,
            email: document.getElementById('propEmail').value,
            telefono: document.getElementById('propPhone').value,
            estado: document.getElementById('propEstado').value,
            destacado: document.getElementById('propDestacado').checked,
            mapaUrl: normalizeMapUrl(document.getElementById('propMapLink').value)
        };
        
        const imageInput = document.getElementById('propImages');
        const imagePreview = document.getElementById('imagePreview');

        // Preview de imágenes/videos en Admin
        setupMediaPreview('propImages', 'imagePreview');

if (imageInput && imageInput.files.length > 0) {
    const files = Array.from(imageInput.files).slice(0, 10); // podés subir hasta 10 (ajustable)

    console.log(`📎 Procesando ${files.length} archivos (imágenes/videos)...`);

    // Si hay videos, necesitamos Cloudinary configurado para subirlos (no usamos base64 para video)
    const contieneVideo = files.some(f => f.type && f.type.startsWith('video/'));

    const cloudinaryOk = (window.CLOUDINARY_CONFIG &&
        window.CLOUDINARY_CONFIG.cloud_name &&
        window.CLOUDINARY_CONFIG.cloud_name !== 'TU_CLOUD_NAME' &&
        window.cloudinaryUploader &&
        typeof window.cloudinaryUploader.uploadMultipleMedia === 'function');

    if (contieneVideo && !cloudinaryOk) {
        mostrarNotificacion('Para subir videos necesitás Cloudinary configurado (cloud_name y upload_preset).', 'error');
        return;
    }

    // Si Cloudinary está listo, subimos todo (imágenes y videos) y guardamos URLs
    if (cloudinaryOk) {
        const resultados = await window.cloudinaryUploader.uploadMultipleMedia(files);

        const media = [];
        const imagenes = [];

        resultados.forEach((r) => {
            if (r && r.success && r.url) {
                const tipo = r.resource_type || (r.url.match(/\.(mp4|webm|mov)(\?|$)/i) ? 'video' : 'image');

                if (tipo === 'video') {
                    // Poster automático (frame 0) si tenemos public_id
                    const poster = r.public_id
                        ? `https://res.cloudinary.com/${window.CLOUDINARY_CONFIG.cloud_name}/video/upload/so_0/${r.public_id}.jpg`
                        : '';

                    media.push({ type: 'video', url: r.url, poster });
                } else {
                    media.push({ type: 'image', url: r.url });
                    imagenes.push(r.url);
                }
            }
        });

        if (media.length > 0) {
            datos.media = media;
        }
        if (imagenes.length > 0) {
            datos.imagenes = imagenes; // solo imágenes para cards/listados existentes
        }

        console.log('☁️ Media guardada:', { media: media.length, imagenes: imagenes.length });

    } else {
        // Fallback sin Cloudinary: solo imágenes base64 (videos no)
        const images = [];
        for (const file of files) {
            if (file.type.startsWith('image/')) {
                const base64 = await convertirImagenABase64(file);
                if (base64) images.push(base64);
            }
        }

        if (images.length > 0) {
            datos.imagenes = images;
            console.log(`📦 ${images.length} imágenes en base64 (Cloudinary no configurado)`);
        }
    }

} else if (editandoId && imagePreview && imagePreview.children.length > 0) {
            const imagenesExistentes = [];
            imagePreview.querySelectorAll('img').forEach(img => {
                if (img.src && img.src.length > 0) {
                    imagenesExistentes.push(img.src);
                }
            });
            
            if (imagenesExistentes.length > 0) {
                datos.imagenes = imagenesExistentes;
                console.log(`🔄 Manteniendo ${imagenesExistentes.length} imágenes existentes`);
            }
        }
        
        if (!datos.titulo || !datos.ubicacion || !datos.precio || !datos.tamaño || !datos.moneda) {
            mostrarNotificacion('Por favor completa todos los campos requeridos', 'error');
            return;
        }
        
        if (!datos.imagenes || datos.imagenes.length === 0) {
            datos.imagenes = [APP_CONFIG.DEFAULT_IMAGES[0]];
            console.log('🖼️ Usando imagen por defecto');
        }
        
        console.log('📋 Datos a guardar:', {
            titulo: datos.titulo,
            moneda: datos.moneda,
            precio: datos.precio,
            imagenesCount: datos.imagenes ? datos.imagenes.length : 0
        });
        
        try {
            let resultado;
            
            if (editandoId) {
                console.log(`✏️ Actualizando terreno ${editandoId}...`);
                resultado = await terrenosAPI.actualizarTerreno(editandoId, datos);
            } else {
                console.log('➕ Agregando nuevo terreno...');
                resultado = await terrenosAPI.agregarTerreno(datos);
            }
            
            if (resultado.success) {
                mostrarNotificacion(resultado.message, 'success');
                console.log('✅ Terreno guardado exitosamente:', resultado.terreno.id);
                
                const terrenoGuardado = terrenosAPI.getTerrenoPorId(resultado.terreno.id);
                if (terrenoGuardado) {
                    console.log('💰 Moneda guardada:', terrenoGuardado.moneda);
                    console.log('🖼️ Imágenes guardadas en el terreno:', 
                        terrenoGuardado.imagenes ? terrenoGuardado.imagenes.length : 0);
                }
                
                propiedades = terrenosAPI.getTerrenos();
                limpiarFormulario();
                cargarTerrenosAdmin();
                actualizarEstadisticasAdmin();
                document.querySelector('[data-tab="listar"]').click();
                
            } else {
                console.error('❌ Error al guardar:', resultado.message);
                mostrarNotificacion(resultado.message, 'error');
            }
            
        } catch (error) {
            console.error('💥 Error crítico guardando terreno:', error);
            mostrarNotificacion('Error al guardar el terreno: ' + error.message, 'error');
        }
    });
    
    const cancelBtn = document.getElementById('cancelEditBtn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
            limpiarFormulario();
        });
    }
    
    const clearBtn = document.getElementById('clearFormBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', function() {
            if (confirm('¿Limpiar todos los campos del formulario?')) {
                limpiarFormulario();
            }
        });
    }
}

function convertirImagenABase64(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            resolve(e.target.result);
        };
        reader.onerror = function() {
            resolve(null);
        };
        reader.readAsDataURL(file);
    });
}

function limpiarFormulario() {
    document.getElementById('propTitle').value = '';
    document.getElementById('propLocation').value = '';
    document.getElementById('propPrice').value = '';
    document.getElementById('propCurrency').value = 'Gs.';
    document.getElementById('propSize').value = '';
    document.getElementById('propDescription').value = '';
    document.getElementById('propEmail').value = SITE_CONFIG.email;
    document.getElementById('propPhone').value = SITE_CONFIG.phone;
    document.getElementById('propEstado').value = 'disponible';
    document.getElementById('propDestacado').checked = false;
    document.getElementById('propMapLink').value = '';
    document.getElementById('propImages').value = '';
    document.getElementById('imagePreview').innerHTML = '';
    
    document.getElementById('cancelEditBtn').style.display = 'none';
    document.getElementById('submitPropertyBtn').innerHTML = '<i class="fas fa-save"></i> Guardar Terreno';
    
    editandoId = null;
}

// ==================== FUNCIONES DE EDICIÓN/ELIMINACIÓN ====================

async function editarTerreno(id) {
    const terreno = terrenosAPI.getTerrenoPorId(id);
    if (!terreno) {
        mostrarNotificacion('Terreno no encontrado', 'error');
        return;
    }
    
    document.getElementById('propTitle').value = terreno.titulo;
    document.getElementById('propLocation').value = terreno.ubicacion;
    document.getElementById('propPrice').value = terreno.precio;
    document.getElementById('propCurrency').value = terreno.moneda || 'Gs.';
    document.getElementById('propSize').value = terreno.tamaño;
    document.getElementById('propDescription').value = terreno.descripcion;
    document.getElementById('propEmail').value = terreno.email;
    document.getElementById('propPhone').value = terreno.telefono;
    document.getElementById('propEstado').value = terreno.estado;
    document.getElementById('propDestacado').checked = terreno.destacado;
    document.getElementById('propMapLink').value = terreno.mapaUrl || '';
    // Asegurar preview si el usuario vuelve a seleccionar archivos
    setupMediaPreview('propImages', 'imagePreview');
    
    const imagePreview = document.getElementById('imagePreview');
    if (imagePreview && terreno.imagenes && terreno.imagenes.length > 0) {
        imagePreview.innerHTML = '';
        terreno.imagenes.forEach((img, index) => {
            const imgElement = document.createElement('img');
            imgElement.src = img;
            imgElement.alt = `Imagen ${index + 1}`;
            imgElement.style.width = '100px';
            imgElement.style.height = '100px';
            imgElement.style.objectFit = 'cover';
            imgElement.style.borderRadius = '8px';
            imagePreview.appendChild(imgElement);
        });
    }
    
    document.getElementById('cancelEditBtn').style.display = 'inline-flex';
    document.getElementById('submitPropertyBtn').innerHTML = '<i class="fas fa-save"></i> Actualizar Terreno';
    
    editandoId = id;
    document.querySelector('[data-tab="agregar"]').click();
}

async function eliminarTerrenoAdmin(id) {
    if (!confirm('¿Estás seguro de eliminar este terreno?')) return;
    
    const resultado = await terrenosAPI.borrarTerreno(id);
    if (resultado.success) {
        mostrarNotificacion(resultado.message, 'success');
        
        propiedades = terrenosAPI.getTerrenos();
        cargarTerrenosAdmin();
        actualizarEstadisticasAdmin();
    } else {
        mostrarNotificacion(resultado.message, 'error');
    }
}

// ==================== CONFIGURACIÓN DE TABS ====================

function configurarTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    
    tabButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            tabButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            const tabContents = document.querySelectorAll('.tab-content');
            tabContents.forEach(content => content.classList.remove('active'));
            
            const tabId = this.getAttribute('data-tab');
            const targetTab = document.getElementById(`tab-${tabId}`);
            if (targetTab) {
                targetTab.classList.add('active');
            }
        });
    });
    
    const adminSearch = document.getElementById('adminSearchInput');
    if (adminSearch) {
        adminSearch.addEventListener('input', function() {
            buscarTerrenosAdmin(this.value);
        });
    }
}

function buscarTerrenosAdmin(query) {
    const tableBody = document.getElementById('adminPropertiesTable');
    if (!tableBody) return;
    
    const rows = tableBody.querySelectorAll('tr');
    const busqueda = query.toLowerCase().trim();
    
    if (!busqueda) {
        rows.forEach(row => row.style.display = '');
        return;
    }
    
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        let mostrar = false;
        
        cells.forEach(cell => {
            if (cell.textContent.toLowerCase().includes(busqueda)) {
                mostrar = true;
            }
        });
        
        row.style.display = mostrar ? '' : 'none';
    });
}

// ==================== CONFIGURACIÓN DE SISTEMA ====================

function configurarSistema() {
    const clearCacheBtn = document.getElementById('clearCacheBtn');
    if (clearCacheBtn) {
        clearCacheBtn.addEventListener('click', function() {
            if (confirm('¿Estás seguro de limpiar todos los datos? Esta acción no se puede deshacer.')) {
                const resultado = terrenosAPI.limpiarCache();
                if (resultado.success) {
                    mostrarNotificacion('Datos limpiados correctamente', 'success');
                    propiedades = [];
                    cargarTerrenosAdmin();
                    actualizarEstadisticasAdmin();
                } else {
                    mostrarNotificacion('Error al limpiar datos: ' + resultado.error, 'error');
                }
            }
        });
    }
}

// ==================== CONFIGURACIÓN IMPORTACIÓN/EXPORTACIÓN ====================

function configurarImportacionExportacion() {
    const exportBtn = document.getElementById('exportJSONBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', function() {
            const resultado = terrenosAPI.exportarJSON();
            if (resultado.success) {
                mostrarNotificacion(resultado.message, 'success');
            } else {
                mostrarNotificacion(resultado.message, 'error');
            }
        });
    }
    
    const serverJsonBtn = document.getElementById('serverJSONBtn');
    if (serverJsonBtn) {
        serverJsonBtn.addEventListener('click', function() {
            const resultado = terrenosAPI.generarJSONParaServidor();
            if (resultado.success) {
                mostrarNotificacion(resultado.message, 'success');
                alert(`✅ data.json generado correctamente.\n\n📋 INSTRUCCIONES PARA SUBIR AL SERVIDOR:\n\n1. Descarga el archivo "data.json"\n2. Súbelo a la raíz de tu sitio web\n3. Reemplaza el archivo anterior\n\nLas imágenes deben subirse manualmente a la carpeta "assets/images/"`);
            } else {
                mostrarNotificacion(resultado.message, 'error');
            }
        });
    }
    
    const importBtn = document.getElementById('importJSONBtn');
    const importFile = document.getElementById('importJSONFile');
    
    if (importBtn && importFile) {
        importBtn.addEventListener('click', function() {
            importFile.click();
        });
        
        importFile.addEventListener('change', async function(e) {
            const file = e.target.files[0];
            if (!file) return;
            
            if (!file.name.endsWith('.json')) {
                mostrarNotificacion('Solo se permiten archivos JSON', 'error');
                return;
            }
            
            if (confirm('¿Importar datos desde JSON? Esto reemplazará todos los terrenos actuales.')) {
                const resultado = await terrenosAPI.importarJSON(file);
                if (resultado.success) {
                    mostrarNotificacion(resultado.message, 'success');
                    propiedades = terrenosAPI.getTerrenos();
                    cargarTerrenosAdmin();
                    actualizarEstadisticasAdmin();
                } else {
                    mostrarNotificacion(resultado.message, 'error');
                }
                
                importFile.value = '';
            }
        });
    }
}

// ==================== CONFIGURACIÓN CARGA POR LOTES ====================

/**
 * Genera el HTML para un grupo de carga por lotes. Este grupo incluye los
 * mismos campos que el formulario individual de terreno: título, ubicación,
 * precio, moneda, tamaño, descripción, email, teléfono, mapa, destacado e
 * imágenes. Los atributos `name` y los IDs se ajustan según el índice para
 * asegurar que cada grupo sea independiente.
 *
 * @param {number} index Índice del grupo (0, 1, 2, ...)
 * @returns {string} Cadena HTML con el contenido del grupo
 */
function createBatchGroupHTML(index) {
    const emailDefault = (window.SITE_CONFIG && SITE_CONFIG.email) ? SITE_CONFIG.email : '';
    const phoneDefault = (window.SITE_CONFIG && SITE_CONFIG.phone) ? SITE_CONFIG.phone : '';
    return `
        <h4>Terreno ${index + 1} <button type="button" class="remove-batch" onclick="removeBatchGroup(this)">×</button></h4>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
            <div>
                <label style="display: block; margin-bottom: 5px; font-weight: 600; color: var(--dark);">Título *</label>
                <input type="text" name="batchTitle${index}" class="batch-input" required placeholder="Título del terreno">
            </div>
            <div>
                <label style="display: block; margin-bottom: 5px; font-weight: 600; color: var(--dark);">Ubicación *</label>
                <input type="text" name="batchLocation${index}" class="batch-input" required placeholder="Ubicación del terreno">
            </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
            <div>
                <label style="display: block; margin-bottom: 5px; font-weight: 600; color: var(--dark);">Precio *</label>
                <input type="number" name="batchPrice${index}" class="batch-input" required min="0" placeholder="Precio">
            </div>
            <div>
                <label style="display: block; margin-bottom: 5px; font-weight: 600; color: var(--dark);">Moneda *</label>
                <select name="batchCurrency${index}" class="batch-input" required>
                    <option value="Gs." selected>Guaraníes (Gs.)</option>
                    <option value="USD">Dólares (USD)</option>
                </select>
            </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
            <div>
                <label style="display: block; margin-bottom: 5px; font-weight: 600; color: var(--dark);">Tamaño (m²) *</label>
                <input type="number" name="batchSize${index}" class="batch-input" required min="0" placeholder="Tamaño en m²">
            </div>
            <div>
                <label style="display: block; margin-bottom: 5px; font-weight: 600; color: var(--dark);">Estado</label>
                <select name="batchStatus${index}" class="batch-input">
                    <option value="disponible">Disponible</option>
                    <option value="reservado">Reservado</option>
                    <option value="vendido">Vendido</option>
                </select>
            </div>
        </div>
        <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; font-weight: 600; color: var(--dark);">Descripción</label>
            <textarea name="batchDescription${index}" class="batch-input" rows="2" placeholder="Descripción del terreno"></textarea>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
            <div>
                <label style="display: block; margin-bottom: 5px; font-weight: 600; color: var(--dark);">Email de contacto</label>
                <input type="email" name="batchEmail${index}" class="batch-input" placeholder="correo@ejemplo.com" value="${emailDefault}">
            </div>
            <div>
                <label style="display: block; margin-bottom: 5px; font-weight: 600; color: var(--dark);">Teléfono</label>
                <input type="tel" name="batchPhone${index}" class="batch-input" placeholder="+595985282935" value="${phoneDefault}">
            </div>
        </div>
        <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; font-weight: 600; color: var(--dark);">Enlace de Google Maps</label>
            <input type="url" name="batchMapLink${index}" class="batch-input" placeholder="https://maps.google.com/?q=-25.2820,-57.6351">
        </div>
        <div style="display: flex; gap: 20px; align-items: center; flex-wrap: wrap;">
            <div>
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <input type="checkbox" name="batchFeatured${index}">
                    <span style="font-weight: 600; color: var(--dark);">Destacado</span>
                </label>
            </div>
        </div>
        <div style="margin-top: 15px;">
            <label style="display: block; margin-bottom: 5px; font-weight: 600; color: var(--dark);"><i class="fas fa-images"></i> Imágenes (opcional)</label>
            <input type="file" name="batchImages${index}" accept="image/*" multiple class="batch-input">
            <div id="batchImagePreview${index}" class="image-preview-container"></div>
        </div>`;
}


function configurarCargaPorLotes() {
    const batchForm = document.getElementById('batchForm');
    const batchContainer = document.getElementById('batchContainer');
    const addBtn = document.getElementById('addBatchBtn');
    const clearBtn = document.getElementById('clearBatchBtn');

    if (!batchForm || !batchContainer) return;

    // Configurar vista previa de imágenes para el primer grupo por defecto
    setupMediaPreview('batchImages0', 'batchImagePreview0');

    // Permitir remover grupos desde el botón "×"
    window.removeBatchGroup = function(button) {
        const group = button.closest('.batch-group');
        if (!group) return;
        const groups = batchContainer.querySelectorAll('.batch-group');
        if (groups.length > 1) {
            group.remove();
            updateBatchNumbers();
        }
    };

    // Actualiza los números de los grupos y los atributos name/ids correspondientes
    function updateBatchNumbers() {
        const groups = batchContainer.querySelectorAll('.batch-group');
        groups.forEach((group, idx) => {
            // Actualizar título y botón
            const titleEl = group.querySelector('h4');
            if (titleEl) {
                titleEl.innerHTML = `Terreno ${idx + 1} <button type="button" class="remove-batch" onclick="removeBatchGroup(this)">×</button>`;
            }
            // Actualizar atributos name de inputs y selects
            group.querySelectorAll('[name]').forEach(input => {
                const oldName = input.getAttribute('name');
                if (!oldName) return;
                const newName = oldName.replace(/\d+$/, idx);
                input.setAttribute('name', newName);
            });
            // Actualizar ids de contenedor de previsualización de imágenes
            group.querySelectorAll('[id^="batchImagePreview"]').forEach(preview => {
                const newId = `batchImagePreview${idx}`;
                if (preview.id !== newId) {
                    preview.id = newId;
                }
            });
        });
    }

    // Agregar un nuevo grupo de carga por lotes
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            const index = batchContainer.querySelectorAll('.batch-group').length;
            const group = document.createElement('div');
            group.className = 'batch-group';
            group.innerHTML = createBatchGroupHTML(index);
            batchContainer.appendChild(group);
            // Configurar vista previa para el nuevo input de imágenes
            setupMediaPreview(`batchImages${index}`, `batchImagePreview${index}`);
            updateBatchNumbers();
        });
    }

    // Limpiar todos los grupos (excepto el primero) y reiniciar campos
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (confirm('¿Limpiar todos los campos del lote?')) {
                const groups = batchContainer.querySelectorAll('.batch-group');
                groups.forEach((group, idx) => {
                    if (idx > 0) {
                        group.remove();
                    } else {
                        group.querySelectorAll('input, textarea, select').forEach(input => {
                            if (input.type === 'checkbox') {
                                input.checked = false;
                            } else if (input.type === 'select-one') {
                                if (input.name && input.name.includes('Status')) {
                                    input.value = 'disponible';
                                } else if (input.name && input.name.includes('Currency')) {
                                    input.value = 'Gs.';
                                }
                            } else {
                                input.value = '';
                            }
                        });
                        // Limpiar previsualización
                        const preview = group.querySelector('[id^="batchImagePreview"]');
                        if (preview) preview.innerHTML = '';
                    }
                });
                updateBatchNumbers();
            }
        });
    }

    // Procesamiento del formulario de carga por lotes
    batchForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const groups = batchContainer.querySelectorAll('.batch-group');
        if (groups.length === 0) {
            mostrarNotificacion('Agrega al menos un terreno', 'error');
            return;
        }
        let exitosos = 0;
        let fallidos = 0;
        for (let idx = 0; idx < groups.length; idx++) {
            const group = groups[idx];
            const title = group.querySelector(`[name="batchTitle${idx}"]`)?.value.trim();
            const location = group.querySelector(`[name="batchLocation${idx}"]`)?.value.trim();
            const price = group.querySelector(`[name="batchPrice${idx}"]`)?.value;
            const currency = group.querySelector(`[name="batchCurrency${idx}"]`)?.value || 'Gs.';
            const size = group.querySelector(`[name="batchSize${idx}"]`)?.value;
            const description = group.querySelector(`[name="batchDescription${idx}"]`)?.value.trim();
            const status = group.querySelector(`[name="batchStatus${idx}"]`)?.value;
            const featured = group.querySelector(`[name="batchFeatured${idx}"]`)?.checked;
            const email = group.querySelector(`[name="batchEmail${idx}"]`)?.value.trim();
            const phone = group.querySelector(`[name="batchPhone${idx}"]`)?.value.trim();
            const mapLink = group.querySelector(`[name="batchMapLink${idx}"]`)?.value.trim();
            // Validaciones
            if (!title || !location || !price || !size) {
                mostrarNotificacion(`Faltan campos requeridos en Terreno ${idx + 1}`, 'error');
                fallidos++;
                continue;
            }
            const datos = {
                titulo: title,
                ubicacion: location,
                precio: parseInt(price),
                moneda: currency,
                tamaño: parseInt(size),
                descripcion: description || '',
                estado: status || 'disponible',
                destacado: featured || false,
                email: email || SITE_CONFIG.email,
                telefono: phone || SITE_CONFIG.phone,
                mapaUrl: normalizeMapUrl(mapLink)
            };
            // Procesar imágenes (solo imágenes, no videos en carga masiva)
            const imageInput = group.querySelector(`[name="batchImages${idx}"]`);
            if (imageInput && imageInput.files && imageInput.files.length > 0) {
                const files = Array.from(imageInput.files).filter(f => f.type && f.type.startsWith('image/'));
                const base64s = [];
                for (const file of files) {
                    const base64 = await convertirImagenABase64(file);
                    if (base64) base64s.push(base64);
                }
                if (base64s.length > 0) {
                    datos.imagenes = base64s;
                }
            }
            const result = await terrenosAPI.agregarTerreno(datos);
            if (result && result.success) {
                exitosos++;
            } else {
                fallidos++;
            }
        }
        // Mostrar notificación final
        mostrarNotificacion(`Lote procesado: ${exitosos} exitosos, ${fallidos} fallidos`, fallidos > 0 ? 'warning' : 'success');
        propiedades = terrenosAPI.getTerrenos();
        cargarTerrenosAdmin();
        actualizarEstadisticasAdmin();
        // Limpiar formulario después de procesar
        if (clearBtn) clearBtn.click();
    });
}

// ==================== DETALLE DE PROPIEDAD ====================

function inicializarDetalle() {
    const urlParams = new URLSearchParams(window.location.search);
    const terrenoId = urlParams.get('id');
    
    if (!terrenoId) {
        window.location.href = 'index.html';
        return;
    }
    
    const terreno = terrenosAPI.getTerrenoPorId(terrenoId);
    
    if (!terreno) {
        document.body.innerHTML = `
            <div style="text-align: center; padding: 100px 20px;">
                <h1>Terreno no encontrado</h1>
                <p>El terreno que buscas no existe o ha sido eliminado.</p>
                <a href="index.html" class="btn-primary">Volver al inicio</a>
            </div>
        `;
        return;
    }
    
    console.log('🔍 Cargando detalle del terreno:', {
        id: terreno.id,
        titulo: terreno.titulo,
        ubicacion: terreno.ubicacion, // <-- Se muestra la ubicación
        moneda: terreno.moneda || 'Gs.',
        totalImagenes: terreno.imagenes ? terreno.imagenes.length : 0
    });
    
    // Actualizar datos en la página
    setTextSafe('detailTitle', terreno.titulo);
    setTextSafe('detailLocationShort', terreno.ubicacion);
    setTextSafe('detailPrice', formatoPrecio(terreno.precio, terreno.moneda || 'Gs.'));
    setTextSafe('detailDescription', terreno.descripcion);

    const whatsappMessage = encodeURIComponent(`Hola, estoy interesado en el terreno: "${terreno.titulo}" ubicado en ${terreno.ubicacion}. Precio: ${formatoPrecio(terreno.precio, terreno.moneda || 'Gs.')}.`);
    const whatsappUrl = `https://wa.me/${APP_CONFIG.WHATSAPP}?text=${whatsappMessage}`;
    
    setAttrSafe('detailContactBtn','href', whatsappUrl);
    setAttrSafe('sidebarContactBtn','href', whatsappUrl);
    
    setTextSafe('quickSize', `${formatoNumero(terreno.tamaño)} m²`);
    setTextSafe('quickStatus', terreno.estado ? (terreno.estado.charAt(0).toUpperCase() + terreno.estado.slice(1)) : 'Disponible');
    setTextSafe('quickDate', APP_CONFIG.formatDate(terreno.fechaCreacion));
    setTextSafe('quickCurrency', terreno.moneda || 'Gs.');
    setTextSafe('quickCategory', terreno.categoria || 'General');
    
    if (terreno.mapaUrl && String(terreno.mapaUrl).trim() !== '') {
        const mapa = normalizeMapUrl(terreno.mapaUrl);
        const mapEl = document.getElementById('detailMap');
        if (mapEl) mapEl.src = mapa;
    }
    
    // 🎯 Cargar imágenes para el carrusel
    
// Carrusel: soporta imágenes y videos (media), con compatibilidad para imagenes[]
let itemsParaCarrusel = [];

if (terreno.media && Array.isArray(terreno.media) && terreno.media.length > 0) {
    console.log('🎬 Media disponible:', terreno.media.length);
    itemsParaCarrusel = terreno.media;
} else if (terreno.imagenes && terreno.imagenes.length > 0) {
    console.log('🖼️ Imágenes disponibles:', terreno.imagenes.length);
    itemsParaCarrusel = terreno.imagenes;
}

console.log('🎠 Inicializando carrusel con', itemsParaCarrusel.length, 'items');
initCarousel(itemsParaCarrusel, 'carouselTrack', 'carouselDots');
    
    // Actualizar características
    const featuresContainer = document.getElementById('propertyFeatures');
    if (featuresContainer) {
        featuresContainer.innerHTML = `
            <div class="feature-item">
                <i class="fas fa-expand"></i>
                <div>
                    <strong>Superficie:</strong>
                    <span>${formatoNumero(terreno.tamaño)} m²</span>
                </div>
            </div>
            <div class="feature-item">
                <i class="fas fa-flag"></i>
                <div>
                    <strong>Estado:</strong>
                    <span>${terreno.estado.charAt(0).toUpperCase() + terreno.estado.slice(1)}</span>
                </div>
            </div>
            <div class="feature-item">
                <i class="fas fa-star"></i>
                <div>
                    <strong>Destacado:</strong>
                    <span>${terreno.destacado ? 'Sí' : 'No'}</span>
                </div>
            </div>
            <div class="feature-item">
                <i class="fas fa-money-bill-wave"></i>
                <div>
                    <strong>Moneda:</strong>
                    <span>${terreno.moneda || 'Gs.'}</span>
                </div>
            </div>
        `;
    }
}

// ==================== MEJORAS DE RESPONSIVIDAD ====================

function mejorarResponsividad() {
    const width = window.innerWidth;
    const grid = document.querySelector('.properties-grid');
    
    if (grid) {
        if (width < 768) {
            grid.style.gridTemplateColumns = '1fr';
        } else if (width < 1024) {
            grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(300px, 1fr))';
        } else {
            grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(350px, 1fr))';
        }
    }
}

// ==================== FUNCIONES GLOBALES ====================

window.editarTerreno = editarTerreno;
window.eliminarTerrenoAdmin = eliminarTerrenoAdmin;

console.log('✅ Script principal cargado correctamente');