/* imagespec-editor/core.js — shared payload layout editor (profile-driven)
 * Requires: window.ImagespecEditorSchema, window.ImagespecEditorProfile, jsyaml
 */
(function () {
'use strict';

// === STATE (profile-driven imagespec payload editor) ===
const PROFILE = window.ImagespecEditorProfile;
if (!PROFILE) throw new Error('ImagespecEditorProfile is required before loading core.js');

const EDITOR_VERSION = PROFILE.editorVersion || '260804';
const DPI_SCALE = 300 / 25.4; // 11.81 px/mm
let elements = [];
let selectedId = null;
let nextId = 1;
let deviceW = PROFILE.canvas.defaultWidth || 400;
let deviceH = PROFILE.canvas.defaultHeight || 240;
let canvasW = deviceW, canvasH = deviceH;
let viewScale = 1;
let panX = 0, panY = 0;
let dragging = null; // {type:'move'|'pan'|'resize', ...}
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const tooltip = document.getElementById('coordTooltip');

const COLORS = { white: '#ffffff', black: '#000000', red: '#ff0000', yellow: '#ffff00', blue: '#0000ff', green: '#008000', orange: '#ff8800' };
const resolveColor = c => COLORS[c] || c || '#000000';
const LAYOUT_TYPES = new Set(['row', 'column', 'stack', 'group']);
const EDITOR_ONLY_PROPS = new Set(['visible', '_children']);
const IMAGESPEC_DOC = 'https://github.com/eigger/imagespec/blob/main/docs/authoring.md';
const SCHEMA = window.ImagespecEditorSchema;
if (!SCHEMA) throw new Error('ImagespecEditorSchema is required before loading core.js');

// === QR CODE HELPERS (ECC High) ===
const QR_CAPACITIES = [
  0, 7, 14, 24, 34, 44, 58, 64, 84, 98, 119, 137, 155, 177, 194, 220, 250, 280, 310, 338, 382, 403, 439, 461, 511, 535, 593, 625, 658, 698, 742, 790, 842, 898, 958, 983, 1051, 1093, 1139, 1219, 1273
];
function getQRModuleCount(data) {
  const len = String(data).length;
  let ver = 40;
  for (let v = 1; v < QR_CAPACITIES.length; v++) {
    if (len <= QR_CAPACITIES[v]) { ver = v; break; }
  }
  return 21 + (ver - 1) * 4;
}
function getQRSize(p) {
  if (p.width && p.height) return { w: p.width, h: p.height };
  if (p.width) return { w: p.width, h: p.width };
  const bs = p.boxsize || 2;
  const bd = p.border === undefined ? 1 : p.border;
  const mods = getQRModuleCount(p.data);
  const s = bs * (mods + 2 * bd);
  return { w: s, h: s };
}
function parsePieValues(s) {
  return String(s || '').split(';').filter(Boolean).map(part => {
    const bits = part.split(',').map(x => x.trim());
    return { label: bits[0] || '', value: parseFloat(bits[1]) || 0, color: bits[2] || 'black' };
  });
}
function parseSparklineValues(s) {
  if (Array.isArray(s)) return s.map(Number);
  return String(s || '').split(',').map(x => parseFloat(x.trim())).filter(n => !isNaN(n));
}
function yamlQuote(val) {
  if (typeof val !== 'string') return val;
  if (val.includes(':') || val.includes('#') || val.includes('{') || val.includes('"') || val.includes("'") || val.match(/^\s/) || val === '' || val.includes(',')) {
    return `"${val.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return val;
}

// Match python-barcode BaseWriter.calculate_size() and ImageWriter dpi=300 (mm2px)
const PT_TO_MM = 0.352777778;
function getCode128Modules(data) {
  const s = String(data);
  const len = s.length;
  const allDigits = /^\d+$/.test(s);
  if (allDigits && len >= 2) {
    // Set C: 2 digits per symbol (11 modules each). Start(11) + data + Check(11) + Stop(13)
    const dataSymbols = Math.ceil(len / 2);
    return 11 + 11 * dataSymbols + 11 + 13;
  }
  // Set A/B: 1 char per 11 modules
  return 11 * len + 35;
}
function getBarcodeSize(p) {
  if (p.width && p.height) return { w: p.width, h: p.height };
  if (p.width) return { w: p.width, h: p.height || Math.max(24, Math.round(p.width * 0.28)) };
  if (p.height) return { w: p.width || 160, h: p.height };
  const len = String(p.data).length;
  const code = (p.code || 'code128').toLowerCase();
  const mods = code === 'code128' ? getCode128Modules(p.data) : (11 * len + 35);
  const mw = p.module_width ?? 0.2;
  const qz = p.quiet_zone ?? 6.5;
  const width_mm = 2 * qz + mods * mw;

  const mh = p.module_height ?? 7;
  const td = p.text_distance ?? 5;
  const fs = p.font_size ?? 5;
  const margin_top = 1;
  const margin_bottom = 1;
  // calculate_size: height = margin_bottom + margin_top + module_height*lines + (font_size/2 pt->mm * n_lines + text_distance)
  const text_part_mm = (p.write_text !== false) ? (PT_TO_MM * fs / 2 + td) : 0;
  const height_mm = margin_top + margin_bottom + mh + text_part_mm;

  return {
    w: Math.ceil(width_mm * DPI_SCALE),
    h: Math.round(height_mm * DPI_SCALE)
  };
}

// === MDI ICON CACHE (same as Gicisky) ===
const mdiPathCache = {};
function loadMdiIcon(name) {
  const key = name.replace(/^mdi:/, '');
  if (mdiPathCache[key] !== undefined) return;
  mdiPathCache[key] = null; // mark as loading
  fetch(`https://cdn.jsdelivr.net/npm/@mdi/svg@latest/svg/${key}.svg`)
    .then(r => r.ok ? r.text() : '')
    .then(text => {
      const m = text.match(/<path[^>]*\bd="([^"]+)"/);
      if (m) { mdiPathCache[key] = m[1]; drawCanvas(); }
    }).catch(() => { });
}

// === ELEMENT DEFAULTS (from schema.js, customized by profile) ===
  function buildElementDefaults() {
    const defaults = JSON.parse(JSON.stringify(SCHEMA.ELEMENT_DEFAULTS));
    const font = PROFILE.defaultFont != null ? PROFILE.defaultFont : '';
    const fontKeys = PROFILE.fontDefaultKeys || ['text', 'multiline', 'new_multiline', 'diagram', 'plot'];
    fontKeys.forEach(t => {
      if (defaults[t] && Object.prototype.hasOwnProperty.call(defaults[t], 'font')) {
        defaults[t].font = font;
      }
    });
    if (PROFILE.qrDefaultData && defaults.qrcode) {
      defaults.qrcode.data = PROFILE.qrDefaultData;
    }
    const exclude = new Set(PROFILE.excludeElements || []);
    exclude.forEach(t => { delete defaults[t]; });
    return defaults;
  }
  function buildRequired() {
    const required = JSON.parse(JSON.stringify(SCHEMA.REQUIRED));
    const exclude = new Set(PROFILE.excludeElements || []);
    exclude.forEach(t => { delete required[t]; });
    if (PROFILE.multilineDelimiterRequired && required.multiline) {
      if (!required.multiline.includes('delimiter')) required.multiline = [...required.multiline, 'delimiter'];
    } else if (required.multiline) {
      required.multiline = required.multiline.filter(k => k !== 'delimiter');
    }
    return required;
  }
  const ELEMENT_DEFAULTS = buildElementDefaults();
  const REQUIRED = buildRequired();
  const FIELD_META = SCHEMA.FIELD_META;

// === ELEMENT MANAGEMENT ===
function addElement(type) {
  if (!ELEMENT_DEFAULTS[type]) {
    console.warn('Unknown element type for this profile:', type);
    return;
  }
  const props = JSON.parse(JSON.stringify(ELEMENT_DEFAULTS[type]));
  // Adjust defaults based on canvas size
  if (type === 'line') { props.x_end = Math.min(canvasW - 10, props.x_end); props.y_start = Math.floor(canvasH / 2); props.y_end = props.y_start; }
  if (type === 'progress_bar') { props.x_end = Math.min(canvasW - 10, props.x_end); props.y_start = canvasH - 30; props.y_end = canvasH - 10; }
  if (type === 'diagram' || type === 'plot') { props.x_end = props.x_end || canvasW - 20; props.y_end = props.y_end || canvasH - 20; props.width = props.width || canvasW - 20; props.height = props.height || canvasH - 20; }
  const el = { id: nextId++, type, props };
  elements.push(el);
  selectedId = el.id;
  refresh();
}

function removeElement(id) {
  elements = elements.filter(e => e.id !== id);
  if (selectedId === id) selectedId = null;
  refresh();
}

function moveElement(id, dir) {
  const idx = elements.findIndex(e => e.id === id);
  if (dir === 'up' && idx > 0) [elements[idx - 1], elements[idx]] = [elements[idx], elements[idx - 1]];
  if (dir === 'down' && idx < elements.length - 1) [elements[idx + 1], elements[idx]] = [elements[idx], elements[idx + 1]];
  refresh();
}

function duplicateElement(id) {
  const src = elements.find(e => e.id === id);
  if (!src) return;
  const el = { id: nextId++, type: src.type, props: JSON.parse(JSON.stringify(src.props)) };
  const off = 15;
  if ('x' in el.props) el.props.x += off;
  if ('y' in el.props) el.props.y += off;
  if ('x_start' in el.props) { el.props.x_start += off; el.props.x_end += off; }
  if ('y_start' in el.props) { el.props.y_start += off; el.props.y_end += off; }
  elements.push(el);
  selectedId = el.id;
  refresh();
}

// === ANCHOR HELPER ===
function anchorToCanvas(anchor) {
  const a = (anchor || 'lt').toLowerCase();
  const hChar = a[0] || 'l', vChar = a[1] || 't';
  const alignMap = { l: 'left', m: 'center', r: 'right' };
  const baseMap = { a: 'alphabetic', t: 'top', m: 'middle', s: 'alphabetic', b: 'bottom', d: 'bottom' };
  return { textAlign: alignMap[hChar] || 'left', textBaseline: baseMap[vChar] || 'top' };
}

function anchorOffset(anchor, w, h) {
  const a = (anchor || 'lt').toLowerCase();
  const hChar = a[0] || 'l', vChar = a[1] || 't';
  let ox = 0, oy = 0;
  if (hChar === 'm') ox = -w / 2;
  else if (hChar === 'r') ox = -w;
  if (vChar === 'm') oy = -h / 2;
  else if (vChar === 'b' || vChar === 'd') oy = -h;
  else if (vChar === 'a' || vChar === 's') oy = -h * 0.8;
  return { ox, oy };
}

// === EFFECTIVE PROPS (PIL pos_y flow) ===
function computeEffectiveProps() {
  let pos_y = 0;
  elements.forEach(el => {
    const p = el.props;
    const eff = { ...p };
    switch (el.type) {
      case 'line':
        if (p.y_start === undefined && p.y_end === undefined) {
          eff.y_start = pos_y + (p.y_padding ?? 0);
          eff.y_end = eff.y_start;
        }
        pos_y = eff.y_start ?? eff.y_end ?? pos_y;
        break;
      case 'text':
        if (p.y === undefined) eff.y = pos_y + (p.y_padding ?? 10);
        pos_y = (eff.y ?? pos_y) + (p.size || 20) * 1.3;
        break;
      case 'multiline': {
        if (p.start_y === undefined) eff.start_y = pos_y + (p.y_padding ?? 10);
        const lines = String(p.value || '').split(p.delimiter || ';');
        pos_y = (eff.start_y ?? pos_y) + lines.length * (p.offset_y || 25);
        break;
      }
      default:
        break;
    }
    el._effectiveProps = eff;
  });
}

// === BOUNDING BOX ===
function getBBox(el) {
  const p = el._effectiveProps || el.props;
  switch (el.type) {
    case 'text': {
      const w = Math.max(p.size * String(p.value).length * 0.6, 40), h = p.size * 1.3;
      const { ox, oy } = anchorOffset(p.anchor, w, h);
      return { x: p.x + ox, y: p.y + oy, w, h };
    }
    case 'multiline': {
      const lines = String(p.value).split(p.delimiter || ';');
      return { x: p.x, y: p.start_y || 10, w: Math.max(...lines.map(l => l.length || 1)) * p.size * 0.6, h: lines.length * p.offset_y };
    }
    case 'new_multiline': {
      const lines = String(p.value).split(/\n/);
      const w = (p.width || 200);
      const h = (p.height || lines.length * (p.spacing || p.size * 1.2));
      return { x: p.x, y: p.y, w, h };
    }
    case 'line': return { x: Math.min(p.x_start, p.x_end), y: Math.min(p.y_start, p.y_end) - 3, w: Math.abs(p.x_end - p.x_start) || 4, h: Math.abs(p.y_end - p.y_start) + 6 };
    case 'rectangle':
    case 'ellipse': return { x: p.x_start, y: p.y_start, w: p.x_end - p.x_start, h: p.y_end - p.y_start };
    case 'rectangle_pattern': return { x: p.x_start, y: p.y_start, w: p.x_repeat * (p.x_size + p.x_offset), h: p.y_repeat * (p.y_size + p.y_offset) };
    case 'circle': return { x: p.x - p.radius, y: p.y - p.radius, w: p.radius * 2, h: p.radius * 2 };
    case 'icon': {
      const { ox, oy } = anchorOffset(p.anchor, p.size, p.size);
      return { x: p.x + ox, y: p.y + oy, w: p.size, h: p.size };
    }
    case 'dlimg': return { x: p.x, y: p.y, w: p.xsize, h: p.ysize };
    case 'qrcode': { const sz = getQRSize(p); return { x: p.x, y: p.y, w: sz.w, h: sz.h }; }
    case 'barcode': { const sz = getBarcodeSize(p); return { x: p.x, y: p.y, w: sz.w, h: sz.h }; }
    case 'progress_bar': return { x: p.x_start, y: p.y_start, w: p.x_end - p.x_start, h: p.y_end - p.y_start };
    case 'battery': return { x: p.x, y: p.y, w: p.width, h: p.height };
    case 'gauge': return { x: p.x - p.radius, y: p.y - p.radius, w: p.radius * 2, h: p.radius * 2 };
    case 'pie': return { x: p.x - p.radius, y: p.y - p.radius, w: p.radius * 2, h: p.radius * 2 };
    case 'sparkline': return { x: p.x, y: p.y, w: p.width, h: p.height };
    case 'text_fit': return { x: p.x, y: p.y, w: p.width, h: p.height };
    case 'row': case 'column': case 'stack': case 'group': return { x: p.x || 0, y: p.y || 0, w: p.width || 120, h: p.height || 40 };
    case 'diagram': return { x: p.x, y: p.y, w: p.width || canvasW, h: p.height };
    case 'plot': return { x: p.x_start || 0, y: p.y_start || 0, w: (p.x_end || canvasW) - (p.x_start || 0), h: (p.y_end || canvasH) - (p.y_start || 0) };
    default: return { x: 0, y: 0, w: 50, h: 50 };
  }
}

// === DRAWING ===
function screenToCanvas(e) {
  const rect = canvas.getBoundingClientRect();
  return { x: (e.clientX - rect.left - panX) / viewScale, y: (e.clientY - rect.top - panY) / viewScale };
}

function drawCanvas() {
  computeEffectiveProps();
  const wrap = document.getElementById('canvasWrap');
  canvas.width = wrap.clientWidth;
  canvas.height = wrap.clientHeight;
  ctx.fillStyle = '#111128';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(panX, panY);
  ctx.scale(viewScale, viewScale);
  const bg = document.getElementById('bgSelect').value;
  ctx.shadowColor = 'rgba(233,69,96,0.15)'; ctx.shadowBlur = 30;
  ctx.fillStyle = resolveColor(bg);
  ctx.fillRect(0, 0, canvasW, canvasH);
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
  ctx.strokeStyle = bg === 'black' ? '#333' : '#ddd';
  ctx.lineWidth = 0.3;
  for (let x = 0; x <= canvasW; x += 10) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvasH); ctx.stroke(); }
  for (let y = 0; y <= canvasH; y += 10) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvasW, y); ctx.stroke(); }
  elements.forEach(el => {
    if (!el.props.visible) { ctx.globalAlpha = 0.3; }
    drawElement(el);
    ctx.globalAlpha = 1;
  });
  if (selectedId) {
    const sel = elements.find(e => e.id === selectedId);
    if (sel) {
      if (sel.type === 'line') {
        const p = sel._effectiveProps || sel.props;
        const hr = 5 / viewScale;
        ctx.fillStyle = '#e94560';
        ctx.beginPath(); ctx.arc(p.x_start, p.y_start, hr, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(p.x_end, p.y_end, hr, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#e94560'; ctx.lineWidth = 1 / viewScale;
        ctx.setLineDash([4 / viewScale, 3 / viewScale]);
        ctx.beginPath(); ctx.moveTo(p.x_start, p.y_start); ctx.lineTo(p.x_end, p.y_end); ctx.stroke();
        ctx.setLineDash([]);
      } else {
        const bb = getBBox(sel);
        ctx.strokeStyle = '#e94560';
        ctx.lineWidth = 1.5 / viewScale;
        ctx.setLineDash([4 / viewScale, 3 / viewScale]);
        ctx.strokeRect(bb.x - 2, bb.y - 2, bb.w + 4, bb.h + 4);
        ctx.setLineDash([]);
        const hs = 4 / viewScale;
        ctx.fillStyle = '#e94560';
        [[bb.x - 2, bb.y - 2], [bb.x + bb.w + 2, bb.y - 2], [bb.x - 2, bb.y + bb.h + 2], [bb.x + bb.w + 2, bb.y + bb.h + 2]].forEach(([hx, hy]) => {
          ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
        });
      }
    }
  }
  ctx.restore();
}

function drawElement(el) {
  const p = el._effectiveProps || el.props;
  ctx.lineWidth = 1;
  switch (el.type) {
    case 'text': {
      ctx.fillStyle = resolveColor(p.color);
      ctx.font = `${p.size}px sans-serif`;
      const ta = anchorToCanvas(p.anchor);
      ctx.textAlign = p.align || ta.textAlign;
      ctx.textBaseline = ta.textBaseline;
      if (p.stroke_width > 0) {
        ctx.strokeStyle = resolveColor(p.stroke_fill || 'white');
        ctx.lineWidth = p.stroke_width;
        ctx.strokeText(String(p.value), p.x, p.y);
      }
      ctx.fillText(String(p.value), p.x, p.y);
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      break;
    }
    case 'multiline': {
      ctx.fillStyle = resolveColor(p.color);
      ctx.font = `${p.size}px sans-serif`;
      ctx.textBaseline = 'middle';
      const lines = String(p.value).split(p.delimiter || ';');
      let py = p.start_y || 10;
      lines.forEach(l => { ctx.fillText(l.trim(), p.x, py); py += p.offset_y; });
      break;
    }
    case 'new_multiline': {
      ctx.fillStyle = resolveColor(p.color);
      ctx.font = `${p.size}px sans-serif`;
      ctx.textAlign = p.align || 'left';
      ctx.textBaseline = 'top';
      const lines = String(p.value).split(/\n/);
      const lh = p.spacing || p.size * 1.2;
      let py = p.y;
      lines.forEach(l => { ctx.fillText(l, p.x, py); py += lh; });
      ctx.textAlign = 'left';
      break;
    }
    case 'line': {
      ctx.strokeStyle = resolveColor(p.fill);
      ctx.lineWidth = p.width;
      ctx.beginPath(); ctx.moveTo(p.x_start, p.y_start); ctx.lineTo(p.x_end, p.y_end); ctx.stroke();
      break;
    }
    case 'rectangle': {
      if (p.fill) { ctx.fillStyle = resolveColor(p.fill); ctx.fillRect(p.x_start, p.y_start, p.x_end - p.x_start, p.y_end - p.y_start); }
      ctx.strokeStyle = resolveColor(p.outline);
      ctx.lineWidth = p.width;
      if (p.radius > 0) { roundRect(ctx, p.x_start, p.y_start, p.x_end - p.x_start, p.y_end - p.y_start, p.radius, !!p.fill, true); }
      else { ctx.strokeRect(p.x_start, p.y_start, p.x_end - p.x_start, p.y_end - p.y_start); }
      break;
    }
    case 'rectangle_pattern': {
      for (let xi = 0; xi < p.x_repeat; xi++) for (let yi = 0; yi < p.y_repeat; yi++) {
        const rx = p.x_start + xi * (p.x_size + p.x_offset), ry = p.y_start + yi * (p.y_size + p.y_offset);
        if (p.fill) { ctx.fillStyle = resolveColor(p.fill); ctx.fillRect(rx, ry, p.x_size, p.y_size); }
        ctx.strokeStyle = resolveColor(p.outline); ctx.lineWidth = p.width; ctx.strokeRect(rx, ry, p.x_size, p.y_size);
      }
      break;
    }
    case 'circle': {
      ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      if (p.fill) { ctx.fillStyle = resolveColor(p.fill); ctx.fill(); }
      ctx.strokeStyle = resolveColor(p.outline); ctx.lineWidth = p.width; ctx.stroke();
      break;
    }
    case 'ellipse': {
      const cx = (p.x_start + p.x_end) / 2, cy = (p.y_start + p.y_end) / 2, rx = (p.x_end - p.x_start) / 2, ry = (p.y_end - p.y_start) / 2;
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      if (p.fill) { ctx.fillStyle = resolveColor(p.fill); ctx.fill(); }
      ctx.strokeStyle = resolveColor(p.outline); ctx.lineWidth = p.width; ctx.stroke();
      break;
    }
    case 'icon': {
      const iconKey = String(p.value).replace(/^mdi:/, '');
      const pathData = mdiPathCache[iconKey];
      const { ox, oy } = anchorOffset(p.anchor, p.size, p.size);
      if (pathData) {
        const s = p.size / 24;
        ctx.save();
        ctx.translate(p.x + ox, p.y + oy);
        ctx.scale(s, s);
        const path2d = new Path2D(pathData);
        ctx.fillStyle = resolveColor(p.color);
        if (p.stroke_width > 0) {
          ctx.strokeStyle = resolveColor(p.stroke_fill || 'white');
          ctx.lineWidth = p.stroke_width / s;
          ctx.stroke(path2d);
        }
        ctx.fill(path2d);
        ctx.restore();
      } else {
        loadMdiIcon(iconKey);
        ctx.fillStyle = '#999';
        ctx.strokeStyle = '#999'; ctx.lineWidth = 1;
        ctx.strokeRect(p.x + ox, p.y + oy, p.size, p.size);
        ctx.font = `${Math.min(p.size * 0.4, 14)}px sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('mdi', p.x + ox + p.size / 2, p.y + oy + p.size / 2);
      }
      const bb = getBBox(el);
      ctx.fillStyle = resolveColor(p.color);
      ctx.font = `${Math.min(p.size * 0.35, 12)}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(iconKey, bb.x + bb.w / 2, bb.y + bb.h + 2);
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      break;
    }
    case 'dlimg': {
      ctx.strokeStyle = '#666'; ctx.lineWidth = 1; ctx.setLineDash([3, 2]);
      ctx.strokeRect(p.x, p.y, p.xsize, p.ysize); ctx.setLineDash([]);
      ctx.fillStyle = '#666'; ctx.font = '10px sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
      ctx.fillText('🖼 image', p.x + p.xsize / 2, p.y + p.ysize / 2); ctx.textAlign = 'left';
      break;
    }
    case 'qrcode': {
      const sz = getQRSize(p);
      const s = Math.min(sz.w, sz.h);
      ctx.fillStyle = resolveColor(p.bgcolor); ctx.fillRect(p.x, p.y, s, s);
      ctx.fillStyle = resolveColor(p.color);
      const bs = Math.max(1, Math.floor(s / 25));
      ctx.fillRect(p.x + bs * 2, p.y + bs * 2, 7 * bs, 7 * bs);
      ctx.clearRect(p.x + bs * 3, p.y + bs * 3, 5 * bs, 5 * bs);
      ctx.fillRect(p.x + bs * 4, p.y + bs * 4, 3 * bs, 3 * bs);
      ctx.font = '8px sans-serif'; ctx.textBaseline = 'bottom'; ctx.fillText('QR', p.x + 2, p.y + s - 2);
      break;
    }
    case 'barcode': {
      const sz = getBarcodeSize(p);
      ctx.fillStyle = resolveColor(p.bgcolor ?? 'white'); ctx.fillRect(p.x, p.y, sz.w, sz.h);
      ctx.fillStyle = resolveColor(p.color ?? 'black');
      const barH = p.write_text === false ? sz.h - 4 : Math.round(sz.h * 0.65);
      const numBars = 40;
      const step = (sz.w - 8) / numBars;
      for (let i = 0; i < numBars; i++) {
        if ((i * 7 + 3) % 5 < 3) ctx.fillRect(p.x + 4 + i * step, p.y + 2, step * 0.6, barH);
      }
      if (p.write_text !== false) {
        ctx.font = '9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText(String(p.data), p.x + sz.w / 2, p.y + sz.h - 2);
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      }
      break;
    }
    case 'progress_bar': {
      const w = p.x_end - p.x_start, h = p.y_end - p.y_start;
      ctx.fillStyle = resolveColor(p.background); ctx.fillRect(p.x_start, p.y_start, w, h);
      ctx.fillStyle = resolveColor(p.fill);
      const prog = Math.max(0, Math.min(100, p.progress)) / 100;
      if (p.direction === 'right') ctx.fillRect(p.x_start, p.y_start, w * prog, h);
      else if (p.direction === 'left') ctx.fillRect(p.x_end - w * prog, p.y_start, w * prog, h);
      else if (p.direction === 'up') ctx.fillRect(p.x_start, p.y_end - h * prog, w, h * prog);
      else ctx.fillRect(p.x_start, p.y_start, w, h * prog);
      ctx.strokeStyle = resolveColor(p.outline); ctx.lineWidth = p.width; ctx.strokeRect(p.x_start, p.y_start, w, h);
      if (p.show_percentage) {
        ctx.fillStyle = prog > 0.5 ? resolveColor(p.background) : resolveColor(p.fill);
        ctx.font = `${Math.min(h - 4, 14)}px sans-serif`; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
        ctx.fillText(`${p.progress}%`, (p.x_start + p.x_end) / 2, (p.y_start + p.y_end) / 2); ctx.textAlign = 'left';
      }
      break;
    }
    case 'battery': {
      const pad = 2;
      const bodyW = Math.max(8, p.width - pad * 3);
      ctx.strokeStyle = resolveColor(p.outline || 'black'); ctx.lineWidth = 1;
      ctx.strokeRect(p.x, p.y, bodyW, p.height);
      ctx.fillStyle = resolveColor(p.background || 'white'); ctx.fillRect(p.x + 1, p.y + 1, bodyW - 2, p.height - 2);
      const lvl = Math.max(0, Math.min(100, p.level));
      const fillColor = lvl <= (p.low_threshold ?? 20) ? resolveColor(p.low_color || 'red') : resolveColor(p.fill || 'black');
      ctx.fillStyle = fillColor;
      ctx.fillRect(p.x + 2, p.y + 2, Math.max(0, (bodyW - 4) * lvl / 100), p.height - 4);
      ctx.fillStyle = resolveColor(p.outline || 'black');
      ctx.fillRect(p.x + bodyW, p.y + p.height * 0.3, pad, p.height * 0.4);
      break;
    }
    case 'gauge': {
      const start = -Math.PI * 0.75, end = Math.PI * 0.75;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, start, end);
      ctx.strokeStyle = resolveColor(p.outline || 'black'); ctx.lineWidth = p.width || 6; ctx.stroke();
      const prog = Math.max(0, Math.min(100, p.progress)) / 100;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, start, start + (end - start) * prog);
      ctx.strokeStyle = resolveColor(p.fill || 'red'); ctx.lineWidth = p.width || 6; ctx.stroke();
      ctx.fillStyle = '#666'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`${p.progress}%`, p.x, p.y);
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      break;
    }
    case 'pie': {
      const slices = parsePieValues(p.values);
      const total = slices.reduce((s, it) => s + it.value, 0) || 1;
      let ang = -Math.PI / 2;
      slices.forEach(sl => {
        const sweep = (sl.value / total) * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(p.x, p.y);
        ctx.arc(p.x, p.y, p.radius, ang, ang + sweep); ctx.closePath();
        ctx.fillStyle = resolveColor(sl.color); ctx.fill();
        ang += sweep;
      });
      if (p.inner_radius > 0) {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.inner_radius, 0, Math.PI * 2);
        ctx.fillStyle = '#fff'; ctx.fill();
      }
      break;
    }
    case 'sparkline': {
      const vals = parseSparklineValues(p.values);
      if (!vals.length) break;
      const min = Math.min(...vals), max = Math.max(...vals), range = max - min || 1;
      ctx.strokeStyle = resolveColor(p.color || 'black'); ctx.lineWidth = 1.5;
      ctx.beginPath();
      vals.forEach((v, i) => {
        const x = p.x + (i / Math.max(1, vals.length - 1)) * p.width;
        const y = p.y + p.height - ((v - min) / range) * (p.height - 4) - 2;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
      if (p.fill) {
        ctx.save(); ctx.globalAlpha = 0.3; ctx.fillStyle = resolveColor(p.fill);
        ctx.lineTo(p.x + p.width, p.y + p.height); ctx.lineTo(p.x, p.y + p.height); ctx.closePath(); ctx.fill(); ctx.restore();
      }
      if (p.dot_last && vals.length) {
        const lx = p.x + p.width, ly = p.y + p.height - ((vals[vals.length - 1] - min) / range) * (p.height - 4) - 2;
        ctx.fillStyle = resolveColor(p.color || 'black'); ctx.beginPath(); ctx.arc(lx, ly, 2.5, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case 'text_fit': {
      ctx.strokeStyle = '#666'; ctx.setLineDash([4, 3]); ctx.strokeRect(p.x, p.y, p.width, p.height); ctx.setLineDash([]);
      ctx.fillStyle = resolveColor(p.color || 'black');
      ctx.font = `${Math.min(p.size || 20, p.height - 4)}px sans-serif`;
      ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      const txt = String(p.value || '');
      const shown = txt.length > 24 ? txt.slice(0, 22) + '…' : txt;
      ctx.fillText(shown, p.x + 4, p.y + p.height / 2);
      ctx.textBaseline = 'top';
      break;
    }
    case 'row': case 'column': case 'stack': case 'group': {
      ctx.setLineDash([5, 4]); ctx.strokeStyle = '#7fdbca'; ctx.lineWidth = 1;
      ctx.strokeRect(p.x || 0, p.y || 0, p.width || 120, p.height || 40); ctx.setLineDash([]);
      ctx.fillStyle = '#7fdbca'; ctx.font = '10px sans-serif';
      ctx.fillText(el.type, (p.x || 0) + 4, (p.y || 0) + 12);
      break;
    }
    case 'diagram': {
      const dw = p.width ?? canvasW, dm = p.margin ?? 20;
      ctx.strokeStyle = '#333'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(p.x + dm, p.y); ctx.lineTo(p.x + dm, p.y + p.height - dm); ctx.lineTo(p.x + dw, p.y + p.height - dm); ctx.stroke();
      ctx.fillStyle = '#666'; ctx.font = '9px sans-serif'; ctx.textBaseline = 'top'; ctx.textAlign = 'center';
      ctx.fillText('📊 diagram', p.x + dw / 2, p.y + p.height / 2 - 6); ctx.textAlign = 'left';
      break;
    }
    case 'plot': {
      const px0 = p.x_start || 0, py0 = p.y_start || 0, px1 = p.x_end || canvasW, py1 = p.y_end || canvasH;
      ctx.strokeStyle = '#333'; ctx.lineWidth = 1; ctx.strokeRect(px0, py0, px1 - px0, py1 - py0);
      ctx.strokeStyle = resolveColor(p.data_color); ctx.lineWidth = p.data_width || 1;
      ctx.beginPath();
      const pw = px1 - px0, ph = py1 - py0;
      for (let i = 0; i <= 20; i++) { const x = px0 + i / 20 * pw, y = py0 + ph / 2 + Math.sin(i * 0.8) * ph * 0.3; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.stroke();
      ctx.fillStyle = '#666'; ctx.font = '8px sans-serif'; ctx.textBaseline = 'top';
      ctx.fillText(p.data_entity, px0 + 3, py0 + 3);
      break;
    }
  }
}

function roundRect(ctx, x, y, w, h, r, doFill, doStroke) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  if (doFill) ctx.fill(); if (doStroke) ctx.stroke();
}

// === INTERACTION ===
function hitHandle(mx, my, bb, el) {
  const r = 6 / viewScale;
  if (el && el.type === 'line') {
    const p = el._effectiveProps || el.props;
    if (Math.hypot(mx - p.x_start, my - p.y_start) <= r) return 'start';
    if (Math.hypot(mx - p.x_end, my - p.y_end) <= r) return 'end';
    return null;
  }
  const handles = [
    { id: 'tl', x: bb.x - 2, y: bb.y - 2 },
    { id: 'tr', x: bb.x + bb.w + 2, y: bb.y - 2 },
    { id: 'bl', x: bb.x - 2, y: bb.y + bb.h + 2 },
    { id: 'br', x: bb.x + bb.w + 2, y: bb.y + bb.h + 2 }
  ];
  for (const h of handles) {
    if (Math.abs(mx - h.x) <= r && Math.abs(my - h.y) <= r) return h.id;
  }
  return null;
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function cornerResizeXYWH(sp, handle, dx, dy, w, h, minW = 8, minH = 8) {
  let x1 = sp.x ?? 0, y1 = sp.y ?? 0, x2 = x1 + w, y2 = y1 + h;
  if (handle.includes('l')) x1 += dx;
  if (handle.includes('r')) x2 += dx;
  if (handle.includes('t')) y1 += dy;
  if (handle.includes('b')) y2 += dy;
  return {
    x: Math.round(x1),
    y: Math.round(y1),
    w: Math.max(minW, Math.round(x2 - x1)),
    h: Math.max(minH, Math.round(y2 - y1)),
  };
}

function applyResize(el, sp, handle, dx, dy) {
  const t = el.type;
  if (t === 'rectangle' || t === 'ellipse' || t === 'progress_bar') {
    if (handle === 'br') { el.props.x_end = sp.x_end + dx; el.props.y_end = sp.y_end + dy; }
    if (handle === 'tl') { el.props.x_start = sp.x_start + dx; el.props.y_start = sp.y_start + dy; }
    if (handle === 'tr') { el.props.x_end = sp.x_end + dx; el.props.y_start = sp.y_start + dy; }
    if (handle === 'bl') { el.props.x_start = sp.x_start + dx; el.props.y_end = sp.y_end + dy; }
  } else if (t === 'line') {
    if (handle === 'start') { el.props.x_start = sp.x_start + dx; el.props.y_start = sp.y_start + dy; }
    if (handle === 'end') { el.props.x_end = sp.x_end + dx; el.props.y_end = sp.y_end + dy; }
  } else if (t === 'circle') {
    const newR = Math.max(5, sp.radius + Math.max(dx, dy) * (handle.includes('r') || handle.includes('b') ? 1 : -1));
    el.props.radius = Math.round(newR);
  } else if (t === 'text' || t === 'icon') {
    const isText = t === 'text';
    const oldW = isText ? Math.max(sp.size * String(sp.value).length * 0.6, 40) : sp.size;
    const oldH = isText ? sp.size * 1.3 : sp.size;
    let x1 = sp.x, y1 = sp.y, x2 = sp.x + oldW, y2 = sp.y + oldH;
    if (handle.includes('l')) x1 += dx;
    if (handle.includes('r')) x2 += dx;
    if (handle.includes('t')) y1 += dy;
    if (handle.includes('b')) y2 += dy;
    const newH = Math.max(12, y2 - y1);
    el.props.size = Math.max(8, Math.round(isText ? newH / 1.3 : newH));
    el.props.x = Math.round(x1);
    el.props.y = Math.round(y1);
  } else if (t === 'dlimg') {
    if (handle === 'br') { el.props.xsize = Math.max(10, sp.xsize + dx); el.props.ysize = Math.max(10, sp.ysize + dy); }
    if (handle === 'tl') { el.props.x = sp.x + dx; el.props.y = sp.y + dy; el.props.xsize = Math.max(10, sp.xsize - dx); el.props.ysize = Math.max(10, sp.ysize - dy); }
    if (handle === 'tr') { el.props.y = sp.y + dy; el.props.xsize = Math.max(10, sp.xsize + dx); el.props.ysize = Math.max(10, sp.ysize - dy); }
    if (handle === 'bl') { el.props.x = sp.x + dx; el.props.xsize = Math.max(10, sp.xsize - dx); el.props.ysize = Math.max(10, sp.ysize + dy); }
  } else if (t === 'barcode' || t === 'qrcode' || t === 'battery' || t === 'sparkline' || t === 'text_fit' || t === 'row' || t === 'column' || t === 'stack' || t === 'group') {
    const curW = t === 'barcode' ? getBarcodeSize(sp).w : t === 'qrcode' ? getQRSize(sp).w : (sp.width || 50);
    const curH = t === 'barcode' ? getBarcodeSize(sp).h : t === 'qrcode' ? getQRSize(sp).h : (sp.height || 50);
    const r = cornerResizeXYWH(sp, handle, dx, dy, curW, curH);
    el.props.x = r.x;
    el.props.y = r.y;
    el.props.width = r.w;
    el.props.height = r.h;
  } else if (t === 'gauge' || t === 'pie') {
    let x1 = sp.x - sp.radius, y1 = sp.y - sp.radius, x2 = sp.x + sp.radius, y2 = sp.y + sp.radius;
    if (handle.includes('l')) x1 += dx;
    if (handle.includes('r')) x2 += dx;
    if (handle.includes('t')) y1 += dy;
    if (handle.includes('b')) y2 += dy;
    const newR = Math.max(5, Math.round(Math.max(x2 - x1, y2 - y1) / 2));
    el.props.radius = newR;
    el.props.x = Math.round((x1 + x2) / 2);
    el.props.y = Math.round((y1 + y2) / 2);
  } else if (t === 'diagram') {
    const r = cornerResizeXYWH(sp, handle, dx, dy, sp.width || canvasW, sp.height || 100, 40, 30);
    el.props.x = r.x;
    el.props.y = r.y;
    el.props.width = r.w;
    el.props.height = r.h;
  } else if (t === 'plot') {
    if (handle === 'br') { el.props.x_end = (sp.x_end || canvasW) + dx; el.props.y_end = (sp.y_end || canvasH) + dy; }
    if (handle === 'tl') { el.props.x_start = (sp.x_start || 0) + dx; el.props.y_start = (sp.y_start || 0) + dy; }
    if (handle === 'tr') { el.props.x_end = (sp.x_end || canvasW) + dx; el.props.y_start = (sp.y_start || 0) + dy; }
    if (handle === 'bl') { el.props.x_start = (sp.x_start || 0) + dx; el.props.y_end = (sp.y_end || canvasH) + dy; }
  } else if (t === 'rectangle_pattern') {
    if (handle === 'br') {
      const totalDx = dx / (sp.x_repeat || 1);
      const totalDy = dy / (sp.y_repeat || 1);
      el.props.x_size = Math.max(5, Math.round(sp.x_size + totalDx));
      el.props.y_size = Math.max(5, Math.round(sp.y_size + totalDy));
    }
  } else if (t === 'multiline') {
    const lines = String(sp.value).split(sp.delimiter || ';');
    const oldH = lines.length * sp.offset_y;
    let y1 = sp.start_y || 10, y2 = y1 + oldH;
    if (handle.includes('t')) y1 += dy;
    if (handle.includes('b')) y2 += dy;
    const newH = Math.max(12, y2 - y1);
    el.props.size = Math.max(8, Math.round(newH / lines.length / 1.3));
    el.props.start_y = Math.round(y1);
  } else if (t === 'new_multiline') {
    const r = cornerResizeXYWH(sp, handle, dx, dy, sp.width || 200, sp.height || 60, 40, 20);
    el.props.x = r.x;
    el.props.y = r.y;
    el.props.width = r.w;
    el.props.height = r.h;
  }
}

canvas.addEventListener('mousedown', e => {
  const { x: mx, y: my } = screenToCanvas(e);
  if (selectedId) {
    const sel = elements.find(el => el.id === selectedId);
    if (sel) {
      const bb = getBBox(sel);
      const handle = hitHandle(mx, my, bb, sel);
      if (handle) {
        dragging = { type: 'resize', id: sel.id, handle, startMx: mx, startMy: my, startProps: JSON.parse(JSON.stringify(sel.props)) };
        refresh(); return;
      }
    }
  }
  let hit = null;
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    if (el.type === 'line') {
      const p = el._effectiveProps || el.props;
      if (distToSegment(mx, my, p.x_start, p.y_start, p.x_end, p.y_end) <= 6) {
        hit = el; break;
      }
    } else {
      const bb = getBBox(el);
      if (mx >= bb.x - 4 && mx <= bb.x + bb.w + 4 && my >= bb.y - 4 && my <= bb.y + bb.h + 4) {
        hit = el; break;
      }
    }
  }
  if (hit) {
    selectedId = hit.id;
    dragging = { type: 'move', id: hit.id, startMx: mx, startMy: my, startProps: JSON.parse(JSON.stringify(hit.props)) };
  } else {
    selectedId = null;
    dragging = { type: 'pan', startX: e.clientX, startY: e.clientY, startPanX: panX, startPanY: panY };
    document.getElementById('canvasWrap').classList.add('panning');
  }
  refresh();
});

canvas.addEventListener('mousemove', e => {
  const { x: mx, y: my } = screenToCanvas(e);
  if (mx >= 0 && mx <= canvasW && my >= 0 && my <= canvasH) {
    tooltip.style.display = 'block';
    tooltip.style.left = (e.clientX + 12) + 'px';
    tooltip.style.top = (e.clientY - 8) + 'px';
    tooltip.textContent = `${Math.round(mx)}, ${Math.round(my)}`;
  } else {
    tooltip.style.display = 'none';
  }
  if (!dragging) {
    let cursor = '';
    if (selectedId) {
      const sel = elements.find(el => el.id === selectedId);
      if (sel) {
        const handle = hitHandle(mx, my, getBBox(sel), sel);
        if (handle) cursor = (sel.type === 'line') ? 'crosshair' : (handle === 'tl' || handle === 'br') ? 'nwse-resize' : 'nesw-resize';
      }
    }
    if (!cursor) {
      for (let i = elements.length - 1; i >= 0; i--) {
        const el = elements[i];
        if (el.type === 'line') {
          const p = el._effectiveProps || el.props;
          if (distToSegment(mx, my, p.x_start, p.y_start, p.x_end, p.y_end) <= 6) {
            cursor = 'move'; break;
          }
        } else {
          const bb = getBBox(el);
          if (mx >= bb.x - 4 && mx <= bb.x + bb.w + 4 && my >= bb.y - 4 && my <= bb.y + bb.h + 4) {
            cursor = 'move'; break;
          }
        }
      }
    }
    canvas.style.cursor = cursor || '';
  }
  if (!dragging) return;
  if (dragging.type === 'pan') {
    panX = dragging.startPanX + (e.clientX - dragging.startX);
    panY = dragging.startPanY + (e.clientY - dragging.startY);
    drawCanvas(); return;
  }
  const el = elements.find(e => e.id === dragging.id);
  if (!el) return;
  const dx = Math.round(mx - dragging.startMx);
  const dy = Math.round(my - dragging.startMy);
  const sp = dragging.startProps;
  if (dragging.type === 'resize') {
    applyResize(el, sp, dragging.handle, dx, dy);
    refresh(); return;
  }
  if ('x' in el.props && 'y' in el.props && !('x_start' in el.props)) {
    el.props.x = sp.x + dx;
    el.props.y = sp.y + dy;
  }
  if ('x_start' in el.props) {
    el.props.x_start = sp.x_start + dx;
    el.props.x_end = sp.x_end + dx;
    el.props.y_start = sp.y_start + dy;
    el.props.y_end = sp.y_end + dy;
  }
  if (el.type === 'multiline') { el.props.x = sp.x + dx; el.props.start_y = (sp.start_y || 10) + dy; }
  if (el.type === 'new_multiline') { el.props.x = sp.x + dx; el.props.y = sp.y + dy; }
  refresh();
});

canvas.addEventListener('mouseup', () => {
  document.getElementById('canvasWrap').classList.remove('panning');
  dragging = null;
});
canvas.addEventListener('mouseleave', () => {
  tooltip.style.display = 'none';
  document.getElementById('canvasWrap').classList.remove('panning');
  dragging = null;
});

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  const oldScale = viewScale;
  const factor = e.deltaY > 0 ? 0.9 : 1.1;
  viewScale = Math.max(0.5, Math.min(20, viewScale * factor));
  panX = mouseX - (mouseX - panX) * (viewScale / oldScale);
  panY = mouseY - (mouseY - panY) * (viewScale / oldScale);
  drawCanvas();
}, { passive: false });

document.addEventListener('keydown', e => {
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (selectedId && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'SELECT') {
      removeElement(selectedId);
    }
  }
});

