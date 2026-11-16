/**
 * Punto de entrada de la web app y funciones que llama la interfaz (google.script.run).
 * Cada función pública valida identidad y permisos en el servidor antes de leer o escribir.
 */

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Capital Humano · Intranet RH')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

function include_(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

// ---------- Identidad ----------

function ownerEmails_() {
  var raw = props_().getProperty('RH_OWNER_EMAILS') || Session.getEffectiveUser().getEmail() || '';
  return String(raw).split(',').map(function (s) { return s.trim().toLowerCase(); }).filter(String);
}

function parseList_(value) {
  try {
    var list = JSON.parse(value || '[]');
    return Array.isArray(list) ? list.map(String) : [];
  } catch (e) {
    return [];
  }
}

function activeEmail_() {
  return String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
}

function context_() {
  var email = activeEmail_();
  if (!email) throw new Error('NO_EMAIL');
  if (ownerEmails_().indexOf(email) !== -1) {
    var own = findBy_('access', 'email', email);
    return {
      email: email, name: (own && own.name) || props_().getProperty('RH_OWNER_NAME') || 'Dirección RH', titular: true, admin: true,
      grant: { email: email, role: 'Dirección RH', companies: ['*'], sites: ['*'], active: true, admin: true },
    };
  }
  var row = findBy_('access', 'email', email);
  if (!row || row.active !== '1') throw new Error('NO_ACCESS');
  var grant = {
    email: email, role: row.role, companies: parseList_(row.companies), sites: parseList_(row.sites), active: true,
    admin: row.admin === '1' && ADMIN_CAPABLE_ROLES_.indexOf(row.role) !== -1,
  };
  return { email: email, name: row.name || email, grant: grant, admin: isAdmin_(grant), titular: false };
}

function fail_(message) {
  throw new Error(message);
}

// ---------- Arranque ----------

function apiBootstrap() {
  var email = activeEmail_();
  if (!email) return { state: 'no-email' };
  if (!props_().getProperty('SPREADSHEET_ID')) return { state: 'not-installed', email: email };
  var ctx;
  try {
    ctx = context_();
  } catch (e) {
    if (e.message === 'NO_ACCESS') return { state: 'no-access', email: email };
    throw e;
  }
  var g = ctx.grant;
  var modules = MODULES.filter(function (m) { return canAccessKind_(g, m.id); }).map(function (m) {
    var copy = JSON.parse(JSON.stringify(m));
    copy.canWrite = canWriteKind_(g, m.id);
    copy.hiddenFields = hiddenFields_(g, m.id);
    copy.fields = copy.fields.filter(function (f) { return copy.hiddenFields.indexOf(f.key) === -1; });
    return copy;
  });
  var writableCompanies = g.companies.indexOf('*') !== -1 ? COMPANIES.slice() : COMPANIES.filter(function (c) { return g.companies.indexOf(c) !== -1; });
  var writable = g.sites.indexOf('*') !== -1 ? SITES.slice() : SITES.filter(function (s) { return writableSites_(g).indexOf(s) !== -1; });
  return {
    state: 'ok',
    today: today_(),
    user: {
      email: ctx.email, name: ctx.name, role: g.role, admin: ctx.admin, titular: ctx.titular,
      canDelete: g.role === 'Dirección RH', canWriteCommon: g.role === 'Dirección RH',
      companies: g.companies, sites: g.sites,
    },
    catalog: {
      companies: COMPANIES, sites: SITES, writableCompanies: writableCompanies, writableSites: writable,
      allCompanies: ALL_COMPANIES, allSites: ALL_SITES, roles: ROLES, adminRoles: ADMIN_CAPABLE_ROLES_,
      groups: GROUPS, modules: modules,
    },
    evaluations: canAccessKind_(g, 'evaluaciones') ? evaluationCatalog_() : null,
  };
}

/** Todo lo que el usuario puede ver, ya filtrado y sin campos ocultos. */
function apiLoad() {
  var ctx = context_();
  var g = ctx.grant;
  var records = readTable_('records').map(recordOut_).filter(function (r) { return permits_(g, r); }).map(function (r) { return redact_(g, r); });
  var ids = {};
  records.forEach(function (r) { ids[r.id] = true; });
  var attachments = readTable_('attachments').filter(function (a) { return ids[a.recordId]; }).map(function (a) {
    return { id: a.id, recordId: a.recordId, name: a.name, size: Number(a.size) || 0, createdAt: a.createdAt, createdBy: a.createdBy };
  });
  var movements = readTable_('movements').filter(function (m) { return ids[m.recordId]; }).map(function (m) {
    return { id: m.id, recordId: m.recordId, type: m.type, quantity: Number(m.quantity) || 0, recipient: m.recipient, notes: m.notes, actor: m.actor, at: m.at };
  });
  var activity = readTable_('audit')
    .filter(function (a) { return ids[a.recordId] || (ctx.admin && a.recordId === 'access'); })
    .sort(function (a, b) { return a.at < b.at ? 1 : -1; })
    .slice(0, 40)
    .map(function (a) { return { recordId: a.recordId, kind: a.kind, title: a.title, action: a.action, actor: a.actor, at: a.at }; });
  return { records: records, attachments: attachments, movements: movements, activity: activity, loadedAt: nowIso_() };
}

function apiHistory(recordId) {
  var ctx = context_();
  var rec = findBy_('records', 'id', String(recordId));
  if (!rec || !permits_(ctx.grant, recordOut_(rec))) fail_('No tienes acceso a este registro.');
  return readTable_('audit')
    .filter(function (a) { return a.recordId === rec.id; })
    .sort(function (a, b) { return a.at < b.at ? 1 : -1; })
    .map(function (a) { return { action: a.action, actor: a.actor, at: a.at }; });
}

// ---------- Guardar registros ----------

function text_(v, max, label) {
  var s = String(v === null || v === undefined ? '' : v).trim();
  if (s.length > max) fail_((label || 'Un campo') + ' es demasiado largo.');
  return s;
}

function validDate_(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v + 'T12:00:00Z'));
}

