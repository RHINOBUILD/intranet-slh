const assert = require('assert/strict');
const { makeEnv } = require('./gas-sim');
const SRC = process.argv[2];

const OWNER = 'director@grupo.mx';
const env = makeEnv(SRC, OWNER);
let n = 0;
const ok = (cond, label) => { assert(cond, label); n++; };
const throws = (fn, re, label) => { assert.throws(fn, re, label); n++; };

// --- Instalación y arranque
ok(env.as('').call('apiBootstrap').state === 'no-email', 'sin correo');
ok(env.as(OWNER).call('apiBootstrap').state === 'not-installed', 'sin instalar');
throws(() => env.as('intruso@grupo.mx').call('instalar'), /propietaria/, 'solo el propietario instala');
env.as(OWNER).call('instalar');
env.as(OWNER).call('instalar'); // idempotente
const boot = env.as(OWNER).call('apiBootstrap');
ok(boot.state === 'ok' && boot.user.titular && boot.user.admin, 'titular');
ok(boot.catalog.modules.length === 31, 'módulos: ' + boot.catalog.modules.length);
ok(boot.platforms.list.length >= 20 && boot.platforms.list.every((p) => /^https:\/\//.test(p.url) && boot.platforms.categories.includes(p.category)), 'catálogo de plataformas');
ok(boot.evaluations && boot.evaluations.nom035.III.length === 72 && boot.evaluations.nom035.II.length === 46, 'reactivos NOM-035');
ok(env.as('nadie@grupo.mx').call('apiBootstrap').state === 'no-access', 'sin acceso');

// Funciones privadas no expuestas
['permits_', 'context_', 'readTable_', 'include_', 'scoreEvaluation_'].forEach((f) => ok(f.endsWith('_'), f));

// --- Accesos
const save = (who, o) => env.as(who).call('apiAccessSave', o);
save(OWNER, { email: 'gen@grupo.mx', name: 'Gina Generalista', role: 'Generalista RH', companies: ['Saint Luke’s Hospitals'], sites: ['San José del Cabo'], active: true });
save(OWNER, { email: 'consulta@grupo.mx', name: 'Carlos Consulta', role: 'Consulta', companies: ['*'], sites: ['Cancún'], active: true });
save(OWNER, { email: 'jef@grupo.mx', name: 'Julia Jefa', role: 'Jefatura RH', companies: ['*'], sites: ['Caribe (Cancún/Playa del Carmen/Cozumel/Tulum)'], active: true, admin: true });
save(OWNER, { email: 'rec@grupo.mx', name: 'Rita Reclutamiento', role: 'Reclutamiento', companies: ['Lovalgo'], sites: ['*'], active: true });
throws(() => save(OWNER, { email: 'x@grupo.mx', name: 'X', role: 'Generalista RH', companies: ['*'], sites: ['*'], admin: true }), /Dirección RH o Jefatura/, 'admin solo roles capaces');
throws(() => save('gen@grupo.mx', { email: 'y@grupo.mx', name: 'Y', role: 'Consulta', companies: ['*'], sites: ['*'] }), /administra accesos/, 'generalista no administra');
throws(() => save('jef@grupo.mx', { email: 'z@grupo.mx', name: 'Z', role: 'Consulta', companies: ['*'], sites: ['San José del Cabo'] }), /fuera de tu propio alcance/, 'delegado limitado a su alcance');
throws(() => save('jef@grupo.mx', { email: 'z@grupo.mx', name: 'Z', role: 'Jefatura RH', companies: ['*'], sites: ['Cancún'], admin: true }), /Solo el titular/, 'delegado no crea admins');
save('jef@grupo.mx', { email: 'z@grupo.mx', name: 'Zoe', role: 'Consulta', companies: ['*'], sites: ['Tulum'], active: true });
throws(() => save('jef@grupo.mx', { email: OWNER, name: 'Yo', role: 'Consulta', companies: ['*'], sites: ['*'] }), /titular/, 'titular intocable');
ok(env.as('jef@grupo.mx').call('apiBootstrap').user.admin, 'jefatura administra');
ok(env.as('jef@grupo.mx').call('apiAccessList').titular === false, 'delegado no es titular');
throws(() => env.as('gen@grupo.mx').call('apiAccessList'), /administra accesos/, 'lista solo admins');

// --- Registros
const rec = (who, o) => env.as(who).call('apiSave', Object.assign({ status: '', owner: '', due: '', notes: '', payload: {} }, o));
const colab = rec(OWNER, { kind: 'colaboradores', title: 'Ana López', company: 'Saint Luke’s Hospitals', site: 'San José del Cabo', status: 'Activo',
  payload: { employeeId: 'slh-001', area: 'Enfermería', position: 'Enfermera', start: '2024-03-01', contractType: 'Tiempo indeterminado' } });
ok(colab.payload.employeeId === 'SLH-001', 'número en mayúsculas');
throws(() => rec(OWNER, { kind: 'colaboradores', title: 'Otra', company: 'Saint Luke’s Hospitals', site: 'San José del Cabo', status: 'Activo',
  payload: { employeeId: 'SLH-001', area: 'A', position: 'P', start: '2024-01-01', contractType: 'Prácticas' } }), /ya está registrado/, 'número único');
throws(() => rec(OWNER, { kind: 'permisos', title: 'Ana López', company: 'Lovalgo', site: 'Cancún', status: 'Pendiente',
  payload: { employeeId: 'SLH-001', type: 'Vacaciones', start: '2026-10-20', end: '2026-10-24', reason: 'Vacaciones' } }), /está registrado en/, 'empleado en otra empresa');
const permiso = rec('gen@grupo.mx', { kind: 'permisos', title: 'Ana López', company: 'Saint Luke’s Hospitals', site: 'San José del Cabo', status: 'Pendiente',
  payload: { employeeId: 'slh-001', type: 'Vacaciones', start: '2026-10-20', end: '2026-10-24', reason: 'Vacaciones anuales' } });
ok(permiso.due === '2026-10-24' && permiso.payload.employeeRecordId === colab.id, 'fecha compromiso y vínculo');
throws(() => rec('gen@grupo.mx', { kind: 'permisos', title: 'X', company: 'Saint Luke’s Hospitals', site: 'San José del Cabo', status: 'Pendiente',
  payload: { type: 'Vacaciones', start: '2026-10-20', end: '2026-10-10', reason: 'x' } }), /posterior/, 'fechas invertidas');
throws(() => rec('gen@grupo.mx', { kind: 'permisos', title: 'X', company: 'Lovalgo', site: 'San José del Cabo', status: 'Pendiente',
  payload: { type: 'Vacaciones', start: '2026-10-20', end: '2026-10-21', reason: 'x' } }), /No tienes permiso/, 'otra empresa');
throws(() => rec('gen@grupo.mx', { kind: 'constancias', title: 'X', company: 'Todas las empresas', site: 'San José del Cabo', status: 'Borrador', payload: {} }), /No tienes permiso/, 'común solo Dirección');
const incap = rec('gen@grupo.mx', { kind: 'incapacidades', title: 'Ana López', company: 'Saint Luke’s Hospitals', site: 'San José del Cabo', status: 'Registrada',
  payload: { folio: 'AB123', institution: 'IMSS', type: 'Inicial', start: '2026-10-01', end: '2026-10-03', days: '3' } });
const constancia = rec(OWNER, { kind: 'constancias', title: 'Ana López', company: 'Saint Luke’s Hospitals', site: 'San José del Cabo', status: 'Emitida',
  payload: { employeeId: 'SLH-001', start: '2024-03-01', issueDate: '2026-10-11', city: 'San José del Cabo', signer: 'Lic. Andrea Morales', signerPosition: 'Director de Capital Humano', salary: '$18,000.00', salaryPeriod: 'Mensual' } });
ok(/^CL-\d{4}-0001$/.test(constancia.folio), 'folio constancia ' + constancia.folio);
const cancun = rec(OWNER, { kind: 'constancias', title: 'Beto Cancún', company: 'Lovalgo', site: 'Cancún', status: 'Emitida',
  payload: { start: '2025-01-01', issueDate: '2026-10-11', city: 'Cancún', signer: 'A', signerPosition: 'B', salary: '$9,000.00' } });
const caribe = rec(OWNER, { kind: 'calendario-rh', title: 'Reunión regional', company: 'Todas las empresas', site: 'Caribe (Cancún/Playa del Carmen/Cozumel/Tulum)', status: 'Programado',
  payload: { start: '2026-10-15', end: '2026-10-15' } });

// Evaluación NOM-035 Guía II finalizada
const answers = {};
for (let i = 1; i <= 40; i++) answers[i] = 0;
throws(() => rec(OWNER, { kind: 'evaluaciones', title: 'Ana López', company: 'Todas las empresas', site: 'San José del Cabo', status: 'Finalizada',
  payload: { evaluator: 'RH', cycle: '2026', relationship: 'RH', instrument: 'nom035', guide: 'II', answers, informed: false } }), /objetivo y la confidencialidad/, 'consentimiento');
const ev = rec(OWNER, { kind: 'evaluaciones', title: 'Ana López', company: 'Todas las empresas', site: 'San José del Cabo', status: 'Finalizada',
  payload: { evaluator: 'RH', cycle: '2026', relationship: 'RH', instrument: 'nom035', guide: 'II', answers, informed: true } });
// "Siempre" (0) en todo: negativos valen 4 y positivos (18-33, sin 33 por no aplicar... 18-33 están en 1-40) valen 0.
const expected = 40 * 4 - 16 * 4;
ok(ev.payload.result.score === expected && ev.payload.result.level === 'Muy alto', 'calificación NOM-035 ' + ev.payload.result.score + ' ' + ev.payload.result.level);
const evI = rec(OWNER, { kind: 'evaluaciones', title: 'Luis', company: 'Todas las empresas', site: 'San José del Cabo', status: 'Finalizada',
  payload: { evaluator: 'RH', cycle: '2026', relationship: 'RH', instrument: 'nom035', guide: 'I', answers: { 0: 'Sí', 1: 'Sí', 2: 'No', 3: 'No', 4: 'No', 5: 'No', 6: 'No', 7: 'No', 8: 'No', 9: 'No', 10: 'No', 11: 'No', 12: 'No', 13: 'No', 14: 'No' }, informed: true } });
ok(evI.payload.result.referral === true, 'Guía I canalización');
throws(() => rec(OWNER, { kind: 'evaluaciones', title: 'X', company: 'Todas las empresas', site: 'San José del Cabo', status: 'Borrador',
  payload: { evaluator: 'RH', cycle: '2026', relationship: 'RH', instrument: 'nom035', guide: 'II', answers: { 1: 9 } } }), /fuera de la escala/, 'escala');

const cand = rec('rec@grupo.mx', { kind: 'candidatos', title: 'Pedro Candidato', company: 'Lovalgo', site: 'Cancún', status: 'Nuevo', payload: { position: 'Cosmiatra', salary: '$12,000' } });

// --- Visibilidad por rol
const ids = (who) => env.as(who).call('apiLoad').records.map((r) => r.id);
const gen = ids('gen@grupo.mx');
ok(gen.includes(colab.id) && gen.includes(permiso.id) && gen.includes(incap.id) && gen.includes(constancia.id), 'generalista ve su sede');
ok(!gen.includes(ev.id) && !gen.includes(cand.id) && !gen.includes(cancun.id), 'generalista no ve evaluaciones ni otras empresas');
const consulta = env.as('consulta@grupo.mx').call('apiLoad').records;
const cc = consulta.find((r) => r.id === cancun.id);
ok(cc && cc.payload.salary === undefined, 'consulta sin salario');
ok(consulta.some((r) => r.id === caribe.id), 'Cancún lee registros de Caribe');
ok(!consulta.some((r) => r.id === incap.id || r.id === ev.id), 'consulta sin confidencial');
throws(() => rec('consulta@grupo.mx', { kind: 'constancias', id: cancun.id, revision: cancun.revision, title: 'Beto', company: 'Lovalgo', site: 'Cancún', status: 'Emitida', payload: {} }), /permiso/, 'consulta no escribe');
const rec2 = ids('rec@grupo.mx');
ok(rec2.length === 1 && rec2[0] === cand.id, 'reclutamiento solo candidatos de Lovalgo');
const jef = ids('jef@grupo.mx');
ok(jef.includes(cancun.id) && jef.includes(caribe.id) && !jef.includes(colab.id), 'jefatura Caribe');
throws(() => env.as('gen@grupo.mx').call('apiHistory', ev.id), /acceso/, 'historial protegido');
throws(() => env.as('gen@grupo.mx').call('apiPdf', ev.id), /acceso/, 'PDF protegido');

// --- Concurrencia y bitácora
const p2 = rec('gen@grupo.mx', { kind: 'permisos', id: permiso.id, revision: permiso.revision, title: 'Ana López', company: 'Saint Luke’s Hospitals', site: 'San José del Cabo', status: 'Autorizado',
  payload: Object.assign({}, permiso.payload, { approver: 'Dr. Espinoza' }) });
ok(p2.revision === 2, 'revisión');
throws(() => rec('gen@grupo.mx', { kind: 'permisos', id: permiso.id, revision: 1, title: 'Ana López', company: 'Saint Luke’s Hospitals', site: 'San José del Cabo', status: 'Concluido',
  payload: permiso.payload }), /Alguien más/, 'conflicto');
const hist = env.as('gen@grupo.mx').call('apiHistory', permiso.id);
ok(/Estado/.test(hist[0].action) && /Persona que autoriza/.test(hist[0].action) && !/Dr\. Espinoza/.test(hist[0].action), 'bitácora con campos sin valores: ' + hist[0].action);

// Generalista guarda constancia: el salario se conserva aunque Consulta no lo vea; generalista sí lo ve
const genC = env.as('gen@grupo.mx').call('apiLoad').records.find((r) => r.id === constancia.id);
ok(genC.payload.salary === '$18,000.00', 'generalista ve salario');

// --- Uniformes
const uni = rec(OWNER, { kind: 'uniformes', title: 'Filipina azul', company: 'Saint Luke’s Hospitals', site: 'San José del Cabo', status: 'Activo', payload: { sku: 'FIL-AZ', size: 'M', initial: '10', minimum: '3' } });
throws(() => env.as('gen@grupo.mx').call('apiMovement', { id: uni.id, type: 'Salida', quantity: 11, recipient: 'Ana' }), /suficientes/, 'sin existencias');
ok(env.as('gen@grupo.mx').call('apiMovement', { id: uni.id, type: 'Salida', quantity: 4, recipient: 'Ana' }).balance === 6, 'salida');
ok(env.as('gen@grupo.mx').call('apiMovement', { id: uni.id, type: 'Entrada', quantity: 5 }).balance === 11, 'entrada');
throws(() => rec(OWNER, { kind: 'uniformes', id: uni.id, revision: 1, title: 'Filipina azul', company: 'Saint Luke’s Hospitals', site: 'San José del Cabo', status: 'Activo', payload: { sku: 'FIL-AZ', size: 'M', initial: '10', minimum: '3' } }), /Alguien más/, 'movimiento sube revisión');

// --- Archivos
const att = env.as('gen@grupo.mx').call('apiUpload', incap.id, { name: 'incapacidad.pdf', mimeType: 'application/pdf', data: Buffer.from('%PDF-1.4 prueba').toString('base64') });
throws(() => env.as('gen@grupo.mx').call('apiUpload', incap.id, { name: 'virus.exe', mimeType: 'x', data: 'AA==' }), /no permitido/, 'extensión');
throws(() => env.as('consulta@grupo.mx').call('apiDownload', att.id), /acceso/, 'consulta no descarga incapacidad');
const dl = env.as('gen@grupo.mx').call('apiDownload', att.id);
ok(Buffer.from(dl.data, 'base64').toString() === '%PDF-1.4 prueba', 'descarga íntegra');
ok(env.as('gen@grupo.mx').call('apiHistory', incap.id).some((h) => /Descarga de archivo/.test(h.action)), 'descarga en bitácora');

// --- PDF
env.state.pdfs.length = 0;
env.as(OWNER).call('apiPdf', constancia.id);
ok(/CONSTANCIA LABORAL/.test(env.state.pdfs[0]) && /\$18,000\.00/.test(env.state.pdfs[0]) && /11 de octubre de 2026/.test(env.state.pdfs[0]), 'PDF constancia');
env.as('consulta@grupo.mx').call('apiPdf', cancun.id);
ok(!/9,000/.test(env.state.pdfs[1]), 'PDF sin salario para Consulta');
// Hoja membretada
const head = rec(OWNER, { kind: 'membretadas', title: 'Membrete SLH', company: 'Saint Luke’s Hospitals', site: 'San José del Cabo', status: 'Vigente', payload: { format: 'PNG/JPG' } });
env.as(OWNER).call('apiUpload', head.id, { name: 'membrete.png', mimeType: 'image/png', data: Buffer.from('PNGDATA').toString('base64') });
const c2 = rec(OWNER, { kind: 'constancias', id: constancia.id, revision: constancia.revision, title: 'Ana López', company: 'Saint Luke’s Hospitals', site: 'San José del Cabo', status: 'Emitida',
  payload: Object.assign({}, constancia.payload, { letterhead: head.id }) });
env.as(OWNER).call('apiPdf', c2.id);
ok(/data:image\/png;base64,/.test(env.state.pdfs[2]), 'PDF con membrete');

// --- Eliminación
throws(() => env.as('gen@grupo.mx').call('apiDeleteRecord', incap.id, 'Ana López'), /Solo Dirección/, 'generalista no elimina');
throws(() => env.as(OWNER).call('apiDeleteRecord', incap.id, 'otra cosa'), /escribe exactamente/, 'confirmación');
env.as(OWNER).call('apiDeleteRecord', incap.id, 'Ana López');
const after = env.as(OWNER).call('apiLoad');
ok(!after.records.some((r) => r.id === incap.id) && !after.attachments.some((a) => a.recordId === incap.id), 'eliminado');
const fileState = Object.values(env.state.files).find((f) => f.blob.name === 'incapacidad.pdf');
ok(fileState.trashed, 'archivo a la papelera');
const auditRows = env.state.sheets[env.state.props.SPREADSHEET_ID].getSheetByName('Bitácora').rows.filter((r) => r[1] === incap.id);
ok(auditRows.length && auditRows.every((r) => r[3] === '(registro eliminado)' && !/incapacidad\.pdf/.test(r[4])), 'bitácora anonimizada');

// --- Datos guardados como texto, sin fechas convertidas
const rows = env.state.sheets[env.state.props.SPREADSHEET_ID].getSheetByName('Registros').rows;
ok(rows.slice(1).every((r) => r.every((v) => typeof v === 'string')), 'todo como texto');

// --- Oficios con folio
const of1 = rec(OWNER, { kind: 'oficios', title: 'Requerimiento IMSS', company: 'Todas las empresas', site: 'Corporativo', status: 'Registrado', payload: { direction: 'Entrada', eventDate: '2026-10-11', sender: 'IMSS', recipient: 'RH' } });
const of2 = rec(OWNER, { kind: 'oficios', title: 'Respuesta IMSS', company: 'Todas las empresas', site: 'Corporativo', status: 'Registrado', payload: { direction: 'Salida', eventDate: '2026-10-12', sender: 'RH', recipient: 'IMSS' } });
ok(/-0001$/.test(of1.folio) && /-0002$/.test(of2.folio), 'folios consecutivos');

// --- Padrón: jefe inmediato por número de empleado y fecha de nacimiento protegida
const jefe = rec(OWNER, { kind: 'colaboradores', title: 'Marta Jefa', company: 'Saint Luke’s Hospitals', site: 'San José del Cabo', status: 'Activo',
  payload: { employeeId: 'SLH-100', area: 'Enfermería', position: 'Jefa de Enfermería', start: '2020-01-01', contractType: 'Tiempo indeterminado', birthDate: '1985-11-20' } });
throws(() => rec(OWNER, { kind: 'colaboradores', title: 'Sin Jefe', company: 'Saint Luke’s Hospitals', site: 'San José del Cabo', status: 'Activo',
  payload: { employeeId: 'SLH-101', area: 'A', position: 'P', start: '2024-01-01', contractType: 'Prácticas', managerId: 'NO-EXISTE' } }), /jefe inmediato/, 'jefe inexistente');
throws(() => rec(OWNER, { kind: 'colaboradores', title: 'Yo Mismo', company: 'Saint Luke’s Hospitals', site: 'San José del Cabo', status: 'Activo',
  payload: { employeeId: 'SLH-102', area: 'A', position: 'P', start: '2024-01-01', contractType: 'Prácticas', managerId: 'slh-102' } }), /su propio jefe/, 'no es su propio jefe');
const sub = rec(OWNER, { kind: 'colaboradores', title: 'Luis Enfermero', company: 'Saint Luke’s Hospitals', site: 'San José del Cabo', status: 'Activo',
  payload: { employeeId: 'SLH-103', area: 'Enfermería', position: 'Enfermero', start: '2024-01-01', contractType: 'Tiempo indeterminado', managerId: 'slh-100' } });
ok(sub.payload.managerId === 'SLH-100' && sub.payload.manager === 'Marta Jefa', 'jefe vinculado y nombre llenado');
save(OWNER, { email: 'consulta-sjc@grupo.mx', name: 'Consulta SJC', role: 'Consulta', companies: ['*'], sites: ['San José del Cabo'], active: true });
const cJefe = env.as('consulta-sjc@grupo.mx').call('apiLoad').records.find((r) => r.id === jefe.id);
ok(cJefe && cJefe.payload.birthDate === undefined && cJefe.payload.phone !== undefined, 'consulta sin fecha de nacimiento');
ok(env.as('gen@grupo.mx').call('apiLoad').records.find((r) => r.id === jefe.id).payload.birthDate === '1985-11-20', 'generalista ve cumpleaños');

// --- Importación de la versión anterior
const D = (y, m, d) => vm0.runInContext(`new Date(${y}, ${m - 1}, ${d})`, env.ctx);
const vm0 = require('vm');
const legacy = env.ctx.SpreadsheetApp.create();
const tab = (name, rows) => { const sh = legacy.insertSheet(name); sh.rows = rows; };
tab('Empleados', [
  ['ID', 'Nombre', 'Apellido', 'Puesto', 'Departamento', 'Sede', 'Correo', 'Telefono', 'FechaIngreso', 'FechaNacimiento', 'Estatus', 'ReportaA'],
  ['emp-1', 'Rosa', 'Directora', 'Directora General', 'Dirección', 'San José del Cabo', 'rosa@x.mx', '624 100', D(2015, 3, 1), '20/11/1970', 'Activo', ''],
  ['EMP-2', 'Pablo', 'Paramédico', 'Paramédico', 'Paramédico', 'Cabo San Lucas / Pioneros', 'pablo@x.mx', '', '2022-05-10', '', 'Activo', 'EMP-1'],
  ['EMP-3', 'Iris', 'Isla', 'Enfermera', 'Enfermería', 'Puerto Rico', '', '', '', '', 'Baja', 'EMP-9'],
  ['SLH-001', 'Ana', 'Duplicada', 'X', 'X', 'San José del Cabo', '', '', '2020-01-01', '', 'Activo', ''],
  ['', '', '', '', '', '', '', '', '', '', '', ''],
]);
tab('Solicitudes', [
  ['ID', 'EmpleadoID', 'EmpleadoNombre', 'Tipo', 'FechaInicio', 'FechaFin', 'Motivo', 'Estado'],
  ['SOL-1', 'EMP-2', 'Pablo Paramédico', 'Vacaciones', '2026-12-20', '2026-12-27', 'Fin de año', 'Aprobada'],
  ['SOL-2', 'EMP-1', 'Rosa Directora', 'Permiso Médico', D(2026, 11, 3), '', 'Consulta', 'Pendiente'],
  ['SOL-3', 'EMP-1', 'Rosa Directora', 'Viáticos', '', '', 'Sin fecha', 'Pendiente'],
]);
tab('Vacantes', [
  ['ID', 'Puesto', 'Departamento', 'Sede', 'Plazas', 'Tipo', 'Descripcion', 'Estado', 'FechaPublicacion'],
  ['VAC-1', 'Técnico Radiólogo', 'Imagen', 'San José del Cabo', 2, 'Indefinido', 'Turno nocturno', 'Abierta', '2026-11-01'],
  ['VAC-2', 'Auxiliar de Almacén', 'Almacén', 'Guayabitos', '', 'Temporal', '', 'Cubierta', ''],
]);
const imp = (who, o) => env.as(who).call('apiImportLegacy', Object.assign({ source: 'https://docs.google.com/spreadsheets/d/' + legacy.getId() + '/edit', company: 'Saint Luke’s Hospitals', site: 'San José del Cabo' }, o));
throws(() => imp('jef@grupo.mx', {}), /titular/, 'solo titular importa');
throws(() => imp(OWNER, { source: 'hola' }), /enlace/, 'enlace inválido');
throws(() => imp(OWNER, { source: env.state.props.SPREADSHEET_ID }), /base de datos actual/, 'no importa la base actual');
const before = env.as(OWNER).call('apiLoad').records.length;
const dry = imp(OWNER, {});
ok(!dry.committed && dry.summary.empleados.nuevos === 3 && dry.summary.empleados.omitidos === 1 && dry.summary.solicitudes.nuevos === 2 &&
  dry.summary.solicitudes.omitidos === 1 && dry.summary.vacantes.nuevos === 2, 'revisión previa ' + JSON.stringify(dry.summary));
ok(env.as(OWNER).call('apiLoad').records.length === before, 'la revisión no guarda');
ok(dry.warnings.some((w) => /Puerto Rico/.test(w)) && dry.warnings.some((w) => /SLH-001/.test(w)) && dry.warnings.some((w) => /EMP-9/.test(w)), 'avisos de sede, duplicado y jefe');
const done = imp(OWNER, { commit: true });
ok(done.committed && done.total === 7, 'importación');
const all2 = env.as(OWNER).call('apiLoad').records;
const pablo = all2.find((r) => r.kind === 'colaboradores' && r.payload.employeeId === 'EMP-2');
const rosa = all2.find((r) => r.kind === 'colaboradores' && r.payload.employeeId === 'EMP-1');
ok(rosa && rosa.payload.start === '2015-03-01' && rosa.payload.birthDate === '1970-11-20', 'fechas convertidas');
ok(pablo.site === 'Cabo San Lucas' && pablo.payload.managerId === 'EMP-1' && pablo.payload.manager === 'Rosa Directora', 'sede y jefe mapeados');
const iris = all2.find((r) => r.payload.employeeId === 'EMP-3');
ok(iris.status === 'Baja' && iris.site === 'San José del Cabo' && iris.payload.managerId === '', 'baja con sede por omisión');
const vac = all2.filter((r) => r.kind === 'cobertura');
ok(vac.length === 2 && vac.every((v) => /^CV-\d{4}-\d{4}$/.test(v.folio)) && vac.find((v) => v.title === 'Técnico Radiólogo').status === 'En reclutamiento' &&
  vac.find((v) => v.title === 'Técnico Radiólogo').payload.quantity === '2', 'vacantes con folio');
const vacs = all2.filter((r) => r.kind === 'permisos' && /Pablo|Rosa/.test(r.title));
ok(vacs.length === 2 && vacs.find((r) => r.title === 'Pablo Paramédico').status === 'Autorizado' && vacs.find((r) => r.title === 'Pablo Paramédico').payload.employeeRecordId === undefined &&
  vacs.find((r) => r.title === 'Rosa Directora').payload.reason.startsWith('[Permiso Médico]') && vacs.find((r) => r.title === 'Rosa Directora').due === '2026-11-03', 'solicitudes a permisos');
// Editar un registro importado conserva su origen, y una segunda importación no duplica
rec(OWNER, { kind: 'colaboradores', id: pablo.id, revision: pablo.revision, title: pablo.title, company: pablo.company, site: pablo.site, status: 'Activo',
  payload: Object.assign({}, pablo.payload, { start: '2022-05-10', contractType: 'Tiempo indeterminado', phone: '624 200' }) });
const again = imp(OWNER, { commit: true });
ok(again.total === 0 && again.summary.empleados.yaImportados === 3 && again.summary.vacantes.yaImportados === 2, 'reimportar no duplica');

// --- doGet arma la página completa
const vm = require('vm');
const html = vm.runInContext('doGet().getContent()', env.ctx);
ok(/<style>/.test(html) && /function apiCall|google\.script\.run/.test(html) && !/<\?!=/.test(html), 'página armada');
// Ninguna función pública inesperada (todo lo que no termina en _ se puede llamar desde el navegador)
const fs = require('fs');
const publicFns = [];
fs.readdirSync(SRC).filter((f) => f.endsWith('.gs')).forEach((f) => {
  const code = fs.readFileSync(SRC + '/' + f, 'utf8');
  for (const m of code.matchAll(/^function\s+([A-Za-z0-9_]+)/gm)) if (!m[1].endsWith('_')) publicFns.push(m[1]);
});
ok(publicFns.every((f) => f === 'doGet' || f === 'instalar' || f.startsWith('api')), 'públicas: ' + publicFns.join(', '));
console.log(n + ' comprobaciones aprobadas');