// === UI RENDERING ===
function refresh() {
  drawCanvas();
  renderElementList();
  renderProps();
  renderYaml();
}

function renderElementList() {
  const list = document.getElementById('elementList');
  if (elements.length === 0) { list.innerHTML = '<div class="no-elements">Click a button above to add elements</div>'; return; }
  list.innerHTML = elements.map(el => `
<div class="el-item ${el.id === selectedId ? 'selected' : ''}" onclick="selectedId=${el.id};refresh()">
  <span class="el-type">${el.type}</span>
  <span class="el-label">${getElLabel(el)}</span>
  <span class="el-actions">
    <button title="Move up" onclick="event.stopPropagation();moveElement(${el.id},'up')">↑</button>
    <button title="Move down" onclick="event.stopPropagation();moveElement(${el.id},'down')">↓</button>
    <button title="Duplicate" onclick="event.stopPropagation();duplicateElement(${el.id})">⧉</button>
    <button title="Delete" onclick="event.stopPropagation();removeElement(${el.id})">✕</button>
  </span>
</div>`).join('');
}

function getElLabel(el) {
  const p = el.props;
  if (p.value) return String(p.value).substring(0, 20);
  if (p.data) return String(p.data).substring(0, 20);
  if (p.data_entity) return p.data_entity;
  if (p.url) return String(p.url).substring(0, 20) || 'image';
  return '';
}