function safeUrl_(v) {
  if (!v) return '';
  if (!/^https?:\/\/[^\s]+$/i.test(v)) fail_('Escribe un enlace válido que comience con https://');
  return v;
}

function apiSave(input) {
  return withLock_(function () {
    var ctx = context_();
    var g = ctx.grant;
    input = input || {};
    var kind = text_(input.kind, 40);
    var mod = moduleById_(kind);
    if (!mod) fail_('Módulo no válido.');
    var title = text_(input.title, 200, mod.titleLabel);
    var company = text_(input.company, 120, 'Empresa');
    var site = text_(input.site, 120, 'Sede');
    var status = text_(input.status, 60, 'Estado');
    var owner = text_(input.owner, 200, 'Responsable');
    var notes = text_(input.notes, 5000, 'Observaciones');
    var due = text_(input.due, 10, 'Fecha compromiso');

    if (!title) fail_('Completa: ' + mod.titleLabel + '.');
    if (!company || !site) fail_('Selecciona empresa y sede.');
    if (COMPANIES.indexOf(company) === -1 && !(company === ALL_COMPANIES && mod.scope === 'comun')) fail_('Empresa no válida.');
    if (SITES.indexOf(site) === -1 && site !== ALL_SITES) fail_('Sede no válida.');
    if (!permits_(g, { kind: kind, company: company, site: site }, true)) fail_('No tienes permiso para guardar en este módulo, empresa o sede.');
    if (mod.states.indexOf(status) === -1) fail_('Selecciona un estado válido.');
    if (due && !validDate_(due)) fail_('La fecha compromiso no es válida.');

    var rows = readTable_('records');
    var old = null;
    if (input.id) {
      for (var i = 0; i < rows.length; i++) if (rows[i].id === input.id) old = rows[i];
      if (!old) fail_('El registro ya no existe. Recarga la página.');
      if (!permits_(g, recordOut_(old), true)) fail_('No tienes permiso para modificar este registro.');
      if (old.kind !== kind) fail_('El módulo del registro no puede cambiar.');
      if (Number(input.revision) !== Number(old.revision)) fail_('Alguien más actualizó este registro mientras lo editabas. Ciérralo y vuelve a abrirlo para ver la versión actual.');
    }
    var prior = old ? parsePayload_(old.payload) : {};
    var payload = input.payload && typeof input.payload === 'object' && !Array.isArray(input.payload) ? input.payload : {};
    var hidden = hiddenFields_(g, kind);
    var clean = {};
    var changed = [];

    mod.fields.forEach(function (field) {
      if (hidden.indexOf(field.key) !== -1) {
        clean[field.key] = prior[field.key] === undefined ? '' : prior[field.key];
        return;
      }
      var raw = payload[field.key];
      if (raw !== undefined && raw !== null && typeof raw !== 'string' && typeof raw !== 'number') fail_('Valor no válido en ' + field.label + '.');
      var value = text_(raw, field.type === 'textarea' ? 5000 : 1000, field.label);
      if (field.required && !value) fail_('Completa: ' + field.label + '.');
      if (field.type === 'url') value = safeUrl_(value);
      if (field.type === 'date' && value && !validDate_(value)) fail_('Fecha no válida en ' + field.label + '.');
      if (field.type === 'time' && value && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) fail_('Hora no válida en ' + field.label + '.');
      if (field.type === 'number' && value && (isNaN(Number(value)) || Number(value) < 0)) fail_(field.label + ' debe ser un número positivo.');
      if (field.type === 'select' && value && field.options.indexOf(value) === -1) fail_('Opción no válida en ' + field.label + '.');
      if (field.type === 'letterhead' && value) {
        var head = null;
        for (var j = 0; j < rows.length; j++) if (rows[j].id === value && rows[j].kind === 'membretadas') head = rows[j];
        if (!head || !permits_(g, recordOut_(head))) fail_('La hoja membretada seleccionada no está disponible.');
      }
      clean[field.key] = value;
      if (old && String(prior[field.key] === undefined ? '' : prior[field.key]) !== value) changed.push(field.label);
    });

    if (prior.legacyKey) clean.legacyKey = prior.legacyKey; // conserva el origen de los registros importados

    if (clean.start && clean.end && clean.end < clean.start) fail_('La fecha de término debe ser igual o posterior a la de inicio.');

    if (mod.checks) {
      clean.checks = {};
      var checks = payload.checks && typeof payload.checks === 'object' ? payload.checks : {};
      mod.checks.forEach(function (c) {
        var v = checks[c] || 'Pendiente';
        if (['Pendiente', 'Completo', 'No aplica'].indexOf(v) === -1) fail_('Estado de lista de verificación no válido.');
        clean.checks[c] = v;
        if (old && ((prior.checks && prior.checks[c]) || 'Pendiente') !== v) changed.push('Lista: ' + c);
      });
    }

    if (kind === 'uniformes') {
      ['initial', 'minimum'].forEach(function (k) { if (!(Number(clean[k]) % 1 === 0)) fail_('Las existencias deben ser números enteros.'); });
      if (old && Number(clean.initial) !== Number(prior.initial)) fail_('La existencia inicial no puede cambiarse. Registra una entrada o salida.');
      clean.balance = old ? Number(prior.balance === undefined ? prior.initial : prior.balance) : Number(clean.initial);
      if (old && old.status === 'En conciliación' && status === 'Activo') {
        if (['Dirección RH', 'Jefatura RH'].indexOf(g.role) === -1) fail_('Solo Dirección o Jefatura RH puede conciliar existencias.');
        if (clean.reconciledBalance === '' || !(Number(clean.reconciledBalance) % 1 === 0) || !notes) fail_('Escribe la existencia física conciliada y explica el ajuste en Observaciones.');
        clean.balance = Number(clean.reconciledBalance);
        clean.reconciledBy = ctx.email;
        clean.reconciledAt = nowIso_();
        changed.push('Conciliación de existencias');
      } else if (old) {
        clean.reconciledBy = prior.reconciledBy || '';
        clean.reconciledAt = prior.reconciledAt || '';
      }
      if (status === 'Activo' && clean.balance < 0) fail_('Concilia primero el saldo negativo.');
    }

    if (kind === 'cobertura' && (!(Number(clean.quantity) % 1 === 0) || Number(clean.quantity) < 1)) fail_('La cantidad solicitada debe ser un número entero mayor a cero.');

    if (kind === 'evaluaciones') {
      clean.instrument = text_(payload.instrument, 20);
      clean.guide = clean.instrument === 'nom035' ? text_(payload.guide, 5) : '';
      clean.customers = !!payload.customers;
      clean.supervises = !!payload.supervises;
      clean.informed = !!payload.informed;
      var answers = payload.answers && typeof payload.answers === 'object' && !Array.isArray(payload.answers) ? payload.answers : {};
      var keys = Object.keys(answers);
      if (keys.length > 200) fail_('Respuestas no válidas.');
      clean.answers = {};
      keys.forEach(function (k) {
        var v = answers[k];
        if (!/^\d{1,3}$/.test(k) || (typeof v !== 'string' && typeof v !== 'number') || String(v).length > 5) fail_('Respuesta no válida.');
        clean.answers[k] = v;
      });
      clean.result = scoreEvaluation_(clean, status === 'Finalizada');
      if (old && JSON.stringify(prior.answers || {}) !== JSON.stringify(clean.answers)) changed.push('Respuestas');
    }

    if (kind === 'colaboradores') {
      if (company === ALL_COMPANIES || site === ALL_SITES) fail_('Selecciona una empresa y una sede específicas.');
      clean.employeeId = clean.employeeId.toUpperCase();
      rows.forEach(function (r) {
        if (r.kind === 'colaboradores' && r.id !== (old && old.id) && String(parsePayload_(r.payload).employeeId || '').toUpperCase() === clean.employeeId) {
          fail_('El número de empleado ' + clean.employeeId + ' ya está registrado.');
        }
      });
      if (status === 'Baja' && !clean.end) fail_('Indica la fecha de baja.');
      if (clean.managerId) {
        clean.managerId = clean.managerId.toUpperCase();
        if (clean.managerId === clean.employeeId) fail_('Una persona no puede ser su propio jefe inmediato.');
        var boss = null;
        rows.forEach(function (r) {
          if (r.kind === 'colaboradores' && String(parsePayload_(r.payload).employeeId || '').toUpperCase() === clean.managerId) boss = r;
        });
        if (!boss || !permits_(g, recordOut_(boss))) fail_('El número de empleado del jefe inmediato (' + clean.managerId + ') no está en el padrón que puedes consultar.');
        if (!clean.manager) clean.manager = boss.title;
      }
    } else if (clean.employeeId) {
      var empId = clean.employeeId.toUpperCase();
      var emp = null;
      rows.forEach(function (r) {
        if (r.kind === 'colaboradores' && String(parsePayload_(r.payload).employeeId || '').toUpperCase() === empId) emp = r;
      });
      if (!emp || !permits_(g, recordOut_(emp))) fail_('El número de empleado ' + empId + ' no está en el padrón de colaboradores que puedes consultar.');
      if (company !== ALL_COMPANIES && (emp.company !== company || emp.site !== site)) {
        fail_('El colaborador ' + empId + ' está registrado en ' + emp.company + ', ' + emp.site + '. Ajusta la empresa y la sede.');
      }
      clean.employeeId = empId;
      clean.employeeRecordId = emp.id;
    }

    due = due || clean.review || clean.nextReview || clean.expiry || clean.requiredDate || clean.responseDate || clean.end || clean.eventDate || '';

    var labels = { title: mod.titleLabel, company: 'Empresa', site: 'Sede', status: 'Estado', owner: 'Responsable', due: 'Fecha compromiso', notes: 'Observaciones' };
    var base = { title: title, company: company, site: site, status: status, owner: owner, due: due, notes: notes };
    if (old) Object.keys(base).forEach(function (k) { if (String(old[k] || '') !== base[k]) changed.unshift(labels[k]); });

    var at = nowIso_();
    var record = {
      id: old ? old.id : uuid_(), kind: kind, title: title, company: company, site: site, category: '', status: status, owner: owner,
      due: due, notes: notes, payload: JSON.stringify(clean), folio: old ? old.folio : '',
      createdAt: old ? old.createdAt : at, updatedAt: at, createdBy: old ? old.createdBy : ctx.email, updatedBy: ctx.email,
      revision: old ? Number(old.revision) + 1 : 1,
    };
    if (!old && { oficios: 'OF', constancias: 'CL', cobertura: 'CV' }[kind]) record.folio = nextFolio_({ oficios: 'OF', constancias: 'CL', cobertura: 'CV' }[kind]);
    if (old) updateRow_('records', old._row, record);
    else appendRow_('records', record);

    var unique = changed.filter(function (c, i) { return changed.indexOf(c) === i; });
    var action = old ? (unique.length ? 'Actualización: ' + unique.join(', ') : 'Guardado sin cambios') : 'Registro creado';
    logAudit_(record.id, kind, title, action, ctx.email);
    return redact_(g, recordOut_(record));
  });
}

