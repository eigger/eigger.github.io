/** Frontend palette conversion. Color amounts bias selection, never device ink voltage. */
(function (global) {
  'use strict';
  const api = global.BleEsl = global.BleEsl || {};
  function quantize(image, { colors = 'BWR', mode = 'off', black = 128, red = 128, yellow = 128 } = {}) {
    const { width, height } = image;
    const palette = [[0,0,0],[255,255,255],[255,0,0]];
    const amounts = [black,128,red];
    if (colors === 'BWRY') { palette.push([255,255,0]); amounts.push(yellow); }
    else if (colors !== 'BWR') throw new Error('Unsupported preview palette');
    const data = new Float32Array(width * height * 3), out = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      const alpha = image.data[i * 4 + 3] / 255;
      for (let c = 0; c < 3; c++) data[i * 3 + c] = image.data[i * 4 + c] * alpha + 255 * (1 - alpha);
    }
    const biases = amounts.map(amount => (Number(amount) - 128) * 384);
    function spread(x, y, r, g, b, weight) {
      if (x < 0 || x >= width || y >= height) return;
      const index = (y * width + x) * 3;
      data[index] += r * weight; data[index + 1] += g * weight; data[index + 2] += b * weight;
    }
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      let best = 0, distance = Infinity;
      for (let p = 0; p < palette.length; p++) {
        const color = palette[p];
        const d = (data[i] - color[0]) ** 2 + (data[i+1] - color[1]) ** 2 + (data[i+2] - color[2]) ** 2 - biases[p];
        if (d < distance) { distance = d; best = p; }
      }
      const color = palette[best], dest = (y * width + x) * 4;
      out[dest] = color[0]; out[dest+1] = color[1]; out[dest+2] = color[2]; out[dest+3] = 255;
      if (mode === 'floyd') {
        const r = data[i] - color[0], g = data[i+1] - color[1], b = data[i+2] - color[2];
        spread(x+1,y,r,g,b,7/16); spread(x-1,y+1,r,g,b,3/16);
        spread(x,y+1,r,g,b,5/16); spread(x+1,y+1,r,g,b,1/16);
      }
    }
    return {width,height,data:out};
  }
  api.preview = {quantize};
})(typeof window !== 'undefined' ? window : globalThis);