function renderProps() {
  const panel = document.getElementById('propsContent');
  const el = elements.find(e => e.id === selectedId);
  if (!el) { panel.innerHTML = '<div class="no-elements">Select an element</div>'; return; }
  const req = new Set(REQUIRED[el.type] || []);
  let html = '';
  for (const [key, val] of Object.entries(el.props)) {
    if (EDITOR_ONLY_PROPS.has(key)) continue;
    const meta = FIELD_META[key] || { t: 'str' };
    const isReq = req.has(key);
    const lbl = `<label${isReq ? ' class="required"' : ''}>${key}</label>`;
    let input = '';
    if (meta.t === 'num') {
      let step = 'any'; let min = '';
      if (key === 'module_width') { step = '0.1'; min = '0.1'; }
      else if (['x', 'y', 'width', 'height', 'size', 'radius'].includes(key)) { step = '1'; }
      else if (min === '') min = '0';
      input = `<input type="number" value="${val}" step="${step}" min="${min}" onchange="updateProp(${el.id},'${key}',this.value,'num')">`;
    }
    else if (meta.t === 'bool') input = `<select onchange="updateProp(${el.id},'${key}',this.value,'bool')"><option value="true"${val ? 'selected' : ''}>true</option><option value="false"${!val ? 'selected' : ''}>false</option></select>`;
    else if (meta.t === 'sel') input = `<select onchange="updateProp(${el.id},'${key}',this.value,'str')">${meta.opts.map(o => `<option${o == val ? ' selected' : ''}>${o}</option>`).join('')}</select>`;
    else if (meta.t === 'color_sel') input = `<select onchange="updateProp(${el.id},'${key}',this.value,'str')"><option value=""${val === '' ? ' selected' : ''}>—</option><option value="white"${val === 'white' ? ' selected' : ''}>white</option><option value="black"${val === 'black' ? ' selected' : ''}>black</option><option value="red"${val === 'red' ? ' selected' : ''}>red</option><option value="yellow"${val === 'yellow' ? ' selected' : ''}>yellow</option><option value="blue"${val === 'blue' ? ' selected' : ''}>blue</option><option value="green"${val === 'green' ? ' selected' : ''}>green</option><option value="orange"${val === 'orange' ? ' selected' : ''}>orange</option></select>`;
    else input = `<input type="text" value="${escHtml(String(val))}" onchange="updateProp(${el.id},'${key}',this.value,'str')">`;
    html += `<div class="prop-row">${lbl}${input}</div>`;
  }
  panel.innerHTML = html;
}

