/* imagespec-editor/schema.js — editor element defaults/meta (SSOT for UI).
 * Types must stay in sync with imagespec known_types (see schema/elements.json).
 */
window.ImagespecEditorSchema = {
  ELEMENT_DEFAULTS: {
  text: { x: 10, y: 10, value: 'Text', size: 20, color: 'black', font: '', anchor: 'lt', align: 'left', spacing: 5, stroke_width: 0, stroke_fill: 'white', max_width: 0, y_padding: 10, visible: true },
  multiline: { x: 10, value: 'Line1;Line2', delimiter: ';', offset_y: 25, start_y: 10, size: 20, font: '', color: 'black', anchor: 'lm', stroke_width: 0, stroke_fill: 'white', y_padding: 10, visible: true },
  new_multiline: { x: 10, y: 10, value: 'Line1\nLine2', size: 20, font: '', color: 'black', anchor: 'la', spacing: 20, align: 'left', stroke_width: 0, stroke_fill: '', fit_width: false, fit_height: false, width: 200, height: 60, visible: true },
  text_fit: { x: 10, y: 10, width: 200, height: 40, value: 'Fits in box', size: 20, min_size: 8, fit: 'shrink', color: 'black', visible: true },
  line: { x_start: 10, x_end: 200, y_start: 64, y_end: 64, fill: 'black', width: 1, dash: '', y_padding: 0, visible: true },
  rectangle: { x_start: 10, y_start: 10, x_end: 100, y_end: 60, fill: '', outline: 'black', width: 1, radius: 0, corners: '', visible: true },
  rectangle_pattern: { x_start: 10, y_start: 10, x_size: 20, y_size: 20, x_repeat: 3, y_repeat: 2, x_offset: 5, y_offset: 5, fill: '', outline: 'black', width: 1, radius: 0, corners: '', visible: true },
  circle: { x: 60, y: 60, radius: 30, fill: '', outline: 'black', width: 1, visible: true },
  ellipse: { x_start: 10, y_start: 10, x_end: 100, y_end: 60, fill: '', outline: 'black', width: 1, visible: true },
  icon: { x: 10, y: 10, value: 'mdi:home', size: 32, color: 'black', anchor: 'la', stroke_width: 0, stroke_fill: 'white', visible: true },
  dlimg: { x: 10, y: 10, url: '', xsize: 80, ysize: 80, mode: 'stretch', rotate: 0, visible: true },
  qrcode: { x: 10, y: 10, data: 'https://example.com', width: 80, height: 80, eclevel: 'h', color: 'black', bgcolor: 'white', border: 1, boxsize: 2, visible: true },
  barcode: { x: 10, y: 10, data: '1234567890', code: 'code128', width: 160, height: 40, color: 'black', bgcolor: 'white', write_text: false, module_width: 0.2, module_height: 7, quiet_zone: 6.5, font_size: 5, text_distance: 5.0, visible: true },
  progress_bar: { x_start: 10, y_start: 90, x_end: 200, y_end: 110, progress: 75, direction: 'right', background: 'white', fill: 'red', outline: 'black', width: 1, radius: 0, show_percentage: false, visible: true },
  battery: { x: 10, y: 10, width: 34, height: 16, level: 72, fill: 'black', background: 'white', outline: 'black', low_threshold: 20, low_color: 'red', show_percentage: false, visible: true },
  gauge: { x: 60, y: 60, radius: 28, progress: 65, fill: 'red', outline: 'black', width: 6, visible: true },
  pie: { x: 120, y: 60, radius: 40, values: 'A,40,red;B,35,black;C,25,blue', inner_radius: 0, visible: true },
  sparkline: { x: 10, y: 80, width: 180, height: 40, values: '1,3,2,5,4,6,3,7', color: 'black', fill: 'red', dot_last: true, visible: true },
  row: { x: 8, y: 8, gap: 8, class: 'gap-2 items-center', width: 200, height: 36, _children: [{ type: 'icon', props: { value: 'mdi:home', size: 18, color: 'black' } }, { type: 'text', props: { value: 'Label', size: 16, color: 'black' } }], visible: true },
  column: { x: 8, y: 8, gap: 4, class: 'gap-1', width: 160, height: 80, _children: [{ type: 'text', props: { value: 'Line 1', size: 16, color: 'black' } }, { type: 'text', props: { value: 'Line 2', size: 16, color: 'black' } }], visible: true },
  diagram: { x: 10, y: 10, width: 200, height: 100, margin: 20, font: '', bars_values: 'A,10;B,20;C,15', bars_color: 'black', bars_margin: 10, bars_legend_size: 10, bars_legend_color: 'black', visible: true },
  plot: { data_entity: 'sensor.temperature', data_color: 'black', data_width: 2, duration: 86400, x_start: 10, y_start: 10, x_end: 200, y_end: 100, size: 10, font: '', low: '', high: '', debug: false, visible: true }
},
  REQUIRED: {
  text: ['x', 'value'], multiline: ['x', 'value', 'offset_y'], new_multiline: ['x', 'y', 'value'], text_fit: ['x', 'y', 'width', 'height', 'value'],
  line: ['x_start', 'x_end'], rectangle: ['x_start', 'x_end', 'y_start', 'y_end'],
  rectangle_pattern: ['x_start', 'y_start', 'x_size', 'y_size', 'x_repeat', 'y_repeat', 'x_offset', 'y_offset'],
  circle: ['x', 'y', 'radius'], ellipse: ['x_start', 'x_end', 'y_start', 'y_end'],
  icon: ['x', 'y', 'value', 'size'], dlimg: ['x', 'y', 'url', 'xsize', 'ysize'],
  qrcode: ['x', 'y', 'data'], barcode: ['x', 'y', 'data'],
  progress_bar: ['x_start', 'x_end', 'y_start', 'y_end', 'progress'],
  battery: ['x', 'y', 'width', 'height', 'level'], gauge: ['x', 'y', 'radius', 'progress'],
  pie: ['x', 'y', 'radius', 'values'], sparkline: ['x', 'y', 'width', 'height', 'values'],
  row: ['_children'], column: ['_children'],
  diagram: ['x', 'y', 'height'], plot: ['data_entity']
},
  FIELD_META: {
  x: { t: 'num' }, y: { t: 'num' }, value: { t: 'str' }, values: { t: 'str' }, size: { t: 'num' }, color: { t: 'color_sel' }, font: { t: 'str' },
  anchor: { t: 'sel', opts: ['lt', 'mt', 'rt', 'lm', 'mm', 'rm', 'lb', 'mb', 'rb', 'la'] },
  align: { t: 'sel', opts: ['left', 'center', 'right'] }, spacing: { t: 'num' }, stroke_width: { t: 'num' },
  stroke_fill: { t: 'color_sel' }, max_width: { t: 'num' }, y_padding: { t: 'num' }, visible: { t: 'bool' },
  delimiter: { t: 'str' }, offset_y: { t: 'num' }, start_y: { t: 'num' },
  min_size: { t: 'num' }, fit: { t: 'sel', opts: ['shrink', 'ellipsis', 'shrink_ellipsis'] },
  x_start: { t: 'num' }, x_end: { t: 'num' }, y_start: { t: 'num' }, y_end: { t: 'num' },
  fill: { t: 'color_sel' }, outline: { t: 'color_sel' }, width: { t: 'num' }, radius: { t: 'num' }, corners: { t: 'str' }, dash: { t: 'str' },
  x_size: { t: 'num' }, y_size: { t: 'num' }, x_repeat: { t: 'num' }, y_repeat: { t: 'num' }, x_offset: { t: 'num' }, y_offset: { t: 'num' },
  url: { t: 'str' }, xsize: { t: 'num' }, ysize: { t: 'num' }, mode: { t: 'sel', opts: ['stretch', 'fit', 'fill', 'contain'] }, rotate: { t: 'num' },
  data: { t: 'str' }, bgcolor: { t: 'color_sel' }, border: { t: 'num' }, boxsize: { t: 'num' }, eclevel: { t: 'sel', opts: ['l', 'm', 'q', 'h'] },
  code: { t: 'sel', opts: ['code128', 'ean13', 'ean8', 'upc', 'isbn13'] },
  module_width: { t: 'num' }, module_height: { t: 'num' }, quiet_zone: { t: 'num' }, font_size: { t: 'num' },
  text_distance: { t: 'num' }, write_text: { t: 'bool' },
  progress: { t: 'num' }, direction: { t: 'sel', opts: ['right', 'left', 'up', 'down'] },
  background: { t: 'color_sel' }, show_percentage: { t: 'bool' },
  level: { t: 'num' }, low_threshold: { t: 'num' }, low_color: { t: 'color_sel' },
  inner_radius: { t: 'num' }, dot_last: { t: 'bool' },
  gap: { t: 'num' }, class: { t: 'str' },
  height: { t: 'num' }, margin: { t: 'num' },
  bars_values: { t: 'str' }, bars_color: { t: 'color_sel' }, bars_margin: { t: 'num' }, bars_legend_size: { t: 'num' }, bars_legend_color: { t: 'color_sel' },
  data_entity: { t: 'str' }, data_color: { t: 'color_sel' }, data_width: { t: 'num' },
  duration: { t: 'num' }, low: { t: 'str' }, high: { t: 'str' }, debug: { t: 'bool' },
  fit_width: { t: 'bool' }, fit_height: { t: 'bool' }
},
};

window.ImagespecEditorSchema.knownTypes = Object.keys(window.ImagespecEditorSchema.ELEMENT_DEFAULTS);

// Runtime soft-check against committed elements.json (copied from imagespec schema/).
(function softCheckElementsJson() {
  if (typeof fetch !== 'function') return;
  const base = document.currentScript && document.currentScript.src
    ? document.currentScript.src.replace(/[^/]+$/, '')
    : 'imagespec-editor/';
  fetch(base + 'elements.json')
    .then(r => (r.ok ? r.json() : null))
    .then(doc => {
      if (!doc || !Array.isArray(doc.types)) return;
      const known = new Set(doc.types);
      const unknown = window.ImagespecEditorSchema.knownTypes.filter(t => !known.has(t));
      if (unknown.length) {
        console.warn('[imagespec-editor] schema.js types missing from elements.json:', unknown);
      }
    })
    .catch(() => { /* offline / file:// — ignore */ });
})();