// ---------- Archivos ----------

const ALLOWED_EXT_ = /\.(pdf|docx|xlsx|csv|png|jpg|jpeg|pptx|txt)$/i;
const MAX_FILE_BYTES_ = 10 * 1024 * 1024;

function apiUpload(recordId, file) {
  return withLock_(function () {
    var ctx = context_();
    var rec = findBy_('records', 'id', String(recordId));
    if (!rec || !permits_(ctx.grant, recordOut_(rec), true)) fail_('No tienes permiso para agregar archivos a este registro.');
    var name = text_(file && file.name, 200, 'Nombre del archivo');
    if (!ALLOWED_EXT_.test(name)) fail_('Tipo de archivo no permitido: ' + name + '. Usa PDF, Word, Excel, PowerPoint, CSV, TXT, PNG o JPG.');
    var bytes = Utilities.base64Decode(String(file.data || ''));
    if (!bytes.length) fail_('El archivo está vacío.');
    if (bytes.length > MAX_FILE_BYTES_) fail_('Cada archivo debe pesar como máximo 10 MB.');
    var mime = text_(file.mimeType, 120) || 'application/octet-stream';
    var driveFile = folder_().createFile(Utilities.newBlob(bytes, mime, name));
    var meta = { id: uuid_(), recordId: rec.id, name: name, fileId: driveFile.getId(), mime: mime, size: bytes.length, createdAt: nowIso_(), createdBy: ctx.email };
    appendRow_('attachments', meta);
    logAudit_(rec.id, rec.kind, rec.title, 'Archivo agregado: ' + name, ctx.email);
    return { id: meta.id, recordId: meta.recordId, name: meta.name, size: meta.size, createdAt: meta.createdAt, createdBy: meta.createdBy };
  });
}

