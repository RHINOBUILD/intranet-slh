/**
 * Catálogo de plataformas del grupo que se abren desde la intranet.
 * Solo enlaces publicados y verificados. Para agregar otras sin tocar el código,
 * usa "Agregar plataforma" en la sección Plataformas (queda como registro con bitácora).
 */

const PLATFORM_CATEGORIES = [
  'Evaluación y desarrollo',
  'Capacitación',
  'Reclutamiento y selección',
  'Asistencia y personal',
  'Operación hospitalaria',
  'Documentos y trámites',
];

const PLATFORM_AUDIENCES = ['Capital Humano', 'Colaboradores', 'Candidatos', 'Público'];

function p_(id, name, short, category, audience, url, description, featured) {
  return { id: id, name: name, short: short, category: category, audience: audience, url: url, description: description, featured: !!featured, builtIn: true };
}

const PLATFORMS = [
  // Evaluación y desarrollo
  p_('desempeno', 'Portal de Evaluaciones de Desempeño', 'ED', 'Evaluación y desarrollo', 'Colaboradores',
    'https://rhinobuild.github.io/evaluacion_de_desempe-o_slh/', '15 puestos, dos instrumentos por puesto y reporte en PDF.', true),
  p_('bph360-panel', 'Panel RH · BPH-360', 'BP', 'Evaluación y desarrollo', 'Capital Humano',
    'https://rhinobuild.github.io/BPH360/', 'Resultados, confiabilidad, baremos y seguimiento de desempeño de nuevos ingresos.', true),
  p_('bph360', 'Evaluación BPH-360', 'B3', 'Evaluación y desarrollo', 'Candidatos',
    'https://rhinobuild.github.io/evaluacionBPH360/', 'Prueba de competencias hospitalarias para candidatos clínicos, operativos y administrativos.'),
  p_('ipip', 'Evaluación psicométrica de ingreso (IPIP-NEO-120 + SJT)', 'IP', 'Evaluación y desarrollo', 'Candidatos',
    'https://rhinobuild.github.io/PRUEBA-IPIP-NEO-120/', 'Personalidad en 120 reactivos y escenarios de juicio situacional por área.'),
  p_('nom035-panel', 'Panel NOM-035', 'N35', 'Evaluación y desarrollo', 'Capital Humano',
    'https://rhinobuild.github.io/NOM035/', 'Centros de trabajo, aplicación y resultados de las guías de riesgo psicosocial.', true),
  p_('nom035-encuesta', 'Encuesta NOM-035', 'N35', 'Evaluación y desarrollo', 'Colaboradores',
    'https://rhinobuild.github.io/NOM035/encuesta.html', 'Cuestionario para el personal (guías I, II y III).'),
  p_('prehospitalarias', 'Evaluaciones prehospitalarias 911', '911', 'Evaluación y desarrollo', 'Candidatos',
    'https://rhinobuild.github.io/911-evaluaciones/Sin%20t%C3%ADtulo.html', 'Atención prehospitalaria, paramédico TSU y operador de ambulancias.'),

  // Capacitación
  p_('cce', 'CCE 2.0 · Centro de Capacitación y Enseñanza', 'CCE', 'Capacitación', 'Colaboradores',
    'https://capacitacion.rhinobuild.org/', 'Cursos asignados, evaluaciones AESP y constancias con folio.', true),
  p_('nexosalud', 'NEXOSalud · Generador de cursos', 'NX', 'Capacitación', 'Capital Humano',
    'https://rhinobuild.github.io/generador_de_cursos/', 'Convierte documentos en cursos y presentaciones con IA.'),

  // Reclutamiento y selección
  p_('vacantes', 'Bolsa de Trabajo', 'BT', 'Reclutamiento y selección', 'Público',
    'https://rhinobuild.github.io/vacantes/', 'Página pública de vacantes y postulaciones.', true),
  p_('entrevista', 'Entrevista en línea', 'EL', 'Reclutamiento y selección', 'Candidatos',
    'https://rhinobuild.github.io/BPH360/entrevista.html', 'Entrevista inicial en línea para candidatos.'),
  p_('cobertura-puestos', 'Control de Cobertura de Puestos', 'CP', 'Reclutamiento y selección', 'Capital Humano',
    'https://rhinobuild.github.io/cobertura_de_puesto/', 'Solicitud, autorización y seguimiento de coberturas (versión independiente).'),

  // Asistencia y personal
  p_('checador', 'Checador móvil', 'CH', 'Asistencia y personal', 'Colaboradores',
    'https://rhinobuild.github.io/checador_movil_slh/', 'Registro de entrada y salida con reconocimiento facial y ubicación.'),
  p_('checkin', 'Check-in de ambulancias y comercial', 'CI', 'Asistencia y personal', 'Colaboradores',
    'https://rhinobuild.github.io/checador_movil_slh/checkin.html', 'Reporte periódico de estado o actividad en campo.'),
  p_('asistencia', 'Panel RH de asistencia', 'PA', 'Asistencia y personal', 'Capital Humano',
    'https://rhinobuild.github.io/checador_movil_slh/panel.html', 'Registros del checador, horarios y excepciones.', true),
  p_('gafetes', 'Generador de Gafetes', 'GF', 'Asistencia y personal', 'Capital Humano',
    'https://rhinobuild.github.io/GAFETES_SLH/', 'Gafetes de hospitales y ambulancias (Baywatch y Richport) listos para imprimir.'),

  // Operación hospitalaria
  p_('enfermeria', 'Registros de Enfermería', 'RE', 'Operación hospitalaria', 'Colaboradores',
    'https://script.google.com/macros/s/AKfycbxmRvy99heCvbfrCxpTiSgQF218wLszBbR2nBKpNYQxlOvHklefaNLbeicbyR0Zh24/exec', 'Bitácoras y listas de verificación por área: UCI, UCIN, Quirófano, Urgencias, CEYE.'),
  p_('mantenimiento', 'Mantenimiento SLH', 'MT', 'Operación hospitalaria', 'Colaboradores',
    'https://rhinobuild.github.io/mantenimiento_slh/', 'Bitácoras FO-SLH-MTO, puntos con código QR y tickets.'),
  p_('calidad', 'Calidad Hospitalaria', 'CA', 'Operación hospitalaria', 'Colaboradores',
    'https://rhinobuild.github.io/Calidad_Hospitalaria_SLH/', 'Evidencias, aprobaciones y formación del sistema de calidad.'),
  p_('cpt', 'Catálogo CPT', 'CPT', 'Operación hospitalaria', 'Capital Humano',
    'https://rhinobuild.github.io/catalogo_cpt/', 'Códigos CPT y cálculo de honorarios médicos por aseguradora.'),

  // Documentos y trámites
  p_('constancias', 'Generador de Constancias Laborales', 'CL', 'Documentos y trámites', 'Capital Humano',
    'https://rhinobuild.github.io/generador_de_constancias_laborales/', 'Constancias con hoja membretada de Saint Luke’s, Baywatch y Lovalgo.'),
  p_('oficios', 'Seguimiento de Oficios y Correspondencia', 'OF', 'Documentos y trámites', 'Capital Humano',
    'https://rhinobuild.github.io/seguimiento_oficios_slh/', 'Control de oficios de entrada y salida (versión independiente).'),
];
