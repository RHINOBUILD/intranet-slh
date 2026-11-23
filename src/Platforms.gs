/**
 * Plataformas del grupo que se abren desde la intranet.
 * Dirección RH las agrega, edita y archiva desde la sección Plataformas.
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

/**
 * Catálogo base vacío: las plataformas se agregan desde la intranet
 * (Plataformas → Agregar plataforma) y quedan como registros con bitácora.
 * Si en el futuro quieres alguna fija en el código, agrégala aquí con p_().
 */
const PLATFORMS = [];
