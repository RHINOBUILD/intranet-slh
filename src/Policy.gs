/**
 * Política de acceso. Se aplica SIEMPRE en el servidor: el navegador solo recibe
 * los registros que el usuario puede ver, ya sin los campos que no le corresponden.
 */

const ADMIN_CAPABLE_ROLES_ = ['Dirección RH', 'Jefatura RH'];
const RECRUITMENT_KINDS_ = ['candidatos', 'cobertura', 'perfiles', 'procesos'];
const TRAINING_KINDS_ = ['calendario-cap', 'procesos'];

// Módulos confidenciales y los únicos roles que pueden abrirlos.
const RESTRICTED_KINDS_ = {
  evaluaciones: ['Dirección RH', 'Jefatura RH'],
  incapacidades: ['Dirección RH', 'Jefatura RH', 'Generalista RH'],
};

// Campos sensibles (salario, fecha de nacimiento) ocultos a quien no tiene un rol operativo de RH.
const SENSITIVE_FIELDS_ = { constancias: ['salary', 'salaryPeriod'], candidatos: ['salary'], colaboradores: ['birthDate'] };
const SENSITIVE_FIELD_ROLES_ = ['Dirección RH', 'Jefatura RH', 'Generalista RH', 'Reclutamiento'];

// Sedes que agrupan a otras.
const SITE_GROUPS_ = {
  'Caribe (Cancún/Playa del Carmen/Cozumel/Tulum)': ['Cancún', 'Playa del Carmen', 'Cozumel', 'Tulum'],
  Vallarta: ['Puerto Vallarta', 'Nuevo Vallarta'],
  Nayarit: ['Nuevo Vallarta', 'San Pancho', 'Sayulita', 'Guayabitos'],
};

function isAdmin_(g) {
  return !!(g && g.active && g.admin && ADMIN_CAPABLE_ROLES_.indexOf(g.role) !== -1);
}

function canSeeSensitive_(g) {
  return !!(g && g.active && SENSITIVE_FIELD_ROLES_.indexOf(g.role) !== -1);
}

function canAccessKind_(g, kind) {
  if (!g || !g.active) return false;
  var allowed = RESTRICTED_KINDS_[kind];
  if (allowed && allowed.indexOf(g.role) === -1) return false;
  if (g.role === 'Reclutamiento' && RECRUITMENT_KINDS_.indexOf(kind) === -1) return false;
  if (g.role === 'Capacitación' && TRAINING_KINDS_.indexOf(kind) === -1) return false;
  return true;
}

function writableSites_(g) {
  var out = [];
  g.sites.forEach(function (s) {
    if (out.indexOf(s) === -1) out.push(s);
    (SITE_GROUPS_[s] || []).forEach(function (m) { if (out.indexOf(m) === -1) out.push(m); });
  });
  return out;
}

function readableSites_(g) {
  var own = writableSites_(g);
  Object.keys(SITE_GROUPS_).forEach(function (group) {
    if (own.indexOf(group) === -1 && SITE_GROUPS_[group].some(function (m) { return own.indexOf(m) !== -1; })) own.push(group);
  });
  return own;
}

function siteAllowed_(g, site, write) {
  if (site === ALL_SITES || g.sites.indexOf('*') !== -1) return true;
  return (write ? writableSites_(g) : readableSites_(g)).indexOf(site) !== -1;
}

/** ¿Puede el usuario leer (o escribir) este registro? */
function permits_(g, r, write) {
  if (!g || !g.active) return false;
  if (write && g.role === 'Consulta') return false;
  var common = r.company === ALL_COMPANIES;
  if (common && write && g.role !== 'Dirección RH') return false;
  if (!common && g.companies.indexOf('*') === -1 && g.companies.indexOf(r.company) === -1) return false;
  if (!siteAllowed_(g, r.site, write)) return false;
  return canAccessKind_(g, r.kind);
}

function hiddenFields_(g, kind) {
  return canSeeSensitive_(g) ? [] : SENSITIVE_FIELDS_[kind] || [];
}

/** Copia del registro sin campos que el rol no debe ver. */
function redact_(g, r) {
  var hidden = hiddenFields_(g, r.kind);
  if (!hidden.length) return r;
  var copy = JSON.parse(JSON.stringify(r));
  hidden.forEach(function (k) { delete copy.payload[k]; });
  copy.hidden = hidden;
  return copy;
}

/** Puede administrar el módulo (crear/editar) en al menos una empresa. */
function canWriteKind_(g, kind) {
  if (!g || !g.active || g.role === 'Consulta') return false;
  return canAccessKind_(g, kind);
}

/** Puede eliminar definitivamente (para solicitudes ARCO de cancelación). */
function canDelete_(g, r) {
  return !!(g && g.active && g.role === 'Dirección RH' && permits_(g, r, true));
}