function apiDownload(attachmentId) {
  var ctx = context_();
  var a = findBy_('attachments', 'id', String(attachmentId));
  if (!a) fail_('El archivo ya no existe.');
  var rec = findBy_('records', 'id', a.recordId);
  if (!rec || !permits_(ctx.grant, recordOut_(rec))) fail_('No tienes acceso a este archivo.');
  var blob = DriveApp.getFileById(a.fileId).getBlob();
  logAudit_(rec.id, rec.kind, rec.title, 'Descarga de archivo: ' + a.name, ctx.email);
  return { name: a.name, mimeType: a.mime || 'application/octet-stream', data: Utilities.base64Encode(blob.getBytes()) };
}

function apiDeleteAttachment(attachmentId) {
  return withLock_(function () {
    var ctx = context_();
    var a = findBy_('attachments', 'id', String(attachmentId));
    if (!a) fail_('El archivo ya no existe.');
    var rec = findBy_('records', 'id', a.recordId);
    var canRemove = rec && permits_(ctx.grant, recordOut_(rec), true) &&
      (['Dirección RH', 'Jefatura RH'].indexOf(ctx.grant.role) !== -1 || a.createdBy === ctx.email);
    if (!canRemove) fail_('Solo quien subió el archivo, Dirección o Jefatura RH pueden quitarlo.');
    try { DriveApp.getFileById(a.fileId).setTrashed(true); } catch (e) { /* el archivo ya no estaba en Drive */ }
    deleteRows_('attachments', [a._row]);
    logAudit_(rec.id, rec.kind, rec.title, 'Archivo eliminado: ' + a.name, ctx.email);
    return true;
  });
}

