// Servidor de vista previa: sirve la web app y atiende google.script.run con el simulador.
const http = require('http');
const vm = require('vm');
const { makeEnv } = require('./gas-sim');
const SRC = process.argv[2];
const OWNER = 'direccion@grupo-demo.mx';
const env = makeEnv(SRC, OWNER);

function day(offset) {
  const d = new Date(Date.now() + offset * 86400000);
  return env.ctx.Utilities.formatDate(d, 'America/Mazatlan', 'yyyy-MM-dd');
}

// ---- Datos de demostración (ficticios) ----
env.as(OWNER).call('instalar');
const acc = (o) => env.as(OWNER).call('apiAccessSave', Object.assign({ active: true }, o));
acc({ email: 'generalista@grupo-demo.mx', name: 'Mariana Torres', role: 'Generalista RH', companies: ['Saint Luke’s Hospitals'], sites: ['San José del Cabo', 'Cabo San Lucas'] });
acc({ email: 'jefatura@grupo-demo.mx', name: 'Daniela Ruiz', role: 'Jefatura RH', companies: ['*'], sites: ['*'], admin: true });
acc({ email: 'consulta@grupo-demo.mx', name: 'Óscar Medina', role: 'Consulta', companies: ['*'], sites: ['Cancún'] });
acc({ email: 'reclutamiento@grupo-demo.mx', name: 'Paola Ríos', role: 'Reclutamiento', companies: ['Lovalgo', 'Saint Luke’s Hospitals'], sites: ['*'] });
const S = (o) => env.as(OWNER).call('apiSave', Object.assign({ status: '', owner: 'Mariana Torres', due: '', notes: '', payload: {} }, o));
const SLH = 'Saint Luke’s Hospitals';
const people = [
  ['Ana Lucía Peña', 'SLH-0142', 'Enfermería', 'Enfermera general', 'San José del Cabo'],
  ['Jorge Castillo', 'SLH-0157', 'Urgencias', 'Médico general', 'San José del Cabo'],
  ['Valeria Núñez', 'SLH-0163', 'Laboratorio', 'Química', 'Cabo San Lucas'],
  ['Ricardo Salas', 'SLH-0171', 'Mantenimiento', 'Técnico', 'Cabo San Lucas'],
  ['Fernanda Ortiz', 'SLH-0188', 'Admisión', 'Recepcionista', 'San José del Cabo'],
];
const ids = {};
people.forEach((p, i) => {
  ids[p[1]] = S({ kind: 'colaboradores', title: p[0], company: SLH, site: p[4], status: 'Activo',
    payload: { employeeId: p[1], area: p[2], position: p[3], start: '202' + (2 + (i % 3)) + '-0' + (i + 2) + '-15', contractType: 'Tiempo indeterminado' } });
});
S({ kind: 'contratos', title: 'Jorge Castillo', company: SLH, site: 'San José del Cabo', status: 'Por renovar',
  payload: { employeeId: 'SLH-0157', area: 'Urgencias', position: 'Médico general', type: 'Tiempo determinado', start: '2026-04-20', end: day(4) } });
S({ kind: 'contratos', title: 'Valeria Núñez', company: SLH, site: 'Cabo San Lucas', status: 'Vigente',
  payload: { employeeId: 'SLH-0163', area: 'Laboratorio', position: 'Química', type: 'Tiempo determinado', start: '2026-01-10', end: day(19) } });
S({ kind: 'permisos', title: 'Ana Lucía Peña', company: SLH, site: 'San José del Cabo', status: 'Pendiente',
  payload: { employeeId: 'SLH-0142', area: 'Enfermería', position: 'Enfermera general', type: 'Vacaciones', start: day(-6), end: day(-2), reason: 'Vacaciones del primer periodo', approver: 'Jefatura de Enfermería' } });
S({ kind: 'permisos', title: 'Fernanda Ortiz', company: SLH, site: 'San José del Cabo', status: 'Autorizado',
  payload: { employeeId: 'SLH-0188', area: 'Admisión', position: 'Recepcionista', type: 'Permiso con goce', start: day(2), end: day(2), reason: 'Trámite personal' } });
