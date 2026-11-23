// Simulador mínimo de los servicios de Apps Script usados por la intranet.
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function makeEnv(srcDir, ownerEmail) {
  const state = { activeUser: ownerEmail, owner: ownerEmail, props: {}, sheets: {}, files: {}, folders: {}, pdfs: [] };

  class Range {
    constructor(sheet, r, c, nr, nc) { Object.assign(this, { sheet, r, c, nr, nc }); }
    getValues() {
      const out = [];
      for (let i = 0; i < this.nr; i++) {
        const row = this.sheet.rows[this.r - 1 + i] || [];
        const vals = [];
        for (let j = 0; j < this.nc; j++) vals.push(row[this.c - 1 + j] === undefined ? '' : row[this.c - 1 + j]);
        out.push(vals);
      }
      return out;
    }
    setValues(values) {
      for (let i = 0; i < values.length; i++) {
        const idx = this.r - 1 + i;
        while (this.sheet.rows.length <= idx) this.sheet.rows.push([]);
        for (let j = 0; j < values[i].length; j++) {
          const v = values[i][j];
          if (typeof v !== 'string' && typeof v !== 'number' && typeof v !== 'boolean') throw new Error('Valor no admitido en celda: ' + typeof v);
          this.sheet.rows[idx][this.c - 1 + j] = v;
        }
      }
      return this;
    }
    setNumberFormat() { return this; }
    setFontWeight() { return this; }
  }
  class Sheet {
    constructor(name) { this.name = name; this.rows = []; }
    getName() { return this.name; }
    getLastRow() { let n = this.rows.length; while (n > 0 && (!this.rows[n - 1] || this.rows[n - 1].every((v) => v === '' || v === undefined))) n--; return n; }
    getLastColumn() { return this.rows.reduce((m, r) => { let n = (r || []).length; while (n > 0 && (r[n - 1] === '' || r[n - 1] === undefined)) n--; return Math.max(m, n); }, 0); }
    getMaxRows() { return Math.max(1000, this.rows.length); }
    getRange(r, c, nr, nc) { return new Range(this, r, c, nr || 1, nc || 1); }
    deleteRow(r) { this.rows.splice(r - 1, 1); }
    setFrozenRows() {}
  }
  class Spreadsheet {
    constructor() { this.id = 'ss-' + crypto.randomUUID().replace(/-/g, ''); this.sheets = [new Sheet('Hoja 1')]; }
    getId() { return this.id; }
    getSpreadsheetTimeZone() { return Intl.DateTimeFormat().resolvedOptions().timeZone; }
    getUrl() { return 'https://docs.google.com/spreadsheets/d/' + this.id; }
    getSheetByName(n) { return this.sheets.find((s) => s.name === n) || null; }
    insertSheet(n) { const s = new Sheet(n); this.sheets.push(s); return s; }
    getSheets() { return this.sheets.slice(); }
    deleteSheet(s) { this.sheets = this.sheets.filter((x) => x !== s); }
  }
  class Blob {
    constructor(bytes, mime, name) { this.bytes = Buffer.from(bytes); this.mime = mime; this.name = name; }
    getBytes() { return Array.from(this.bytes).map((b) => (b > 127 ? b - 256 : b)); }
    getName() { return this.name; }
    setName(n) { this.name = n; return this; }
    getContentType() { return this.mime; }
    getAs(mime) { const b = new Blob(this.bytes, mime, this.name); state.pdfs.push(this.bytes.toString('utf8')); return b; }
    getDataAsString() { return this.bytes.toString('utf8'); }
  }
  const toBuf = (bytes) => Buffer.from(bytes.map((b) => (b < 0 ? b + 256 : b)));

  const ctx = {
    console,
    SpreadsheetApp: {
      create() { const ss = new Spreadsheet(); state.sheets[ss.id] = ss; return ss; },
      openById(id) { if (!state.sheets[id]) throw new Error('No existe ' + id); return state.sheets[id]; },
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in state.props ? state.props[k] : null), setProperty: (k, v) => { state.props[k] = String(v); } }) },
    Session: {
      getActiveUser: () => ({ getEmail: () => state.activeUser || '' }),
      getEffectiveUser: () => ({ getEmail: () => state.owner }),
    },
    LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock() {}, releaseLock() {} }) },
    DriveApp: {
      createFolder(name) { const id = 'fold-' + crypto.randomUUID(); state.folders[id] = { name }; return { getId: () => id }; },
      getFolderById(id) {
        if (!state.folders[id]) throw new Error('Carpeta inexistente');
        return { createFile(blob) { const fid = 'file-' + crypto.randomUUID(); state.files[fid] = { blob, trashed: false }; return { getId: () => fid }; } };
      },
      getFileById(id) {
        const f = state.files[id];
        if (!f) throw new Error('Archivo inexistente');
        return { getBlob: () => f.blob, setTrashed: (t) => { f.trashed = t; } };
      },
    },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      formatDate(d, tz, fmt) {
        const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).formatToParts(d);
        const g = (t) => parts.find((p) => p.type === t).value;
        const day = g('year') + '-' + g('month') + '-' + g('day');
        return fmt === 'yyyy-MM-dd' ? day : day + 'T' + g('hour') + ':' + g('minute') + ':' + g('second');
      },
      base64Decode: (s) => Array.from(Buffer.from(s, 'base64')).map((b) => (b > 127 ? b - 256 : b)),
      base64Encode: (bytes) => toBuf(bytes).toString('base64'),
      newBlob: (bytes, mime, name) => new Blob(toBuf(bytes), mime, name),
    },
    HtmlService: {
      XFrameOptionsMode: { DEFAULT: 'DEFAULT', ALLOWALL: 'ALLOWALL' },
      createHtmlOutput(html) { return { getBlob: () => new Blob(Buffer.from(html), 'text/html', 'out.html'), getContent: () => html }; },
      createHtmlOutputFromFile(name) { const html = fs.readFileSync(path.join(srcDir, name + '.html'), 'utf8'); return { getContent: () => html }; },
      createTemplateFromFile(name) {
        const tpl = fs.readFileSync(path.join(srcDir, name + '.html'), 'utf8');
        return {
          evaluate() {
            const html = tpl.replace(/<\?!=\s*([\s\S]*?);?\s*\?>/g, (_, expr) => vm.runInContext(expr, context));
            const out = { getContent: () => html, setTitle: () => out, addMetaTag: () => out, setXFrameOptionsMode: () => out };
            return out;
          },
        };
      },
    },
  };
  const context = vm.createContext(ctx);
  const order = ['Config', 'Policy', 'Data', 'Nom035', 'Evaluations', 'Pdf', 'Api', 'Import', 'Platforms', 'Team'];
  const files = fs.readdirSync(srcDir).filter((f) => f.endsWith('.gs'));
  if (files.length !== order.length) throw new Error('Archivos .gs inesperados: ' + files.join(', '));
  // Apps Script carga los archivos en un orden que no se garantiza: probamos el inverso también.
  const loadOrder = process.env.REVERSE ? order.slice().reverse() : order;
  const code = loadOrder.map((n) => fs.readFileSync(path.join(srcDir, n + '.gs'), 'utf8')).join('\n;\n');
  vm.runInContext(code, context, { filename: 'intranet.gs' });

  return {
    state,
    ctx: context,
    as(email) { state.activeUser = email; return this; },
    call(fn, ...args) {
      // Serialización como google.script.run: solo datos JSON viajan entre servidor y navegador.
      const res = vm.runInContext(fn, context)(...JSON.parse(JSON.stringify(args)));
      return res === undefined ? undefined : JSON.parse(JSON.stringify(res));
    },
    isPublic(fn) { return !fn.endsWith('_') && typeof vm.runInContext('typeof ' + fn, context) === 'string'; },
  };
}

module.exports = { makeEnv };