function apiPdf(recordId) {
  var ctx = context_();
  var raw = findBy_('records', 'id', String(recordId));
  if (!raw || !permits_(ctx.grant, recordOut_(raw))) fail_('No tienes acceso a este registro.');
  var record = redact_(ctx.grant, recordOut_(raw));
  var letterhead = null;
  if (record.payload.letterhead) {
    var head = findBy_('records', 'id', record.payload.letterhead);
    if (!head || !permits_(ctx.grant, recordOut_(head))) fail_('No tienes acceso a la hoja membretada seleccionada.');
    if (head.status !== 'Vigente') fail_('La hoja membretada seleccionada ya no está vigente. Elige otra.');
    var files = readTable_('attachments').filter(function (x) { return x.recordId === head.id && /\.(png|jpe?g)$/i.test(x.name); });
    if (!files.length) fail_('La hoja membretada no tiene una imagen PNG o JPG adjunta.');
    var latest = files.sort(function (x, y) { return x.createdAt < y.createdAt ? 1 : -1; })[0];
    var blob = DriveApp.getFileById(latest.fileId).getBlob();
    letterhead = { mime: /\.png$/i.test(latest.name) ? 'image/png' : 'image/jpeg', data: Utilities.base64Encode(blob.getBytes()) };
  }
  var pdf = makePdf_(record, letterhead);
  logAudit_(raw.id, raw.kind, raw.title, 'Descarga de PDF', ctx.email);
  return { name: pdf.getName(), data: Utilities.base64Encode(pdf.getBytes()) };
}