S({ kind: 'incapacidades', title: 'Ricardo Salas', company: SLH, site: 'Cabo San Lucas', status: 'En seguimiento',
  payload: { employeeId: 'SLH-0171', area: 'Mantenimiento', position: 'Técnico', folio: 'LC482931', institution: 'IMSS', type: 'Subsecuente', start: day(-10), end: day(3), days: '14' } });
S({ kind: 'cobertura', title: 'Enfermera general', company: SLH, site: 'San José del Cabo', status: 'Autorizada',
  payload: { requester: 'Jefatura de Enfermería', requesterPosition: 'Jefa de piso', area: 'Hospitalización', quantity: '2', type: 'Reemplazo', priority: 'Alta', requiredDate: day(12), schedule: 'Nocturno, 12x36', reason: 'Dos renuncias en el turno nocturno' } });
S({ kind: 'candidatos', title: 'Luis Herrera', company: 'Lovalgo', site: 'San José del Cabo', status: 'Entrevista', payload: { position: 'Cosmiatra', interview: day(1), source: 'Bolsa de trabajo' } });
S({ kind: 'calendario-cap', title: 'RCP básico', company: 'Todas las empresas', site: 'San José del Cabo', status: 'Programado',
  payload: { start: day(6), end: day(6), entry: '09:00', trainer: 'Centro de Capacitación', audience: 'Enfermería', hours: '4' } });
S({ kind: 'calendario-cap', title: 'Higiene de manos', company: 'Todas las empresas', site: 'Cabo San Lucas', status: 'Programado',
  payload: { start: day(9), end: day(9), entry: '11:00', trainer: 'Epidemiología', audience: 'Todo el personal', hours: '1' } });
S({ kind: 'calendario-cap', title: 'Manejo de residuos RPBI', company: 'Todas las empresas', site: 'San José del Cabo', status: 'Completado',
  payload: { start: day(-3), end: day(-3), entry: '08:00', trainer: 'Seguridad e Higiene', hours: '2' } });
S({ kind: 'uniformes', title: 'Filipina quirúrgica', company: SLH, site: 'San José del Cabo', status: 'Activo', payload: { sku: 'FQ-AZ', size: 'M', color: 'Azul', initial: '24', minimum: '8' } });
S({ kind: 'uniformes', title: 'Filipina quirúrgica', company: SLH, site: 'San José del Cabo', status: 'Activo', payload: { sku: 'FQ-AZ', size: 'G', color: 'Azul', initial: '6', minimum: '8' } });
S({ kind: 'especialistas', title: 'Dra. Carolina Vega', company: 'Médicos Especialistas', site: 'San José del Cabo', status: 'Por vencer',
  payload: { specialty: 'Ginecología', license: '8812345', expiry: day(25) } });
S({ kind: 'oficios', title: 'Requerimiento de información STPS', company: 'Todas las empresas', site: 'Corporativo', status: 'En seguimiento',
  payload: { direction: 'Entrada', eventDate: day(-5), sender: 'STPS', recipient: 'Capital Humano', responseDate: day(-1) } });

// ---- Servidor ----
const shim = `<script>
(function(){
  var as = new URLSearchParams(location.search).get('as') || '';
  function runner(ok, err){
    return new Proxy({}, { get: function(_, name){
      if (name === 'withSuccessHandler') return function(f){ return runner(f, err); };
      if (name === 'withFailureHandler') return function(f){ return runner(ok, f); };
      return function(){
        var args = Array.prototype.slice.call(arguments);
        fetch('/rpc', { method: 'POST', body: JSON.stringify({ fn: name, args: args, as: as }) })
          .then(function(r){ return r.json(); })
          .then(function(d){ setTimeout(function(){ d.error ? err && err(new Error(d.error)) : ok && ok(d.result); }, 60); });
      };
    }});
  }
  window.google = { script: { run: runner(null, null) } };
})();
</script>`;

http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/rpc') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const { fn, args, as } = JSON.parse(body);
      let out;
      try {
        if (!/^api[A-Z]/.test(fn)) throw new Error('Función privada');
        out = { result: env.as(as).call(fn, ...args) };
      } catch (e) {
        out = { error: e.message };
      }
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(out));
    });
    return;
  }
  const html = vm.runInContext('doGet().getContent()', env.ctx).replace('<script>', shim + '<script>');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(html);
}).listen(8765, () => console.log('listo en http://localhost:8765'));
