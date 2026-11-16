/**
 * Importación de la versión anterior de la intranet (hoja "EVA DESEMPEÑO SLH" o similar).
 *   Empleados   → Padrón de colaboradores
 *   Solicitudes → Permisos y vacaciones
 *   Vacantes    → Cobertura de vacantes
 * Solo la persona titular puede ejecutarla. Primero se revisa (sin guardar) y después se importa.
 * Es repetible: cada fila importada guarda su origen y no se duplica si se vuelve a correr.
 */

const LEGACY_TABS_ = { empleados: 'Empleados', solicitudes: 'Solicitudes', vacantes: 'Vacantes' };
const IMPORT_NOTE_ = 'Importado de la versión anterior de la intranet.';

function key_(s) {
  return String(s === null || s === undefined ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
}

function legacyId_(v) {
  if (!v) return '';
  var s = String(v).trim();
  var m = s.match(/\/d\/([a-zA-Z0-9_-]{20,})/);
  if (m) return m[1];
  return /^[a-zA-Z0-9_-]{20,}$/.test(s) ? s : '';
}

/** Fecha de la hoja anterior → yyyy-MM-dd ('' si no se reconoce). */
var LEGACY_TZ_ = ''; // zona horaria de la hoja anterior: Sheets entrega las fechas a medianoche en esa zona

function legacyDate_(v) {
  if (v instanceof Date) return isNaN(v.getTime()) ? '' : Utilities.formatDate(v, LEGACY_TZ_ || APP_TZ, 'yyyy-MM-dd');
  var s = String(v || '').trim();
  var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
  m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  return '';
}

function legacyText_(v, max) {
  if (v instanceof Date) return legacyDate_(v);
  return String(v === null || v === undefined ? '' : v).trim().slice(0, max || 1000);
}

/** Lee una pestaña como objetos con encabezados normalizados (sin acentos ni espacios). */
function legacyRows_(ss, wanted) {
  var sh = null;
  ss.getSheets().forEach(function (s) { if (!sh && key_(s.getName()) === key_(wanted)) sh = s; });
  if (!sh) return null;
  var lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];
  var values = sh.getRange(1, 1, lastRow, lastCol).getValues();
  var head = values[0].map(key_);
  var out = [];
  for (var i = 1; i < values.length; i++) {
    var o = { _row: i + 1 }, any = false;
    head.forEach(function (h, c) {
      if (!h) return;
      o[h] = values[i][c];
      if (values[i][c] !== '' && values[i][c] !== null) any = true;
    });
    if (any) out.push(o);
  }
  return out;
}