// ---------- Inventario ----------

function apiMovement(input) {
  return withLock_(function () {
    var ctx = context_();
    input = input || {};
    var qty = Number(input.quantity);
    if (!(qty % 1 === 0) || qty < 1 || qty > 100000) fail_('Escribe una cantidad entera mayor a cero.');
    if (['Entrada', 'Salida'].indexOf(input.type) === -1) fail_('Tipo de movimiento no válido.');
    var recipient = text_(input.recipient, 200, 'Colaborador');
    var notes = text_(input.notes, 2000, 'Notas');
    if (input.type === 'Salida' && !recipient) fail_('Indica quién recibe las prendas.');
    var rec = findBy_('records', 'id', String(input.id));
    if (!rec || rec.kind !== 'uniformes') fail_('El artículo ya no existe.');
    if (rec.status !== 'Activo') fail_('El artículo no está activo. Concílialo o reactívalo primero.');
    if (!permits_(ctx.grant, recordOut_(rec), true)) fail_('No tienes permiso para modificar este inventario.');
    var p = parsePayload_(rec.payload);
    var balance = Number(p.balance === undefined ? p.initial : p.balance);
    var next = balance + (input.type === 'Entrada' ? qty : -qty);
    if (next < 0) fail_('No hay existencias suficientes: quedan ' + balance + '.');
    p.balance = next;
    rec.payload = JSON.stringify(p);
    rec.updatedAt = nowIso_();
    rec.updatedBy = ctx.email;
    rec.revision = Number(rec.revision) + 1;
    updateRow_('records', rec._row, rec);
    appendRow_('movements', { id: uuid_(), recordId: rec.id, type: input.type, quantity: qty, recipient: recipient, notes: notes, actor: ctx.email, at: rec.updatedAt });
    logAudit_(rec.id, rec.kind, rec.title, input.type + ' de ' + qty + ' piezas' + (recipient ? ' (' + recipient + ')' : ''), ctx.email);
    return { balance: next, revision: rec.revision };
  });
}

// ---------- Eliminación definitiva (ARCO) ----------

