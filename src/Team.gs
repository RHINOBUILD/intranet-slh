/**
 * Equipo de Capital Humano con acceso a la intranet.
 * Para darlos de alta, la persona titular ejecuta una vez la función cargarEquipoCH
 * desde el editor de Apps Script. Es repetible: actualiza a quien ya exista.
 * Los permisos se pueden ajustar después en "Usuarios y permisos".
 */

const EQUIPO_CH = [
  // San José del Cabo
  { email: 'generalistarrhh@saintlukeshospitals.com', name: 'Jeymy Tahide Domínguez Olachea', role: 'Jefatura RH', companies: ['*'], sites: ['San José del Cabo'] },
  { email: 'auxrrhh@saintlukeshospitals.com', name: 'Ximena Tapia Bedolla', role: 'Generalista RH', companies: ['*'], sites: ['San José del Cabo'] },
  { email: 'capacitaciones@saintlukeshospitals.com', name: 'Andrés Heriberto Luque Durán', role: 'Capacitación', companies: ['*'], sites: ['San José del Cabo'] },
  { email: 'capitalhumano@saintlukeshospitals.com', name: 'Abigail Ponce López', role: 'Reclutamiento', companies: ['*'], sites: ['San José del Cabo'] },
  // Cabo San Lucas (cuenta compartida por Akane y Elvira)
  { email: 'capitalhumanocsl@saintlukeshospitals.com', name: 'Akane Reyes / Elvira Hilario', role: 'Jefatura RH', companies: ['*'], sites: ['Cabo San Lucas'] },
];

function cargarEquipoCH() {
  var active = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  var effective = String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
  if (!active || active !== effective || ownerEmails_().indexOf(active) === -1) {
    throw new Error('Solo la cuenta titular puede cargar al equipo, desde el editor de Apps Script.');
  }
  if (!props_().getProperty('SPREADSHEET_ID')) throw new Error('Primero ejecuta instalar.');
  return withLock_(function () {
    var altas = 0, cambios = 0;
    EQUIPO_CH.forEach(function (m) {
      var email = m.email.toLowerCase();
      if (ownerEmails_().indexOf(email) !== -1) return;
      var row = {
        email: email, name: m.name, role: m.role, companies: JSON.stringify(m.companies), sites: JSON.stringify(m.sites),
        active: '1', admin: '0', updatedAt: nowIso_(), updatedBy: active,
      };
      var existing = findBy_('access', 'email', email);
      if (existing) { row.admin = existing.admin || '0'; updateRow_('access', existing._row, row); cambios++; }
      else { appendRow_('access', row); altas++; }
      logAudit_('access', 'access', m.name, 'Acceso cargado con el equipo de Capital Humano: ' + m.role + ', ' + m.sites.join(', '), active);
    });
    return 'Equipo de Capital Humano: ' + altas + ' altas y ' + cambios + ' actualizados.';
  });
}
