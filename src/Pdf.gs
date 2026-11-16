/** Generación de PDF (constancias, solicitudes de cobertura y fichas de registro). */

const MONTHS_ES_ = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function esc_(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function longDate_(v) {
  if (!v) return '';
  var m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return esc_(v);
  return Number(m[3]) + ' de ' + MONTHS_ES_[Number(m[2]) - 1] + ' de ' + m[1];
}

function pdfShell_(record, letterhead, body) {
  var bg = letterhead ? '<img class="bg" src="data:' + letterhead.mime + ';base64,' + letterhead.data + '">' : '';
  var header = letterhead ? '' :
    '<div class="band"><div class="org">' + esc_(record.company === ALL_COMPANIES ? 'Capital Humano, Corporativo' : record.company) + '</div>' +
    '<div class="site">' + esc_(record.site) + '</div></div>';
  return '<html><head><meta charset="utf-8"><style>' +
    '@page{size:letter;margin:0}body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#1B2B3A;font-size:11.5pt;line-height:1.55}' +
    '.bg{position:fixed;top:0;left:0;width:8.5in;height:11in;z-index:-1}' +
    '.band{background:#002B49;color:#fff;padding:26px 54px;border-bottom:4px solid #C5A059}.org{font-size:17pt;font-weight:bold}.site{font-size:10.5pt;opacity:.85}' +
    '.page{padding:' + (letterhead ? '1.7in 0.9in 1.2in' : '0.45in 0.9in 0.9in') + '}' +
    'h1{font-size:15pt;margin:0 0 4px}h2{font-size:12pt;margin:22px 0 6px;color:#004B87}.muted{color:#5B6B73;font-size:9.5pt}' +
    'table{border-collapse:collapse;width:100%;margin-top:8px}td{border-bottom:1px solid #DCE3E2;padding:5px 6px;vertical-align:top}' +
    'td.k{width:38%;color:#5B6B73}.sign{margin-top:70px;width:300px;border-top:1px solid #1B2B3A;padding-top:6px}' +
    '.foot{margin-top:28px;font-size:8.5pt;color:#5B6B73}' +
    '</style></head><body>' + bg + header + '<div class="page">' + body + '</div></body></html>';
}

function constanciaBody_(r) {
  var p = r.payload;
  var who = esc_(r.title) + (p.employeeId ? ', con número de empleado ' + esc_(p.employeeId) : '');
  var job = (p.position ? ', desempeñando el puesto de ' + esc_(p.position) : '') + (p.area ? ' en el área de ' + esc_(p.area) : '');
  var company = r.company === ALL_COMPANIES ? 'Esta organización' : esc_(r.company);
  var html = '<p class="muted" style="text-align:right">' + esc_(r.folio || '') + '</p>' +
    '<h1 style="text-align:center;margin-top:18px">CONSTANCIA LABORAL</h1>' +
    '<p style="margin-top:34px"><b>A quien corresponda:</b></p>' +
    '<p>' + company + ' hace constar que ' + who + ', labora en la sede ' + esc_(r.site) + job + ', desde el ' + longDate_(p.start) + '.</p>';
  if (p.salary) html += '<p>Se hace constar un salario' + (p.salaryPeriod ? ' ' + esc_(String(p.salaryPeriod).toLowerCase()) : '') + ' de ' + esc_(p.salary) + '.</p>';
  html += '<p>Se expide la presente en ' + esc_(p.city) + ', el ' + longDate_(p.issueDate) + (p.purpose ? ', para ' + esc_(p.purpose) + '.' : '.') + '</p>';
  if (r.notes) html += '<p>' + esc_(r.notes) + '</p>';
  html += '<div class="sign"><b>' + esc_(p.signer) + '</b><br>' + esc_(p.signerPosition) + '</div>';
  return html;
}

function fieldsTable_(mod, p) {
  var rows = mod.fields.filter(function (f) { return f.type !== 'letterhead' && p[f.key] !== undefined && p[f.key] !== ''; }).map(function (f) {
    return '<tr><td class="k">' + esc_(f.label) + '</td><td>' + (f.type === 'date' ? longDate_(p[f.key]) : esc_(p[f.key])) + '</td></tr>';
  });
  return rows.length ? '<table>' + rows.join('') + '</table>' : '';
}

function genericBody_(r) {
  var mod = moduleById_(r.kind);
  var p = r.payload;
  var html = '<p class="muted">' + esc_(mod ? mod.label : 'Registro') + (r.folio ? ', folio ' + esc_(r.folio) : '') + '</p>' +
    '<h1>' + esc_(r.title) + '</h1>' +
    '<table><tr><td class="k">Empresa</td><td>' + esc_(r.company) + '</td></tr><tr><td class="k">Sede</td><td>' + esc_(r.site) + '</td></tr>' +
    '<tr><td class="k">Estado</td><td>' + esc_(r.status) + '</td></tr>' +
    (r.owner ? '<tr><td class="k">Responsable</td><td>' + esc_(r.owner) + '</td></tr>' : '') +
    (r.due ? '<tr><td class="k">Fecha compromiso</td><td>' + longDate_(r.due) + '</td></tr>' : '') + '</table>';
  if (mod) {
    var t = fieldsTable_(mod, p);
    if (t) html += '<h2>Datos</h2>' + t;
    if (mod.checks) {
      var done = mod.checks.filter(function (c) { return p.checks && p.checks[c] === 'Completo'; }).length;
      var applicable = mod.checks.filter(function (c) { return !(p.checks && p.checks[c] === 'No aplica'); }).length;
      html += '<h2>Lista de verificación: ' + done + ' de ' + applicable + '</h2><table>' + mod.checks.map(function (c) {
        return '<tr><td class="k">' + esc_(c) + '</td><td>' + esc_((p.checks && p.checks[c]) || 'Pendiente') + '</td></tr>';
      }).join('') + '</table>';
    }
  }
  if (r.kind === 'uniformes') html += '<h2>Existencia actual: ' + esc_(p.balance === undefined ? p.initial : p.balance) + '</h2>';
  if (r.kind === 'evaluaciones') {
    var type = EVALUATION_TYPES_.filter(function (t) { return t.id === p.instrument; })[0];
    html += '<h2>Resultados: ' + esc_(type ? type.label : '') + (p.guide ? ', Guía ' + esc_(p.guide) : '') + '</h2>';
    var res = p.result;
    if (!res) html += '<p>Evaluación en borrador, pendiente de finalizar.</p>';
    else {
      html += '<table>';
      if (res.score !== undefined) html += '<tr><td class="k">Puntuación</td><td>' + esc_(res.score) + (res.guide ? '' : ' de 100') + '</td></tr>';
      if (res.average !== undefined) html += '<tr><td class="k">Promedio</td><td>' + esc_(res.average) + ' de 5</td></tr>';
      if (res.level) html += '<tr><td class="k">Nivel de riesgo</td><td>' + esc_(res.level) + '</td></tr>';
      if (res.result) html += '<tr><td class="k">Resultado</td><td>' + esc_(res.result) + '</td></tr>';
      [].concat(res.dimensions || [], res.categories || [], res.domains || []).forEach(function (c) {
        html += '<tr><td class="k">' + esc_(c.label) + '</td><td>' + esc_(c.score) + (c.level ? ', ' + esc_(c.level) : '') + '</td></tr>';
      });
      html += '</table><p class="foot">Documento confidencial. Los resultados individuales solo deben compartirse con la persona evaluada y el personal autorizado.</p>';
    }
  }
  if (r.notes) html += '<h2>Observaciones</h2><p>' + esc_(r.notes) + '</p>';
  if (r.kind === 'cobertura') {
    html += '<div style="display:flex;gap:60px"><div class="sign">' + esc_(p.requester) + '<br><span class="muted">Solicitante</span></div>' +
      '<div class="sign">' + esc_(p.approver || '') + '<br><span class="muted">Autorización</span></div></div>';
  }
  html += '<p class="foot">Generado el ' + longDate_(today_()) + ' desde la Intranet de Capital Humano.</p>';
  return html;
}

function makePdf_(record, letterhead) {
  var body = record.kind === 'constancias' ? constanciaBody_(record) : genericBody_(record);
  var html = pdfShell_(record, letterhead, body);
  var safeTitle = String(record.title).replace(/[^\wÁÉÍÓÚÑáéíóúñ ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60);
  var name = (record.folio || record.kind) + '-' + (safeTitle || 'registro') + '.pdf';
  return HtmlService.createHtmlOutput(html).getBlob().getAs('application/pdf').setName(name);
}