function apiDeleteRecord(recordId, confirmation) {
  return withLock_(function () {
    var ctx = context_();
    var rec = findBy_('records', 'id', String(recordId));
    if (!rec) fail_('El registro ya no existe.');
    if (!canDelete_(ctx.grant, recordOut_(rec))) fail_('Solo Dirección RH puede eliminar registros.');
    if (String(confirmation || '').trim() !== rec.title) fail_('Para confirmar, escribe exactamente el nombre del registro.');
    var atts = readTable_('attachments').filter(function (a) { return a.recordId === rec.id; });
    atts.forEach(function (a) { try { DriveApp.getFileById(a.fileId).setTrashed(true); } catch (e) {} });
    deleteRows_('attachments', atts.map(function (a) { return a._row; }));
    deleteRows_('movements', readTable_('movements').filter(function (m) { return m.recordId === rec.id; }).map(function (m) { return m._row; }));
    readTable_('audit').filter(function (a) { return a.recordId === rec.id; }).forEach(function (a) {
      a.title = '(registro eliminado)';
      a.action = a.action.replace(/:.*$/, '');
      updateRow_('audit', a._row, a);
    });
    deleteRows_('records', [rec._row]);
    logAudit_(rec.id, rec.kind, '(registro eliminado)', 'Registro eliminado definitivamente', ctx.email);
    return true;
  });
}

// ---------- Accesos ----------

function apiAccessList() {
  var ctx = context_();
  if (!ctx.admin) fail_('Solo quien administra accesos puede ver esta sección.');
  return {
    titular: ctx.titular,
    users: readTable_('access').map(function (r) {
      return { email: r.email, name: r.name, role: r.role, companies: parseList_(r.companies), sites: parseList_(r.sites),
        active: r.active === '1', admin: r.admin === '1', updatedAt: r.updatedAt, updatedBy: r.updatedBy };
    }).sort(function (a, b) { return a.name.localeCompare(b.name, 'es'); }),
  };
}

function apiAccessSave(p) {
  return withLock_(function () {
    var ctx = context_();
    if (!ctx.admin) fail_('Solo quien administra accesos puede guardar permisos.');
    p = p || {};
    var email = text_(p.email, 254, 'Correo').toLowerCase();
    var name = text_(p.name, 200, 'Nombre');
    var admin = p.admin === true;
    if (email === ctx.email) fail_('No puedes modificar tu propio acceso.');
    if (ownerEmails_().indexOf(email) !== -1) fail_('El acceso del titular no se modifica desde aquí.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name) fail_('Revisa el nombre y el correo.');
    if (ROLES.indexOf(p.role) === -1) fail_('Selecciona un rol válido.');
    if (admin && ADMIN_CAPABLE_ROLES_.indexOf(p.role) === -1) fail_('Solo Dirección RH o Jefatura RH pueden administrar accesos.');
    [['companies', COMPANIES], ['sites', SITES]].forEach(function (pair) {
      var list = p[pair[0]];
      if (!Array.isArray(list) || !list.length || list.some(function (v) { return v !== '*' && pair[1].indexOf(v) === -1; })) fail_('Selecciona empresas y sedes válidas.');
    });
    var existing = findBy_('access', 'email', email);
    if (!ctx.titular) {
      if (admin || (existing && existing.admin === '1')) fail_('Solo el titular puede otorgar o modificar permisos de administración.');
      ['companies', 'sites'].forEach(function (k) {
        var own = k === 'sites' && ctx.grant.sites.indexOf('*') === -1 ? writableSites_(ctx.grant) : ctx.grant[k];
        if (own.indexOf('*') === -1 && p[k].some(function (v) { return v === '*' || own.indexOf(v) === -1; })) fail_('No puedes asignar empresas o sedes fuera de tu propio alcance.');
      });
    }
    var row = {
      email: email, name: name, role: p.role, companies: JSON.stringify(p.companies), sites: JSON.stringify(p.sites),
      active: p.active === false ? '0' : '1', admin: admin ? '1' : '0', updatedAt: nowIso_(), updatedBy: ctx.email,
    };
    if (existing) updateRow_('access', existing._row, row);
    else appendRow_('access', row);
    logAudit_('access', 'access', name, 'Acceso ' + (row.active === '1' ? 'actualizado' : 'suspendido') + ': ' + p.role + (admin ? ', administra accesos' : ''), ctx.email);
    return true;
  });
}
