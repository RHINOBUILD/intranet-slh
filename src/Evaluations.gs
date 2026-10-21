/** Instrumentos de evaluación y su calificación. */

const NOM_SOURCE_ = 'https://dof.gob.mx/normasOficiales/7415/stps2a11_C/stps2a11_C.html';
const RISK_LEVELS_ = ['Nulo o despreciable', 'Bajo', 'Medio', 'Alto', 'Muy alto'];

const EVALUATION_TYPES_ = [
  { id: 'paramedicos', label: 'Evaluación de paramédicos', description: 'Rúbrica de observación del desempeño operativo. No sustituye certificaciones ni pruebas prácticas supervisadas.' },
  { id: '360', label: 'Evaluación 360°', description: 'Valoración por supervisor, pares, colaboradores y autoevaluación.' },
  { id: 'desempeno', label: 'Evaluación de desempeño', description: 'Objetivos, calidad y competencias, con acuerdos de mejora.' },
  { id: 'rh', label: 'Evaluación de RH', description: 'Atención, trazabilidad y calidad de los procesos de Capital Humano.' },
  { id: 'nom035', label: 'NOM-035', description: 'Guías de referencia I, II y III de la NOM-035-STPS-2018, con calificación y niveles de riesgo.' },
];

function block_(dimension, items, offset) {
  return items.map(function (text, i) { return { id: i + offset, text: text, dimension: dimension }; });
}

const RUBRICS_ = {
  paramedicos: [].concat(
    block_('Seguridad y protocolos', ['Verifica identidad del paciente conforme al protocolo vigente.', 'Documenta valoración y signos de acuerdo con su alcance autorizado.', 'Aplica precauciones y utiliza equipo de protección.', 'Comunica oportunamente incidentes y cambios relevantes.'], 1),
    block_('Operación', ['Revisa la unidad y el equipo al inicio del turno.', 'Verifica existencias y vigencias de insumos asignados.', 'Cumple la entrega y recepción del servicio.', 'Registra actividades de forma completa y legible.'], 5),
    block_('Trabajo en equipo', ['Coordina la atención con el equipo responsable.', 'Mantiene trato respetuoso con pacientes y acompañantes.', 'Solicita apoyo cuando la situación supera su alcance.', 'Cumple horarios y acuerdos operativos.'], 9)),
  '360': [].concat(
    block_('Liderazgo', ['Comunica con claridad los objetivos y prioridades.', 'Distribuye responsabilidades de forma organizada.', 'Da retroalimentación útil y respetuosa.'], 1),
    block_('Colaboración', ['Escucha las opiniones del equipo.', 'Resuelve diferencias con respeto.', 'Apoya el trabajo entre áreas.'], 4),
    block_('Integridad', ['Cumple acuerdos y compromisos.', 'Actúa con transparencia en las decisiones.', 'Protege la información confidencial.'], 7),
    block_('Resultados', ['Da seguimiento a los compromisos.', 'Propone mejoras útiles para la operación.', 'Mantiene la calidad del trabajo bajo presión.'], 10)),
  desempeno: [].concat(
    block_('Resultados', ['Cumple los objetivos acordados del periodo.', 'Entrega actividades en los plazos establecidos.', 'Mantiene la calidad requerida en su trabajo.'], 1),
    block_('Competencias', ['Aplica los conocimientos necesarios para su puesto.', 'Sigue los procesos y protocolos vigentes.', 'Resuelve problemas y comunica necesidades de apoyo.'], 4),
    block_('Colaboración', ['Mantiene una comunicación oportuna con su equipo.', 'Colabora con otras áreas.', 'Atiende con respeto a usuarios internos y externos.'], 7),
    block_('Responsabilidad', ['Cumple horarios y compromisos.', 'Documenta y protege la información a su cargo.', 'Participa en actividades de mejora y aprendizaje.'], 10)),
  rh: [].concat(
    block_('Servicio', ['Da respuesta oportuna a solicitudes.', 'Orienta con información clara y consistente.', 'Mantiene trato respetuoso e imparcial.'], 1),
    block_('Control y trazabilidad', ['Conserva documentación completa y actualizada.', 'Registra incidencias y seguimiento sin omisiones.', 'Mantiene confidencialidad de la información.'], 4),
    block_('Gestión', ['Da seguimiento a vacantes y contrataciones.', 'Coordina la inducción y capacitación requerida.', 'Comunica oportunamente políticas y procesos.'], 7),
    block_('Mejora', ['Identifica necesidades de las sedes.', 'Da seguimiento a acuerdos y acciones de mejora.', 'Presenta indicadores útiles para la toma de decisiones.'], 10)),
};

function riskLevel_(score, cuts) {
  return RISK_LEVELS_[cuts.filter(function (c) { return score >= c; }).length];
}

