/**
 * Catálogos y definición de módulos de la Intranet de Capital Humano.
 * Todo lo que termina en "_" es privado: Apps Script no permite llamarlo desde el navegador.
 */

const APP_NAME = 'Capital Humano';
const APP_TZ = 'America/Mazatlan';

const COMPANIES = [
  'Saint Luke’s Hospitals',
  'VIE Hospital de México',
  'ST Josephs',
  'Hospital Sayulita',
  'STL Loreto',
  'Puerto Rico CSL',
  '911 Baywatch Ambulance',
  'Lovalgo',
  'Médicos Especialistas',
  'Médicos Prehospitalarios',
  'Soc. Admra. y Apoyo Médico S.C.',
];

const SITES = [
  'Corporativo',
  'San José del Cabo',
  'Cabo San Lucas',
  'Todos Santos',
  'Los Barriles',
  'La Ribera',
  'El Cardonal',
  'Loreto',
  'Sayulita',
  'San Pancho',
  'Guayabitos',
  'Nuevo Vallarta',
  'Puerto Vallarta',
  'Cancún',
  'Playa del Carmen',
  'Cozumel',
  'Tulum',
  'Nayarit',
  'Vallarta',
  'Caribe (Cancún/Playa del Carmen/Cozumel/Tulum)',
];

const ALL_COMPANIES = 'Todas las empresas';
const ALL_SITES = 'Todas las sedes';

const ROLES = ['Dirección RH', 'Jefatura RH', 'Generalista RH', 'Reclutamiento', 'Capacitación', 'Consulta'];

const GROUPS = [
  { id: 'personal', label: 'Seguimiento de personal' },
  { id: 'documentos', label: 'Documentos y procesos' },
  { id: 'operacion', label: 'Operación y planeación' },
  { id: 'evaluaciones', label: 'Evaluaciones y desarrollo' },
];

function f_(key, label, type, required, options) {
  return { key: key, label: label, type: type || 'text', required: !!required, options: options || null };
}

const PERIOD_FIELDS_ = [f_('start', 'Fecha de inicio', 'date', true), f_('end', 'Fecha de término', 'date', true)];
const CONTACT_FIELDS_ = [f_('employeeId', 'Número de empleado'), f_('area', 'Área'), f_('position', 'Puesto')];
const DOC_FIELDS_ = [f_('url', 'Enlace a carpeta o documento', 'url'), f_('version', 'Versión'), f_('effective', 'Fecha de vigencia', 'date')];
const ROLE_FIELDS_ = [
  f_('area', 'Área', 'text', true),
  f_('employee', 'Colaborador que cubre', 'text', true),
  f_('replaced', 'Colaborador a cubrir'),
  f_('start', 'Fecha de inicio', 'date', true),
  f_('end', 'Fecha de término', 'date', true),
  f_('entry', 'Hora de entrada', 'time', true),
  f_('exit', 'Hora de salida', 'time', true),
  f_('turn', 'Turno', 'select', false, ['Matutino', 'Vespertino', 'Nocturno', '24 horas', 'Mixto']),
  f_('rest', 'Días de descanso'),
  f_('reason', 'Motivo de cobertura'),
];

const FEMININE_ = ['incapacidad', 'falta', 'constancia', 'solicitud', 'asignación', 'cobertura', 'actividad', 'capacitación',
  'revisión', 'renovación', 'evaluación'];

function m_(o) {
  var fem = FEMININE_.indexOf(o.singular) !== -1;
  return {
    newLabel: (fem ? 'Nueva ' : 'Nuevo ') + o.singular,
    createdLabel: o.singular.charAt(0).toUpperCase() + o.singular.slice(1) + (fem ? ' creada' : ' creado'),
    id: o.id,
    label: o.label,
    group: o.group,
    scope: o.scope || 'empresa', // 'comun' = un registro puede aplicar a todas las empresas
    mode: o.mode || 'seguimiento', // documentos | seguimiento | checklist | calendario | inventario | evaluacion
    singular: o.singular,
    titleLabel: o.titleLabel,
    description: o.description,
    states: o.states,
    fields: o.fields || [],
    checks: o.checks || null,
    pdf: !!o.pdf,
  };
}