function escHtml(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function updateProp(id, key, val, type) {
  const el = elements.find(e => e.id === id);
  if (!el) return;
  if (type === 'num') el.props[key] = val === '' ? 0 : parseFloat(val);
  else if (type === 'bool') el.props[key] = val === 'true';
  else el.props[key] = val;
  refresh();
}

// === YAML GENERATION ===
function importPayloadItem(item) {
  const type = item.type;
  if (!type) return null;
  const props = JSON.parse(JSON.stringify(ELEMENT_DEFAULTS[type] || {}));
  for (const [k, v] of Object.entries(item)) {
    if (k === 'type') continue;
    if (k === 'bars' && type === 'diagram') {
      if (v.values !== undefined) props.bars_values = v.values;
      if (v.color !== undefined) props.bars_color = v.color;
      if (v.margin !== undefined) props.bars_margin = v.margin;
      if (v.legend_size !== undefined) props.bars_legend_size = v.legend_size;
      if (v.legend_color !== undefined) props.bars_legend_color = v.legend_color;
      continue;
    }
    if (k === 'data' && type === 'plot' && Array.isArray(v)) {
      if (v.length > 0) {
        const dItem = v[0];
        if (dItem.entity !== undefined) props.data_entity = dItem.entity;
        if (dItem.color !== undefined) props.data_color = dItem.color;
        if (dItem.width !== undefined) props.data_width = dItem.width;
      }
      continue;
    }
    if (k === 'elements' && LAYOUT_TYPES.has(type) && Array.isArray(v)) {
      props._children = v.map(child => {
        const imported = importPayloadItem(child);
        return imported ? { type: imported.type, props: imported.props } : null;
      }).filter(Boolean);
      continue;
    }
    props[k] = v;
  }
  return { type, props };
}

function appendPayloadYaml(el, indent) {
  const pad = ' '.repeat(indent);
  const childPad = ' '.repeat(indent + 2);
  let yaml = `${pad}- type: ${el.type}\n`;
  const defaults = ELEMENT_DEFAULTS[el.type] || {};
  for (const [key, val] of Object.entries(el.props)) {
    if (EDITOR_ONLY_PROPS.has(key)) continue;
    if (el.type === 'diagram' && key.startsWith('bars_')) continue;
    if (el.type === 'plot' && key.startsWith('data_')) continue;
    const req = new Set(REQUIRED[el.type] || []);
    if (!req.has(key) && val === '') continue;
    if (!req.has(key) && val === 0 && defaults[key] === 0) continue;
    if (!req.has(key) && defaults && val === defaults[key]) continue;
    let yval = val;
    if (el.type === 'barcode' && key === 'data') yval = `"${val}"`;
    else if (typeof val === 'string') yval = yamlQuote(val);
    yaml += `${childPad}${key}: ${yval}\n`;
  }
  if (el.type === 'diagram') {
    yaml += `${childPad}bars:\n`;
    yaml += `${childPad}  values: "${el.props.bars_values}"\n`;
    yaml += `${childPad}  color: ${el.props.bars_color}\n`;
    if (el.props.bars_margin !== 10) yaml += `${childPad}  margin: ${el.props.bars_margin}\n`;
    if (el.props.bars_legend_size !== 10) yaml += `${childPad}  legend_size: ${el.props.bars_legend_size}\n`;
    if (el.props.bars_legend_color !== 'black') yaml += `${childPad}  legend_color: ${el.props.bars_legend_color}\n`;
  }
  if (el.type === 'plot') {
    yaml += `${childPad}data:\n`;
    yaml += `${childPad}  - entity: ${el.props.data_entity}\n`;
    if (el.props.data_color !== 'black') yaml += `${childPad}    color: ${el.props.data_color}\n`;
    if (el.props.data_width !== 2) yaml += `${childPad}    width: ${el.props.data_width}\n`;
  }
  if (LAYOUT_TYPES.has(el.type) && Array.isArray(el.props._children) && el.props._children.length) {
    yaml += `${childPad}elements:\n`;
    el.props._children.forEach(child => {
      yaml += appendPayloadYaml({ type: child.type, props: child.props || {} }, indent + 4);
    });
  }
  return yaml;
}

function renderYaml(force = false) {
    const yamlEl = document.getElementById('yaml-output');
    if (!force && document.activeElement === yamlEl) return;

    const rot = document.getElementById('rotateSelect').value;
    const bg = document.getElementById('bgSelect').value;
    let yaml = `action: ${PROFILE.action}\n# imagespec payload — https://github.com/eigger/imagespec\n# Authoring: ${IMAGESPEC_DOC}\n# Generated by ${PROFILE.title} v${EDITOR_VERSION}\ndata:\n`;
    if (PROFILE.yaml && PROFILE.yaml.emitWidthHeight) {
      yaml += `  width: ${canvasW}\n`;
      yaml += `  height: ${canvasH}\n`;
    }
    if (rot !== '0') yaml += `  rotate: ${rot}\n`;
    if (bg !== 'white') yaml += `  background: ${bg}\n`;
    if (PROFILE.yaml && PROFILE.yaml.emitDensity) {
      const densityEl = document.getElementById('densityInput');
      const density = parseInt((densityEl && densityEl.value) || '3', 10);
      if (density !== 3) yaml += `  density: ${density}\n`;
    }
    yaml += '  payload:\n';
    if (elements.length === 0) { yaml += '    []\n'; }
    else elements.forEach(el => { yaml += appendPayloadYaml(el, 4); });
    yaml += 'target:\n  device_id: <your device>';
    yamlEl.value = yaml;
  }

  function importYaml() {
    try {
      const text = document.getElementById('yaml-output').value;
      const parsed = jsyaml.load(text);
      if (!parsed || !parsed.data) throw new Error("Invalid YAML: Missing 'data' block");

      const d = parsed.data;
      if (d.rotate !== undefined) document.getElementById('rotateSelect').value = d.rotate;
      if (d.background !== undefined) document.getElementById('bgSelect').value = d.background;

      if (PROFILE.canvas.mode === 'freeform') {
        if (d.width) {
          canvasW = d.width;
          const wEl = document.getElementById('widthInput');
          if (wEl) wEl.value = d.width;
        }
        if (d.height) {
          canvasH = d.height;
          const hEl = document.getElementById('heightInput');
          if (hEl) hEl.value = d.height;
        }
        if (d.density !== undefined) {
          const dens = document.getElementById('densityInput');
          if (dens) dens.value = d.density;
        }
      }

      elements = [];
      nextId = 1;
      selectedId = null;

      if (Array.isArray(d.payload)) {
        d.payload.forEach(item => {
          const imported = importPayloadItem(item);
          if (imported && ELEMENT_DEFAULTS[imported.type]) {
            elements.push({ id: nextId++, type: imported.type, props: imported.props });
          }
        });
      }

      if (PROFILE.canvas.mode === 'preset' && PROFILE.canvas.rotationAffectsCanvas) {
        applyRotation();
      } else {
        updateScale();
        refresh();
      }
      alert('YAML imported successfully.');
    } catch (e) {
      alert('Import error: ' + e.message);
    }
  }

  function copyYaml() {
  const text = document.getElementById('yaml-output').value;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.querySelector('.btn.copy');
    btn.textContent = '✅ Copied!';
    setTimeout(() => btn.textContent = '📋 Copy', 1500);
  });
}