function pick_(row, names) {
  for (var i = 0; i < names.length; i++) {
    var v = row[key_(names[i])];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return '';
}

function matchCatalog_(raw, list) {
  var n = key_(raw);
  if (!n) return '';
  for (var i = 0; i < list.length; i++) if (key_(list[i]) === n) return list[i];
  var best = '';
  list.forEach(function (item) {
    var k = key_(item);
    if (k.length >= 4 && (n.indexOf(k) !== -1 || k.indexOf(n) !== -1) && k.length > key_(best).length) best = item;
  });
  return best;
}

function mapStatus_(raw, table, fallback) {
  var n = key_(raw);
  for (var i = 0; i < table.length; i++) if (n.indexOf(table[i][0]) !== -1) return table[i][1];
  return fallback;
}

/**
 * Revisa (commit = false) o importa (commit = true) la hoja anterior.
 * input: { source: URL o ID de la hoja, company: empresa por omisión, site: sede por omisión, commit: boolean }
 */
function apiImportLegacy(input) {
  var run = function () {
    var ctx = context_();
    if (!ctx.titular) fail_('Solo la persona titular puede importar datos de la versión anterior.');
    input = input || {};
    var sourceId = legacyId_(input.source);
    if (!sourceId) fail_('Pega el enlace completo de la hoja de cálculo anterior o su ID.');
    if (sourceId === props_().getProperty('SPREADSHEET_ID')) fail_('Ese enlace es la base de datos actual, no la hoja anterior.');
    var company = text_(input.company, 120);
    var site = text_(input.site, 120);
    if (COMPANIES.indexOf(company) === -1) fail_('Selecciona la empresa a la que pertenece la información anterior.');
    if (SITES.indexOf(site) === -1) fail_('Selecciona la sede por omisión.');

    var src;
    try {
      src = SpreadsheetApp.openById(sourceId);
    } catch (e) {
      fail_('No pude abrir esa hoja. Revisa el enlace y que la cuenta propietaria de la plataforma tenga acceso a ella.');
    }
    try { LEGACY_TZ_ = src.getSpreadsheetTimeZone() || APP_TZ; } catch (e) { LEGACY_TZ_ = APP_TZ; }
    var tabs = {};
    Object.keys(LEGACY_TABS_).forEach(function (k) { tabs[k] = legacyRows_(src, LEGACY_TABS_[k]); });
    if (!tabs.empleados && !tabs.solicitudes && !tabs.vacantes) fail_('La hoja no tiene pestañas "Empleados", "Solicitudes" ni "Vacantes".');

    var existing = readTable_('records');
    var imported = {}, usedIds = {}, padron = {};
    existing.forEach(function (r) {
      var p = parsePayload_(r.payload);
      if (p.legacyKey) imported[p.legacyKey] = true;
      if (r.kind === 'colaboradores' && p.employeeId) {
        usedIds[String(p.employeeId).toUpperCase()] = p.legacyKey || 'actual';
        padron[String(p.employeeId).toUpperCase()] = { title: r.title, company: r.company, site: r.site };
      }
    });

    var warnings = [];
    var warn = function (w) { if (warnings.indexOf(w) === -1 && warnings.length < 200) warnings.push(w); };
    var siteOf = function (raw, where) {
      if (!String(raw || '').trim()) return site;
      var s = matchCatalog_(raw, SITES);
      if (!s) warn('Sede "' + legacyText_(raw, 80) + '" no existe en el catálogo; se usó ' + site + ' (' + where + ').');
      return s || site;
    };
    var companyOf = function (raw) {
      var c = raw ? matchCatalog_(raw, COMPANIES) : '';
      if (raw && !c) warn('Empresa "' + legacyText_(raw, 80) + '" no existe en el catálogo; se usó ' + company + '.');
      return c || company;
    };
    var at = nowIso_();
    var out = [];
    var summary = {};
    function tally(tab, what) { summary[tab] = summary[tab] || { nuevos: 0, yaImportados: 0, omitidos: 0 }; summary[tab][what]++; }
    function add(tab, row, kind, base, payload) {
      payload.legacyKey = tab + ':' + (legacyText_(pick_(row, ['ID', 'Id', 'NumeroEmpleado', 'No. empleado', 'Folio']), 80).toUpperCase() || 'FILA-' + row._row);
      if (imported[payload.legacyKey]) { tally(tab, 'yaImportados'); return; }
      imported[payload.legacyKey] = true;
      tally(tab, 'nuevos');
      var due = payload.requiredDate || payload.end || '';
      out.push({
        id: uuid_(), kind: kind, title: base.title, company: base.company, site: base.site, category: '', status: base.status, owner: '',
        due: due, notes: IMPORT_NOTE_ + ' Pestaña ' + LEGACY_TABS_[tab] + ', fila ' + row._row + '.', payload: payload, folio: '',
        createdAt: at, updatedAt: at, createdBy: ctx.email, updatedBy: ctx.email, revision: 1,
      });
    }

    // 1. Empleados → padrón
    var oldToNew = {};
    (tabs.empleados || []).forEach(function (row) {
      var oldId = legacyText_(pick_(row, ['ID', 'Id', 'NumeroEmpleado', 'No. empleado']), 40).toUpperCase();
      if (oldId) oldToNew[oldId] = oldId;
    });
    (tabs.empleados || []).forEach(function (row) {
      var where = 'Empleados, fila ' + row._row;
      var name = (legacyText_(pick_(row, ['Nombre']), 120) + ' ' + legacyText_(pick_(row, ['Apellido', 'Apellidos']), 120)).trim() ||
        legacyText_(pick_(row, ['Nombre completo', 'NombreCompleto']), 200);
      var empId = legacyText_(pick_(row, ['ID', 'Id', 'NumeroEmpleado', 'No. empleado']), 40).toUpperCase();
      if (!name) { tally('empleados', 'omitidos'); warn('Sin nombre: se omitió (' + where + ').'); return; }
      if (!empId) { tally('empleados', 'omitidos'); warn(name + ' no tiene ID de empleado: se omitió (' + where + ').'); return; }
      var legacyKey = 'empleados:' + empId;
      if (usedIds[empId] && usedIds[empId] !== legacyKey) {
        tally('empleados', 'omitidos');
        warn('El número ' + empId + ' (' + name + ') ya existe en el padrón actual: se omitió.');
        return;
      }
      usedIds[empId] = legacyKey;
      var start = legacyDate_(pick_(row, ['FechaIngreso', 'Fecha de ingreso', 'Ingreso']));
      if (!start) warn(name + ': falta la fecha de ingreso; complétala en el padrón.');
      var bossOld = legacyText_(pick_(row, ['ReportaA', 'Reporta a', 'Jefe']), 40).toUpperCase();
      var status = mapStatus_(pick_(row, ['Estatus', 'Estado']), [['baja', 'Baja'], ['inactiv', 'Baja']], 'Activo');
      var end = legacyDate_(pick_(row, ['FechaBaja', 'Fecha de baja']));
      if (status === 'Baja' && !end) warn(name + ' está dado de baja sin fecha de baja; complétala en el padrón.');
      var base = { title: name, company: companyOf(pick_(row, ['Empresa'])), site: siteOf(pick_(row, ['Sede']), where), status: status };
      padron[empId] = { title: name, company: base.company, site: base.site };
      add('empleados', row, 'colaboradores', base, {
        employeeId: empId, area: legacyText_(pick_(row, ['Departamento', 'Área', 'Area']), 200), position: legacyText_(pick_(row, ['Puesto']), 200),
        manager: '', managerId: bossOld && (oldToNew[bossOld] || padron[bossOld]) && bossOld !== empId ? bossOld : '', start: start, end: end,
        email: legacyText_(pick_(row, ['Correo', 'Email']), 254), phone: legacyText_(pick_(row, ['Telefono', 'Teléfono']), 60),
        birthDate: legacyDate_(pick_(row, ['FechaNacimiento', 'Fecha de nacimiento'])), contractType: '', url: '',
      });
      if (bossOld && !oldToNew[bossOld] && !padron[bossOld]) warn(name + ': su jefe (ID ' + bossOld + ') no está en la pestaña Empleados ni en el padrón.');
    });
    // Nombre del jefe una vez que todos están cargados
    out.forEach(function (r) { if (r.payload.managerId && padron[r.payload.managerId]) r.payload.manager = padron[r.payload.managerId].title; });

    // 2. Solicitudes → permisos y vacaciones
    (tabs.solicitudes || []).forEach(function (row) {
      var where = 'Solicitudes, fila ' + row._row;
      var empId = legacyText_(pick_(row, ['EmpleadoID', 'Empleado ID', 'IDEmpleado']), 40).toUpperCase();
      var emp = empId ? padron[empId] : null;
      var name = legacyText_(pick_(row, ['EmpleadoNombre', 'Empleado', 'Nombre']), 200) || (emp && emp.title) || '';
      var start = legacyDate_(pick_(row, ['FechaInicio', 'Fecha de inicio', 'Inicio']));
      var end = legacyDate_(pick_(row, ['FechaFin', 'Fecha de fin', 'Fin'])) || start;
      if (!name || !start) { tally('solicitudes', 'omitidos'); warn('Solicitud sin colaborador o sin fecha de inicio: se omitió (' + where + ').'); return; }
      if (end < start) end = start;
      var tipo = legacyText_(pick_(row, ['Tipo']), 60);
      var type = key_(tipo).indexOf('vacacion') !== -1 ? 'Vacaciones' : 'Otro';
      var motivo = legacyText_(pick_(row, ['Motivo', 'Descripcion', 'Comentarios']), 4000);
      var status = mapStatus_(pick_(row, ['Estado', 'Estatus']),
        [['aprob', 'Autorizado'], ['autoriz', 'Autorizado'], ['rechaz', 'No autorizado'], ['cancel', 'Cancelado'], ['conclu', 'Concluido'], ['complet', 'Concluido']], 'Pendiente');
      add('solicitudes', row, 'permisos', { title: name, company: emp ? emp.company : company, site: emp ? emp.site : site, status: status }, {
        employeeId: emp ? empId : '', area: '', position: '', type: type, start: start, end: end, hours: '', approver: '', substitute: '',
        reason: ((type === 'Otro' && tipo ? '[' + tipo + '] ' : '') + (motivo || 'Sin motivo registrado en la versión anterior.')).slice(0, 5000),
      });
      if (empId && !emp) warn('Solicitud de ' + name + ': el ID ' + empId + ' no está en el padrón; quedó sin vincular (' + where + ').');
    });

    // 3. Vacantes → cobertura de vacantes
    (tabs.vacantes || []).forEach(function (row) {
      var where = 'Vacantes, fila ' + row._row;
      var puesto = legacyText_(pick_(row, ['Puesto', 'Vacante']), 200);
      if (!puesto) { tally('vacantes', 'omitidos'); warn('Vacante sin puesto: se omitió (' + where + ').'); return; }
      var qty = Math.floor(Number(pick_(row, ['Plazas', 'Cantidad'])));
      var tipo = legacyText_(pick_(row, ['Tipo']), 60);
      var desc = legacyText_(pick_(row, ['Descripcion', 'Descripción']), 4000);
      var status = mapStatus_(pick_(row, ['Estado', 'Estatus']),
        [['cubiert', 'Cubierta'], ['cancel', 'Cancelada'], ['pausa', 'Pendiente'], ['finalist', 'En reclutamiento'], ['abiert', 'En reclutamiento']], 'Pendiente');
      add('vacantes', row, 'cobertura', { title: puesto, company: companyOf(pick_(row, ['Empresa'])), site: siteOf(pick_(row, ['Sede']), where), status: status }, {
        requester: 'Capital Humano', requesterPosition: 'Versión anterior de la intranet',
        area: legacyText_(pick_(row, ['Departamento', 'Área', 'Area']), 200) || 'Por definir', quantity: String(qty >= 1 ? qty : 1),
        type: 'Nueva posición', priority: 'Normal', requiredDate: legacyDate_(pick_(row, ['FechaPublicacion', 'Fecha de publicación'])) || today_(),
        schedule: 'Por definir', reason: desc || 'Vacante registrada en la versión anterior de la intranet.',
        requirements: tipo ? 'Tipo de contratación: ' + tipo : '', approver: '', approvalDate: '', letterhead: '',
      });
    });

    var result = { summary: summary, warnings: warnings, total: out.length, committed: false, tabs: {} };
    Object.keys(tabs).forEach(function (k) { result.tabs[k] = tabs[k] ? tabs[k].length : null; });
    if (!input.commit || !out.length) return result;

    // Folios de cobertura en bloque
    var vac = out.filter(function (r) { return r.kind === 'cobertura'; });
    vac.forEach(function (r) { r.folio = nextFolio_('CV'); });
    out.forEach(function (r) { r.payload = JSON.stringify(r.payload); });
    appendRows_('records', out);
    appendRows_('audit', out.map(function (r) {
      return { id: uuid_(), recordId: r.id, kind: r.kind, title: r.title, action: 'Registro importado de la versión anterior', actor: ctx.email, at: at };
    }));
    logAudit_('access', 'import', 'Importación', 'Importación de la versión anterior: ' + out.length + ' registros', ctx.email);
    result.committed = true;
    return result;
  };
  return input && input.commit ? withLock_(run) : run();
}
