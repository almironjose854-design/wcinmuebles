// server.js - Servidor HTTP para Terrenos PY
// Este servidor sirve los archivos estáticos de la aplicación y expone
// una API REST simple para leer y actualizar el archivo data.json que
// contiene las propiedades (terrenos).  Está pensado para uso en
// producción para alojar la página y permitir que el panel de
// administración persista cambios directamente en el servidor.

const http = require('http');
const fs = require('fs');
const path = require('path');

const port = process.env.PORT || 3000;
const baseDir = __dirname;

// Mapeo de extensiones a tipos MIME básicos
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

function sendResponse(res, statusCode, data, type) {
  res.statusCode = statusCode;
  if (type) {
    res.setHeader('Content-Type', type);
  }
  res.end(data);
}

// Lee data.json de disco y envía su contenido como JSON
function handleGetData(req, res) {
  const dataPath = path.join(baseDir, 'data.json');
  fs.readFile(dataPath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading data.json:', err);
      sendResponse(res, 500, JSON.stringify({ error: 'Error leyendo data.json' }), 'application/json');
      return;
    }
    sendResponse(res, 200, data, 'application/json');
  });
}

// Reemplaza data.json con el cuerpo enviado
function handlePutData(req, res) {
  let body = '';
  req.on('data', chunk => {
    body += chunk;
    // Evitar ataques de petición demasiado grande
    if (body.length > 10 * 1024 * 1024) {
      // 10 MB como límite
      sendResponse(res, 413, JSON.stringify({ error: 'Payload demasiado grande' }), 'application/json');
      req.connection.destroy();
    }
  });
  req.on('end', () => {
    try {
      const json = JSON.parse(body);
      // Debe ser un objeto con propiedad "terrenos" que sea un array
      if (!json || typeof json !== 'object' || !Array.isArray(json.terrenos)) {
        throw new Error('Formato JSON inválido');
      }
      const dataToSave = JSON.stringify(json, null, 2);
      const dataPath = path.join(baseDir, 'data.json');
      fs.writeFile(dataPath, dataToSave, 'utf8', (err) => {
        if (err) {
          console.error('Error writing data.json:', err);
          sendResponse(res, 500, JSON.stringify({ error: 'Error guardando data.json' }), 'application/json');
          return;
        }
        sendResponse(res, 200, JSON.stringify({ success: true }), 'application/json');
      });
    } catch (e) {
      console.error('Invalid JSON in PUT /api/data:', e.message);
      sendResponse(res, 400, JSON.stringify({ error: 'JSON inválido' }), 'application/json');
    }
  });
}

// Servir archivos estáticos
function serveStatic(req, res) {
  // Normalize URL (remove query string)
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') {
    reqPath = '/index.html';
  }
  const filePath = path.join(baseDir, decodeURIComponent(reqPath));
  // Prevenir acceso fuera del directorio base
  if (!filePath.startsWith(baseDir)) {
    sendResponse(res, 403, 'Forbidden', 'text/plain');
    return;
  }
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Archivo no encontrado
      sendResponse(res, 404, 'Not Found', 'text/plain');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    fs.readFile(filePath, (err, data) => {
      if (err) {
        console.error('Error reading file:', filePath, err);
        sendResponse(res, 500, 'Internal Server Error', 'text/plain');
        return;
      }
      sendResponse(res, 200, data, contentType);
    });
  });
}

const server = http.createServer((req, res) => {
  const { method, url } = req;
  // Manejo de CORS para permitir peticiones desde el mismo origen
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (url.startsWith('/api/data')) {
    if (method === 'GET') {
      handleGetData(req, res);
      return;
    } else if (method === 'PUT') {
      handlePutData(req, res);
      return;
    } else {
      sendResponse(res, 405, JSON.stringify({ error: 'Método no permitido' }), 'application/json');
      return;
    }
  }
  // Si no es API, servir archivos estáticos
  serveStatic(req, res);
});

server.listen(port, () => {
  console.log(`Servidor iniciado en http://localhost:${port}`);
});