function questionsFor_(p) {
  if (p.instrument !== 'nom035') return RUBRICS_[p.instrument] || [];
  var d = NOM035_[p.guide];
  if (!d) return [];
  var answers = p.answers || {};
  if (p.guide === 'I') return d.questions.filter(function (q) { return q.id === 0 || answers['0'] === 'Sí'; });
  return d.questions.filter(function (q) {
    if (p.guide === 'II') return q.id <= 40 || (q.id <= 43 ? !!p.customers : !!p.supervises);
    return q.id <= 64 || (q.id <= 68 ? !!p.customers : !!p.supervises);
  });
}

function scoreEvaluation_(p, final) {
  if (!EVALUATION_TYPES_.some(function (t) { return t.id === p.instrument; })) throw new Error('Selecciona una evaluación válida.');
  if (p.instrument === 'nom035' && ['I', 'II', 'III'].indexOf(p.guide) === -1) throw new Error('Selecciona una guía válida.');
  var qs = questionsFor_(p);
  var a = p.answers || {};
  if (final && !p.informed) throw new Error('Confirma que se explicó el objetivo y la confidencialidad de la evaluación.');
  if (final && qs.some(function (q) { return a[q.id] === undefined || a[q.id] === ''; })) throw new Error('Responde todos los reactivos que aplican antes de finalizar.');
  qs.forEach(function (q) {
    var v = a[q.id];
    if (v === undefined || v === '') return;
    if (p.instrument === 'nom035' && p.guide === 'I') {
      if (['Sí', 'No'].indexOf(v) === -1) throw new Error('Respuesta no válida.');
    } else {
      var n = Number(v), lo = p.instrument === 'nom035' ? 0 : 1, hi = p.instrument === 'nom035' ? 4 : 5;
      if (!(n % 1 === 0) || n < lo || n > hi) throw new Error('Respuesta fuera de la escala.');
    }
  });
  if (!final) return null;

  if (p.instrument !== 'nom035') {
    var dims = {}, total = 0, order = [];
    qs.forEach(function (q) {
      var val = Number(a[q.id]);
      total += val;
      var key = q.dimension || 'General';
      if (!dims[key]) { dims[key] = { sum: 0, count: 0 }; order.push(key); }
      dims[key].sum += val;
      dims[key].count++;
    });
    return {
      version: 'Rúbrica operativa v1', score: Math.round((total / (qs.length * 5)) * 100), average: Number((total / qs.length).toFixed(2)),
      dimensions: order.map(function (k) { return { label: k, score: Number((dims[k].sum / dims[k].count).toFixed(2)), count: dims[k].count }; }),
      answered: qs.length,
    };
  }

  if (p.guide === 'I') {
    if (a['0'] === 'No') return { guide: 'I', referral: false, result: 'No se reportó acontecimiento traumático severo', answered: 1 };
    var yes = function (lo, hi) { return qs.filter(function (q) { return q.id >= lo && q.id <= hi && a[q.id] === 'Sí'; }).length; };
    var memories = yes(1, 2), avoidance = yes(3, 9), effects = yes(10, 14);
    var referral = memories >= 1 || avoidance >= 3 || effects >= 2;
    return {
      guide: 'I', referral: referral,
      result: referral ? 'Requiere canalización para atención' : 'Sin criterio de canalización en este cuestionario',
      memories: memories, avoidance: avoidance, effects: effects, answered: qs.length,
    };
  }

  var data = NOM035_[p.guide], scores = {};
  qs.forEach(function (q) {
    var r = Number(a[q.id]);
    scores[q.id] = data.positive.indexOf(q.id) !== -1 ? r : 4 - r;
  });
  var sum = function (items) { return items.reduce(function (n, i) { return n + (scores[i] || 0); }, 0); };
  var score = sum(qs.map(function (q) { return q.id; }));
  var breakdown = function (groups, cuts) {
    return Object.keys(groups).map(function (label) {
      var s = sum(groups[label]);
      return { label: label, score: s, level: riskLevel_(s, cuts[label]) };
    });
  };
  return {
    guide: p.guide, score: score, level: riskLevel_(score, data.totalCuts),
    categories: breakdown(data.groups.categories, data.categoryCuts),
    domains: breakdown(data.groups.domains, data.domainCuts),
    answered: qs.length, source: NOM_SOURCE_,
  };
}

/** Datos que la interfaz necesita para aplicar evaluaciones (solo a roles autorizados). */
function evaluationCatalog_() {
  return {
    types: EVALUATION_TYPES_,
    rubrics: RUBRICS_,
    nom035: {
      I: NOM035_.I.questions,
      II: NOM035_.II.questions,
      III: NOM035_.III.questions,
    },
  };
}