// === SIZE / SCALE ===
  function updateScale() {
    const wrap = document.getElementById('canvasWrap');
    const ww = wrap.clientWidth, wh = wrap.clientHeight;
    viewScale = Math.min(ww / canvasW, wh / canvasH) * 0.92;
    panX = (ww - canvasW * viewScale) / 2;
    panY = (wh - canvasH * viewScale) / 2;
  }

  function applyRotation() {
    if (!(PROFILE.canvas.rotationAffectsCanvas)) {
      updateScale();
      refresh();
      return;
    }
    const rot = parseInt(document.getElementById('rotateSelect').value, 10);
    if (rot === 90 || rot === 270) {
      canvasW = deviceH; canvasH = deviceW;
    } else {
      canvasW = deviceW; canvasH = deviceH;
    }
    updateScale();
    refresh();
  }

  function buildToolbar() {
    const bar = document.getElementById('toolbar');
    if (!bar || !PROFILE.toolbar) return;
    bar.innerHTML = '<span>Add:</span>';
    PROFILE.toolbar.forEach(item => {
      if (!ELEMENT_DEFAULTS[item.type]) return;
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.textContent = item.label;
      btn.addEventListener('click', () => addElement(item.type));
      bar.appendChild(btn);
    });
  }

  function bindCanvasControls() {
    const bg = document.getElementById('bgSelect');
    if (bg) bg.addEventListener('change', refresh);

    const rot = document.getElementById('rotateSelect');
    if (rot) {
      rot.addEventListener('change', () => {
        if (PROFILE.canvas.mode === 'preset' && PROFILE.canvas.rotationAffectsCanvas) applyRotation();
        else refresh();
      });
    }

    if (PROFILE.canvas.mode === 'preset') {
      const deviceSelect = document.getElementById('deviceSelect');
      if (deviceSelect) {
        deviceSelect.addEventListener('change', e => {
          const [w, h] = e.target.value.split(',').map(Number);
          deviceW = w; deviceH = h;
          applyRotation();
        });
      }
    } else {
      const widthInput = document.getElementById('widthInput');
      const heightInput = document.getElementById('heightInput');
      const densityInput = document.getElementById('densityInput');
      if (widthInput) {
        widthInput.addEventListener('change', e => {
          const w = Math.max(10, Math.min(1600, parseInt(e.target.value || String(PROFILE.canvas.defaultWidth), 10)));
          canvasW = w;
          e.target.value = w;
          updateScale();
          refresh();
        });
      }
      if (heightInput) {
        heightInput.addEventListener('change', e => {
          const h = Math.max(10, Math.min(1600, parseInt(e.target.value || String(PROFILE.canvas.defaultHeight), 10)));
          canvasH = h;
          e.target.value = h;
          updateScale();
          refresh();
        });
      }
      if (densityInput) densityInput.addEventListener('change', refresh);
    }
  }

  window.addEventListener('resize', () => { updateScale(); refresh(); });

  // Expose for inline HTML handlers (element list / toolbar fallbacks)
  window.addElement = addElement;
  window.importYaml = importYaml;
  window.copyYaml = copyYaml;
  window.removeElement = removeElement;
  window.moveElement = moveElement;
  window.duplicateElement = duplicateElement;
  window.refresh = refresh;
  Object.defineProperty(window, 'selectedId', {
    get() { return selectedId; },
    set(v) { selectedId = v; },
    configurable: true,
  });

  // === INIT ===
  (function init() {
    buildToolbar();
    bindCanvasControls();

    if (PROFILE.canvas.mode === 'preset') {
      const deviceSelect = document.getElementById('deviceSelect');
      if (deviceSelect) {
        const [w, h] = deviceSelect.value.split(',').map(Number);
        deviceW = w; deviceH = h;
      }
      document.querySelector('.header h1').textContent += ` v${EDITOR_VERSION}`;
      applyRotation();
    } else {
      const wEl = document.getElementById('widthInput');
      const hEl = document.getElementById('heightInput');
      canvasW = parseInt((wEl && wEl.value) || String(PROFILE.canvas.defaultWidth), 10);
      canvasH = parseInt((hEl && hEl.value) || String(PROFILE.canvas.defaultHeight), 10);
      document.querySelector('.header h1').textContent += ` v${EDITOR_VERSION}`;
      updateScale();
      refresh();
    }
  })();

})();
