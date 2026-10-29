/** Label input for the 4.2-inch uploader. Addresses identify a family, not a panel size. */
(function (global) {
  'use strict';
  const api = global.BleEsl = global.BleEsl || {};
  function parse(text) {
    const value = String(text || '').trim().toUpperCase();
    let parts;
    const dotted = value.match(/^([0-9A-F]{1,2})\.([0-9A-F]{1,2})\.([0-9A-F]{1,2})\.([0-9A-F]{1,2})$/);
    const short = value.match(/^(?:NEMR)?([0-9A-F]{8})$/);
    const full = value.match(/^FF:FF:([0-9A-F]{2}):([0-9A-F]{2}):([0-9A-F]{2}):([0-9A-F]{2})$/);
    if (dotted || full) parts = (dotted || full).slice(1).map(p => p.padStart(2, '0'));
    else if (short) parts = short[1].match(/../g);
    if (parts) return { protocol: 'picksmart', brand: 'Gicisky', key: '0x004B',
      label: parts.join('.'), name: 'NEMR' + parts.join(''), mac: 'FF:FF:' + parts.join(':') };
    if (/^[0-9A-F]{12}$/.test(value)) return { protocol: 'xte', brand: 'Poshiji', key: 'psj-420',
      label: value, name: value, mac: value.match(/../g).reverse().join(':') };
    return null;
  }
  function requestOptions(target) {
    if (!target || !['picksmart', 'xte'].includes(target.protocol)) throw new Error('Enter a valid label number');
    const options = api.bluetooth.requestOptions(target.protocol);
    // Same NEMR prefix filter as the existing uploader. Poshiji advertises the printed label verbatim.
    options.filters = target.protocol === 'picksmart' ? [{ namePrefix: target.name }] : [{ name: target.name }];
    return options;
  }
  function matches(target, device) {
    const name = (device?.name || '').toUpperCase();
    return target.protocol === 'picksmart' ? name.startsWith(target.name) : name === target.name;
  }
  function modelsFor(protocol) {
    return api.listModels(protocol).filter(model => protocol === 'xte' ?
      /^PSJ-/.test(model.display_name) && model.colors === 'BWRY' :
      protocol === 'picksmart' && model.colors === 'BWR');
  }
  api.label = { parse, requestOptions, matches, modelsFor };
})(typeof window !== 'undefined' ? window : globalThis);
