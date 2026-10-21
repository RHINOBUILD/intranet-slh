/**
 * Almacenamiento en Google Sheets (una hoja por tabla) y archivos en una carpeta privada de Drive.
 * La hoja de cálculo y la carpeta pertenecen a la cuenta que publica la web app y NO deben compartirse:
 * los usuarios acceden únicamente a través de la aplicación, que aplica los permisos.
 */

const TABLES_ = {
  records: ['id', 'kind', 'title', 'company', 'site', 'category', 'status', 'owner', 'due', 'notes', 'payload', 'folio',
    'createdAt', 'updatedAt', 'createdBy', 'updatedBy', 'revision'],
  audit: ['id', 'recordId', 'kind', 'title', 'action', 'actor', 'at'],
  attachments: ['id', 'recordId', 'name', 'fileId', 'mime', 'size', 'createdAt', 'createdBy'],
  movements: ['id', 'recordId', 'type', 'quantity', 'recipient', 'notes', 'actor', 'at'],
  access: ['email', 'name', 'role', 'companies', 'sites', 'active', 'admin', 'updatedAt', 'updatedBy'],
  settings: ['key', 'value'],
};

const SHEET_NAMES_ = {
  records: 'Registros', audit: 'Bitácora', attachments: 'Adjuntos', movements: 'Movimientos', access: 'Accesos', settings: 'Ajustes',
};

function props_() {
  return PropertiesService.getScriptProperties();
}

function spreadsheet_() {
  var id = props_().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('La plataforma aún no está instalada. Ejecuta la función "instalar" desde el editor de Apps Script.');
  return SpreadsheetApp.openById(id);
}

function folder_() {
  var id = props_().getProperty('FOLDER_ID');
  if (!id) throw new Error('La plataforma aún no está instalada.');
  return DriveApp.getFolderById(id);
}

function sheet_(table) {
  var sh = spreadsheet_().getSheetByName(SHEET_NAMES_[table]);
  if (!sh) throw new Error('Falta la hoja "' + SHEET_NAMES_[table] + '". Ejecuta "instalar" de nuevo.');
  return sh;
}

function cellValue_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, APP_TZ, "yyyy-MM-dd'T'HH:mm:ss");
  return v === null || v === undefined ? '' : String(v);
}

/** Lee una tabla completa como lista de objetos (todos los valores como texto). */
function readTable_(table) {
  var cols = TABLES_[table];
  var sh = sheet_(table);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var values = sh.getRange(2, 1, last - 1, cols.length).getValues();
  var out = [];
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    if (row[0] === '' || row[0] === null) continue;
    var o = { _row: i + 2 };
    for (var c = 0; c < cols.length; c++) o[cols[c]] = cellValue_(row[c]);
    out.push(o);
  }
  return out;
}

function toRow_(table, obj) {
  return TABLES_[table].map(function (c) {
    var v = obj[c];
    return v === null || v === undefined ? '' : String(v);
  });
}

function appendRow_(table, obj) {
  var sh = sheet_(table);
  var row = toRow_(table, obj);
  var r = sh.getLastRow() + 1;
  var range = sh.getRange(r, 1, 1, row.length);
  range.setNumberFormat('@');
  range.setValues([row]);
}

function updateRow_(table, rowIndex, obj) {
  var row = toRow_(table, obj);
  var range = sheet_(table).getRange(rowIndex, 1, 1, row.length);
  range.setNumberFormat('@');
  range.setValues([row]);
}

function deleteRows_(table, rowIndexes) {
  var sh = sheet_(table);
  rowIndexes.slice().sort(function (a, b) { return b - a; }).forEach(function (r) { sh.deleteRow(r); });
}

function findBy_(table, key, value) {
  var rows = readTable_(table);
  for (var i = 0; i < rows.length; i++) if (rows[i][key] === value) return rows[i];
  return null;
}

function nowIso_() {
  return new Date().toISOString();
}

function today_() {
  return Utilities.formatDate(new Date(), APP_TZ, 'yyyy-MM-dd');
}

function uuid_() {
  return Utilities.getUuid();
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('La plataforma está ocupada guardando otro cambio. Intenta de nuevo en unos segundos.');
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function parsePayload_(text) {
  try {
    var p = JSON.parse(text || '{}');
    return p && typeof p === 'object' && !Array.isArray(p) ? p : {};
  } catch (e) {
    return {};
  }
}

/** Registro de la hoja → objeto para la aplicación. */
function recordOut_(r) {
  return {
    id: r.id, kind: r.kind, title: r.title, company: r.company, site: r.site, status: r.status, owner: r.owner,
    due: r.due, notes: r.notes, payload: parsePayload_(r.payload), folio: r.folio, createdAt: r.createdAt,
    updatedAt: r.updatedAt, createdBy: r.createdBy, updatedBy: r.updatedBy, revision: Number(r.revision) || 1,
  };
}

function nextFolio_(prefix) {
  var year = today_().slice(0, 4);
  var key = 'folio:' + prefix + ':' + year;
  var rows = readTable_('settings');
  var found = null;
  for (var i = 0; i < rows.length; i++) if (rows[i].key === key) found = rows[i];
  var n = found ? Number(found.value) + 1 : 1;
  if (found) updateRow_('settings', found._row, { key: key, value: n });
  else appendRow_('settings', { key: key, value: n });
  return prefix + '-' + year + '-' + ('000' + n).slice(-4);
}

function logAudit_(recordId, kind, title, action, actor) {
  appendRow_('audit', { id: uuid_(), recordId: recordId, kind: kind, title: title, action: String(action).slice(0, 500), actor: actor, at: nowIso_() });
}

/**
 * Instalación: crea la hoja de cálculo y la carpeta de adjuntos en el Drive de quien la ejecuta.
 * Ejecútala una sola vez desde el editor de Apps Script. Si ya está instalada, solo completa lo que falte.
 */
function instalar() {
  var active = Session.getActiveUser().getEmail();
  var effective = Session.getEffectiveUser().getEmail();
  if (!active || !effective || active.toLowerCase() !== effective.toLowerCase()) {
    throw new Error('Solo la cuenta propietaria puede instalar la plataforma.');
  }
  var p = props_();
  var ss;
  if (p.getProperty('SPREADSHEET_ID')) ss = SpreadsheetApp.openById(p.getProperty('SPREADSHEET_ID'));
  else {
    ss = SpreadsheetApp.create('Capital Humano · Base de datos (no compartir)');
    p.setProperty('SPREADSHEET_ID', ss.getId());
  }
  Object.keys(TABLES_).forEach(function (table) {
    var name = SHEET_NAMES_[table];
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    var cols = TABLES_[table];
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
    sh.getRange(1, 1, sh.getMaxRows(), cols.length).setNumberFormat('@');
    sh.setFrozenRows(1);
  });
  var first = ss.getSheets()[0];
  if (first && Object.keys(SHEET_NAMES_).map(function (k) { return SHEET_NAMES_[k]; }).indexOf(first.getName()) === -1 && first.getLastRow() === 0) {
    ss.deleteSheet(first);
  }
  if (!p.getProperty('FOLDER_ID')) {
    var folder = DriveApp.createFolder('Capital Humano · Adjuntos (no compartir)');
    p.setProperty('FOLDER_ID', folder.getId());
  }
  if (!p.getProperty('RH_OWNER_EMAILS')) p.setProperty('RH_OWNER_EMAILS', effective);
  return 'Instalación lista. Hoja: ' + ss.getUrl();
}
