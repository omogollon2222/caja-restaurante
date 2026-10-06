// Script de Google para que la app del restaurante guarde archivos en Google Drive.
// 1) Pega este código en script.google.com (Proyecto nuevo) con la cuenta dueña de la carpeta.
// 2) Cambia CLAVE por una palabra secreta y escribe la misma clave en la app (Administrador > Configuración y Drive).
// 3) Implementar > Nueva implementación > Aplicación web. Ejecutar como: Yo. Acceso: Cualquier usuario.
// 4) Copia la URL de la aplicación web y pégala en la app.

const CLAVE = 'cambia-esta-clave';
const CARPETA = 'Quinta Josaid';

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.token !== CLAVE) return salida_({ ok: false, error: 'token' });
    const raiz = carpeta_(CARPETA, null);
    const destino = carpeta_(d.sub || 'General', raiz);
    let archivo;
    if (d.tipo === 'hoja') {
      archivo = hoja_(destino, d.nombre, d.filas || []);
    } else {
      const blob = Utilities.newBlob(Utilities.base64Decode(d.base64), d.mime || 'application/octet-stream', d.nombre);
      const viejos = destino.getFilesByName(d.nombre);
      while (viejos.hasNext()) viejos.next().setTrashed(true);
      archivo = destino.createFile(blob);
    }
    return salida_({ ok: true, url: archivo.getUrl(), id: archivo.getId() });
  } catch (err) {
    return salida_({ ok: false, error: String(err) });
  }
}

function doGet() {
  return salida_({ ok: true, mensaje: 'Script de Drive del restaurante activo' });
}

function carpeta_(nombre, padre) {
  const it = padre ? padre.getFoldersByName(nombre) : DriveApp.getFoldersByName(nombre);
  if (it.hasNext()) return it.next();
  return padre ? padre.createFolder(nombre) : DriveApp.createFolder(nombre);
}

function hoja_(destino, nombre, filas) {
  let ss;
  const it = destino.getFilesByName(nombre);
  if (it.hasNext()) {
    ss = SpreadsheetApp.openById(it.next().getId());
  } else {
    ss = SpreadsheetApp.create(nombre);
    DriveApp.getFileById(ss.getId()).moveTo(destino);
  }
  const sh = ss.getSheets()[0];
  sh.clear();
  if (filas.length) {
    const ancho = Math.max.apply(null, filas.map(function (f) { return f.length; }));
    const datos = filas.map(function (f) { const r = f.slice(); while (r.length < ancho) r.push(''); return r; });
    sh.getRange(1, 1, datos.length, ancho).setValues(datos);
    sh.getRange(1, 1, 1, ancho).setFontWeight('bold').setBackground('#d6efdf');
    sh.setFrozenRows(1);
    sh.autoResizeColumns(1, ancho);
  }
  return DriveApp.getFileById(ss.getId());
}

function salida_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