function docs_(id, label, scope, description, fields) {
  return m_({
    id: id, label: label, group: 'documentos', scope: scope, mode: 'documentos', singular: 'recurso',
    titleLabel: 'Nombre del recurso', description: description, states: ['Vigente', 'Archivado'], fields: fields || DOC_FIELDS_,
  });
}

const MODULES = [
  // Seguimiento de personal
  m_({
    id: 'colaboradores', label: 'Padrón de colaboradores', group: 'personal', singular: 'colaborador', titleLabel: 'Nombre completo',
    description: 'Registro maestro del personal por empresa y sede. El número de empleado conecta los demás módulos.',
    states: ['Activo', 'Baja'],
    fields: [
      f_('employeeId', 'Número único de empleado', 'text', true), f_('area', 'Área', 'text', true), f_('position', 'Puesto', 'text', true),
      f_('manager', 'Jefe inmediato'), f_('start', 'Fecha de ingreso', 'date', true), f_('end', 'Fecha de baja', 'date'),
      f_('email', 'Correo de contacto'),
      f_('contractType', 'Tipo de relación', 'select', true, ['Tiempo indeterminado', 'Tiempo determinado', 'Servicios profesionales', 'Prácticas']),
      f_('url', 'Carpeta del expediente', 'url'),
    ],
  }),
  m_({
    id: 'contratos', label: 'Contratos', group: 'personal', singular: 'contrato', titleLabel: 'Nombre del colaborador',
    description: 'Vigencias, renovaciones y documentación contractual.',
    states: ['Pendiente', 'Vigente', 'Por renovar', 'Concluido', 'Cancelado'],
    fields: CONTACT_FIELDS_.concat([
      f_('type', 'Tipo de contrato', 'select', true, ['Tiempo determinado', 'Tiempo indeterminado', 'Servicios profesionales', 'Prácticas', 'Otro']),
    ], PERIOD_FIELDS_, [
      f_('decision', 'Decisión / seguimiento', 'select', false, ['Pendiente de revisión', 'Renovar', 'Concluir', 'Revisar condiciones']),
      f_('review', 'Fecha de revisión', 'date'), f_('url', 'Enlace al contrato', 'url'),
    ]),
  }),
  m_({
    id: 'permisos', label: 'Permisos y vacaciones', group: 'personal', scope: 'comun', singular: 'permiso', titleLabel: 'Nombre del colaborador',
    description: 'Permisos con y sin goce, vacaciones y cambios de turno.',
    states: ['Pendiente', 'Autorizado', 'No autorizado', 'Concluido', 'Cancelado'],
    fields: CONTACT_FIELDS_.concat([
      f_('type', 'Tipo', 'select', true, ['Permiso con goce', 'Permiso sin goce', 'Vacaciones', 'Cambio de turno', 'Otro']),
    ], PERIOD_FIELDS_, [
      f_('hours', 'Horas solicitadas', 'number'), f_('approver', 'Persona que autoriza'), f_('substitute', 'Persona que cubre'),
      f_('reason', 'Motivo', 'textarea', true),
    ]),
  }),
  m_({
    id: 'incapacidades', label: 'Incapacidades', group: 'personal', singular: 'incapacidad', titleLabel: 'Nombre del colaborador',
    description: 'Folios, periodos y seguimiento administrativo. Información confidencial.',
    states: ['Registrada', 'En seguimiento', 'Concluido', 'Cancelada'],
    fields: CONTACT_FIELDS_.concat([
      f_('folio', 'Folio de incapacidad', 'text', true), f_('institution', 'Institución emisora', 'text', true),
      f_('type', 'Tipo', 'select', true, ['Inicial', 'Subsecuente', 'Recaída', 'Maternidad', 'Otro']),
    ], PERIOD_FIELDS_, [
      f_('days', 'Días otorgados', 'number', true), f_('received', 'Fecha de recepción', 'date'), f_('substitute', 'Cobertura asignada'),
    ]),
  }),
  m_({
    id: 'faltas', label: 'Faltas', group: 'personal', singular: 'falta', titleLabel: 'Nombre del colaborador',
    description: 'Registro y aclaración de ausencias.',
    states: ['Pendiente', 'Justificada', 'Injustificada', 'Concluido'],
    fields: CONTACT_FIELDS_.concat([
      f_('eventDate', 'Fecha de la falta', 'date', true), f_('expectedEntry', 'Entrada programada', 'time'),
      f_('reason', 'Motivo / aclaración', 'textarea'), f_('action', 'Seguimiento acordado', 'textarea'),
    ]),
  }),
  m_({
    id: 'retardos', label: 'Retardos', group: 'personal', singular: 'retardo', titleLabel: 'Nombre del colaborador',
    description: 'Puntualidad y aclaraciones.',
    states: ['Pendiente', 'Justificado', 'Injustificado', 'Concluido'],
    fields: CONTACT_FIELDS_.concat([
      f_('eventDate', 'Fecha', 'date', true), f_('expectedEntry', 'Entrada programada', 'time', true), f_('actualEntry', 'Entrada registrada', 'time', true),
      f_('tolerance', 'Tolerancia en minutos', 'number'), f_('action', 'Seguimiento acordado', 'textarea'),
    ]),
  }),
  m_({
    id: 'candidatos', label: 'Candidatos', group: 'personal', singular: 'candidato', titleLabel: 'Nombre del candidato',
    description: 'Seguimiento del proceso de reclutamiento.',
    states: ['Nuevo', 'Entrevista', 'Evaluación', 'Oferta', 'Contratado', 'No seleccionado', 'Desistió'],
    fields: [
      f_('position', 'Vacante', 'text', true), f_('area', 'Área'), f_('phone', 'Teléfono'), f_('email', 'Correo'),
      f_('source', 'Fuente de reclutamiento'), f_('interview', 'Fecha de entrevista', 'date'), f_('salary', 'Pretensión salarial'),
      f_('url', 'Enlace a CV o carpeta', 'url'),
    ],
  }),
  m_({
    id: 'practicantes', label: 'Practicantes', group: 'personal', singular: 'practicante', titleLabel: 'Nombre del practicante',
    description: 'Convenios, horas y supervisión de prácticas.',
    states: ['Pendiente', 'Activo', 'Concluido', 'Baja'],
    fields: [f_('school', 'Institución educativa', 'text', true), f_('career', 'Carrera', 'text', true), f_('area', 'Área')].concat(PERIOD_FIELDS_, [
      f_('targetHours', 'Horas requeridas', 'number', true), f_('completedHours', 'Horas completadas', 'number', true),
      f_('supervisor', 'Supervisor'), f_('url', 'Carpeta de documentación', 'url'),
    ]),
  }),
  m_({
    id: 'especialistas', label: 'Credencialización de especialistas', group: 'personal', mode: 'checklist', singular: 'médico',
    titleLabel: 'Nombre del médico especialista', description: 'Documentos y vigencia de credenciales médicas.',
    states: ['En revisión', 'Completo', 'Por vencer', 'Vencido', 'Archivado'],
    fields: [
      f_('specialty', 'Especialidad', 'text', true), f_('license', 'Cédula profesional', 'text', true), f_('specialtyLicense', 'Cédula de especialidad'),
      f_('certification', 'Certificación / consejo'), f_('expiry', 'Vigencia de certificación', 'date'),
      f_('privileges', 'Privilegios autorizados', 'textarea'), f_('url', 'Carpeta de credencialización', 'url'),
    ],
    checks: ['Identificación', 'Título y cédula profesional', 'Especialidad y cédula', 'Certificación del consejo', 'Currículum',
      'Póliza de responsabilidad profesional', 'Validación de documentos', 'Privilegios revisados', 'Carta de autorización / convenio'],
  }),

  // Documentos y procesos
  docs_('procesos', 'Procesos de RH', 'comun', 'Procedimientos de Capital Humano para todas las empresas.'),
  docs_('politicas', 'Políticas de RH', 'empresa', 'Políticas vigentes por empresa.'),
  docs_('papeletas', 'Papeletas y formatos', 'comun', 'Formatos de permisos, vacaciones y cambios de turno.',
    [f_('type', 'Tipo de papeleta', 'select', true, ['Permiso', 'Vacaciones', 'Cambio de turno', 'Otro'])].concat(DOC_FIELDS_)),
  m_({
    id: 'expedientes', label: 'Expedientes digitales', group: 'documentos', mode: 'documentos', singular: 'expediente',
    titleLabel: 'Nombre del colaborador', description: 'Carpetas y documentos del expediente de cada colaborador.',
    states: ['Activo', 'Archivado'],
    fields: CONTACT_FIELDS_.concat([f_('url', 'Enlace a la carpeta del expediente', 'url'), f_('start', 'Fecha de ingreso', 'date')]),
  }),
  m_({
    id: 'constancias', label: 'Constancias laborales', group: 'documentos', scope: 'comun', singular: 'constancia', pdf: true,
    titleLabel: 'Nombre del colaborador', description: 'Mismo formato para todas las sedes, con descarga directa en PDF.',
    states: ['Borrador', 'Emitida', 'Archivado'],
    fields: CONTACT_FIELDS_.concat([
      f_('start', 'Fecha de ingreso', 'date', true), f_('issueDate', 'Fecha de emisión', 'date', true), f_('city', 'Lugar de emisión', 'text', true),
      f_('signer', 'Nombre de quien firma', 'text', true), f_('signerPosition', 'Puesto de quien firma', 'text', true),
      f_('purpose', 'Finalidad de la constancia'), f_('salary', 'Salario a mencionar (opcional)'),
      f_('salaryPeriod', 'Periodicidad del salario', 'select', false, ['Mensual', 'Quincenal', 'Semanal', 'Diario']),
      f_('letterhead', 'Hoja membretada', 'letterhead'),
    ]),
  }),
  docs_('perfiles', 'Perfiles de puesto', 'empresa', 'Perfiles y descripciones de puesto por empresa.',
    [f_('area', 'Área'), f_('position', 'Puesto', 'text', true)].concat(DOC_FIELDS_)),
  docs_('membretadas', 'Hojas membretadas', 'empresa', 'Imágenes PNG o JPG por empresa y sede, para usarse de fondo al generar PDF.',
    [f_('format', 'Formato de fondo', 'select', true, ['PNG/JPG', 'Word (solo descarga)'])].concat(DOC_FIELDS_)),

  // Operación y planeación
  m_({
    id: 'cobertura', label: 'Cobertura de vacantes', group: 'operacion', scope: 'comun', singular: 'solicitud', pdf: true,
    titleLabel: 'Puesto solicitado', description: 'Solicitud, autorización y seguimiento, con PDF para todas las sedes.',
    states: ['Pendiente', 'Autorizada', 'No autorizada', 'En reclutamiento', 'Cubierta', 'Cancelada'],
    fields: [
      f_('requester', 'Nombre del solicitante', 'text', true), f_('requesterPosition', 'Puesto del solicitante', 'text', true),
      f_('area', 'Área', 'text', true), f_('quantity', 'Cantidad solicitada', 'number', true),
      f_('type', 'Tipo de cobertura', 'select', true, ['Reemplazo', 'Nueva posición', 'Incremento temporal', 'Incapacidad / ausencia temporal']),
      f_('priority', 'Prioridad', 'select', true, ['Normal', 'Alta', 'Crítica']), f_('requiredDate', 'Fecha requerida', 'date', true),
      f_('schedule', 'Horario y turno', 'text', true), f_('reason', 'Motivo y justificación', 'textarea', true),
      f_('requirements', 'Requisitos adicionales', 'textarea'), f_('approver', 'Nombre de quien autoriza'),
      f_('approvalDate', 'Fecha de decisión', 'date'), f_('letterhead', 'Hoja membretada', 'letterhead'),
    ],
  }),
  m_({
    id: 'turnos', label: 'Rol de turnos', group: 'operacion', mode: 'calendario', singular: 'asignación', titleLabel: 'Nombre de la asignación',
    description: 'Turnos por área, colaborador, empresa y sede.', states: ['Programado', 'Confirmado', 'Realizado', 'Cancelada'], fields: ROLE_FIELDS_,
  }),
  m_({
    id: 'feriados', label: 'Cobertura de días feriados', group: 'operacion', mode: 'calendario', singular: 'cobertura', titleLabel: 'Nombre de la cobertura',
    description: 'Coberturas para días feriados.', states: ['Programado', 'Confirmado', 'Realizado', 'Cancelada'],
    fields: ROLE_FIELDS_.concat([f_('holiday', 'Día feriado', 'text', true)]),
  }),
  m_({
    id: 'vacaciones', label: 'Cobertura de vacaciones', group: 'operacion', mode: 'calendario', singular: 'cobertura', titleLabel: 'Nombre de la cobertura',
    description: 'Reemplazos durante periodos de vacaciones.', states: ['Programado', 'Confirmado', 'Realizado', 'Cancelada'], fields: ROLE_FIELDS_,
  }),
  m_({
    id: 'calendario-rh', label: 'Agenda de Capital Humano', group: 'operacion', scope: 'comun', mode: 'calendario', singular: 'actividad',
    titleLabel: 'Nombre de la actividad', description: 'Agenda común del equipo.', states: ['Programado', 'En proceso', 'Completado', 'Cancelada'],
    fields: PERIOD_FIELDS_.concat([f_('entry', 'Hora de inicio', 'time'), f_('area', 'Área / participantes'), f_('location', 'Lugar'), f_('objective', 'Objetivo', 'textarea')]),
  }),
  m_({
    id: 'calendario-cap', label: 'Calendario de capacitaciones', group: 'operacion', scope: 'comun', mode: 'calendario', singular: 'capacitación',
    titleLabel: 'Nombre de la capacitación', description: 'Cursos, instructores y evidencias.', states: ['Programado', 'En proceso', 'Completado', 'Cancelada'],
    fields: PERIOD_FIELDS_.concat([
      f_('entry', 'Hora de inicio', 'time'), f_('trainer', 'Instructor', 'text', true), f_('audience', 'Personal al que se dirige'),
      f_('location', 'Lugar / modalidad'), f_('hours', 'Duración en horas', 'number'), f_('url', 'Enlace al curso', 'url'),
    ]),
  }),
  m_({
    id: 'uniformes', label: 'Inventario de uniformes', group: 'operacion', mode: 'inventario', singular: 'artículo', titleLabel: 'Nombre de la prenda',
    description: 'Existencias por empresa con entradas, entregas y conciliación.', states: ['Activo', 'En conciliación', 'Archivado'],
    fields: [
      f_('sku', 'Código de artículo', 'text', true), f_('size', 'Talla', 'text', true), f_('color', 'Color'),
      f_('initial', 'Existencia inicial', 'number', true), f_('minimum', 'Existencia mínima', 'number', true),
      f_('location', 'Ubicación de almacén'), f_('reconciledBalance', 'Existencia física conciliada', 'number'),
    ],
  }),
  m_({
    id: 'uniformes-renovaciones', label: 'Renovación de uniformes', group: 'operacion', singular: 'renovación', titleLabel: 'Departamento',
    description: 'Seguimiento de renovaciones por departamento.', states: ['Pendiente', 'En reparto', 'Concluido'],
    fields: [f_('area', 'Departamento'), f_('eventDate', 'Fecha', 'date')],
  }),
  m_({
    id: 'check-medicos', label: 'Ingreso de médicos prehospitalarios', group: 'operacion', scope: 'comun', mode: 'checklist', singular: 'revisión',
    titleLabel: 'Nombre del médico', description: 'Revisión de incorporación y documentación por sede.',
    states: ['Pendiente', 'En revisión', 'Completo', 'Archivado'],
    fields: [f_('license', 'Cédula profesional'), f_('reviewDate', 'Fecha de revisión', 'date', true), f_('url', 'Carpeta de evidencias', 'url')],
    checks: ['Identificación', 'Título profesional', 'Cédula verificada', 'Currículum actualizado', 'Contrato / convenio', 'Aviso de privacidad',
      'Inducción corporativa', 'Capacitación requerida por puesto', 'Uniforme y gafete', 'Asignación de sede y horario', 'Revisión por responsable'],
  }),
  m_({
    id: 'check-expedientes', label: 'Revisión de expedientes', group: 'operacion', mode: 'checklist', singular: 'revisión',
    titleLabel: 'Nombre del colaborador', description: 'Control documental del expediente por empresa.',
    states: ['Pendiente', 'En revisión', 'Completo', 'Archivado'],
    fields: CONTACT_FIELDS_.concat([f_('reviewDate', 'Fecha de revisión', 'date', true), f_('url', 'Carpeta del expediente', 'url')]),
    checks: ['Solicitud / CV', 'Identificación', 'Acta de nacimiento', 'CURP', 'RFC / constancia fiscal', 'Número de seguridad social',
      'Comprobante de domicilio', 'Documentos de estudios', 'Contrato firmado', 'Aviso de privacidad', 'Inducción',
      'Entrega de uniforme y gafete', 'Contacto de emergencia'],
  }),
  m_({
    id: 'oficios', label: 'Oficios', group: 'operacion', scope: 'comun', singular: 'oficio', titleLabel: 'Asunto del oficio',
    description: 'Entrada y salida de oficios con folio automático.', states: ['Registrado', 'En seguimiento', 'Atendido', 'Archivado'],
    fields: [
      f_('direction', 'Tipo de movimiento', 'select', true, ['Entrada', 'Salida']), f_('documentNumber', 'Número externo del oficio'),
      f_('eventDate', 'Fecha de recepción / emisión', 'date', true), f_('sender', 'Remitente', 'text', true),
      f_('recipient', 'Destinatario', 'text', true), f_('responseDate', 'Fecha límite de respuesta', 'date'), f_('url', 'Enlace al documento', 'url'),
    ],
  }),
  m_({
    id: 'recorridos', label: 'Recorridos', group: 'operacion', mode: 'checklist', singular: 'recorrido', titleLabel: 'Nombre del recorrido',
    description: 'Hallazgos, acuerdos y seguimiento por empresa y sede.', states: ['Programado', 'En seguimiento', 'Concluido', 'Archivado'],
    fields: [
      f_('area', 'Área recorrida', 'text', true), f_('eventDate', 'Fecha del recorrido', 'date', true), f_('findings', 'Hallazgos', 'textarea'),
      f_('action', 'Acciones acordadas', 'textarea'), f_('actionOwner', 'Responsable de acciones'), f_('nextReview', 'Próxima revisión', 'date'),
    ],
    checks: ['Recorrido realizado', 'Hallazgos documentados', 'Responsables asignados', 'Acciones verificadas', 'Cierre documentado'],
  }),

  // Evaluaciones y desarrollo
  m_({
    id: 'evaluaciones', label: 'Evaluaciones', group: 'evaluaciones', scope: 'comun', mode: 'evaluacion', singular: 'evaluación', pdf: true,
    titleLabel: 'Nombre de la persona evaluada', description: 'Paramédicos, 360°, desempeño, RH y NOM-035. Resultados individuales confidenciales.',
    states: ['Borrador', 'Finalizada'],
    fields: [
      f_('employeeId', 'Número de empleado / código'), f_('evaluator', 'Nombre del evaluador', 'text', true),
      f_('cycle', 'Periodo / campaña', 'text', true),
      f_('relationship', 'Relación del evaluador', 'select', true, ['Supervisor', 'Par', 'Colaborador', 'Autoevaluación', 'RH']),
      f_('url', 'Carpeta o documento de referencia', 'url'),
    ],
  }),
  docs_('evaluaciones-docs', 'Material de evaluaciones', 'comun', 'Guías y carpetas de referencia de las cinco evaluaciones.',
    [f_('type', 'Evaluación', 'select', true, ['Evaluación de paramédicos', 'Evaluación 360°', 'Evaluación de desempeño', 'Evaluación de RH', 'NOM-035'])].concat(DOC_FIELDS_)),
].map(function (mod) {
  if (mod.id === 'evaluaciones-docs') mod.group = 'evaluaciones';
  return mod;
});

function moduleById_(id) {
  for (var i = 0; i < MODULES.length; i++) if (MODULES[i].id === id) return MODULES[i];
  return null;
}
