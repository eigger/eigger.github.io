/** Label selects family/palette; 4.2-inch default with explicit model overrides. */
(function () {
  'use strict';
  const VERSION = document.documentElement.dataset.version;
  const $ = id => document.getElementById(id), api = window.BleEsl;
  const canvas = $('preview'), context = canvas.getContext('2d', { willReadFrequently: true });
  const sourceCanvas = document.createElement('canvas'); sourceCanvas.width = 400; sourceCanvas.height = 300;
  const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true });
  const state = { target: null, modelKey: null, width: 400, height: 300, image: null, angle: 0, baseScale: 1, zoom: 1, x: 200, y: 150,
    quantized: null, loading: false, busy: false, controller: null, renderFrame: 0, imageLoad: 0 };
  let bluetoothAvailable = false;
  let availability = true;
  function status(message, kind = '') { $('status').textContent = message; $('status').className = 'status ' + kind; }
  const logLines = []; let omittedLogs = 0; let logStart = performance.now();
  function log(message) {
    const line = `[${new Date().toISOString()} +${((performance.now()-logStart)/1000).toFixed(3)}s] ${message}`;
    logLines.push(line);
    if (logLines.length > 2000) { logLines.splice(30, 1); omittedLogs++; }
    $('log').textContent = logLines.join('\n') + (omittedLogs ? `\n(${omittedLogs} middle entries omitted)` : '');
    console.debug('[BLE ESL]', line);
  }
  $('copyLog').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('log').textContent); log('로그를 복사했습니다.'); }
    catch { log('클립보드 복사가 지원되지 않습니다. 로그 파일 저장을 사용해 주세요.'); }
  });
  $('saveLog').addEventListener('click', () => {
    const url=URL.createObjectURL(new Blob([$('log').textContent],{type:'text/plain;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download=`ble-esl-${new Date().toISOString().replace(/[:.]/g,'-')}.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  function updateButtons() {
    const ready = !state.loading && !!state.target && !!state.image && !!state.quantized;
    $('upload').disabled = state.busy || !ready || !bluetoothAvailable;
    $('download').disabled = state.busy || !state.quantized;
    $('cancel').hidden = !state.busy;
    for (const id of ['labelInput','imageInput','zoom','fit','fill','rotate','dither','blackAmount','redAmount','yellowAmount','resetColors']) $(id).disabled = state.busy;
    $('modelSelect').disabled = state.busy || !state.target;
    $('readyHint').textContent = state.busy ? '전송 중에는 태그를 가까이에 두고 이 화면을 열어 두세요.' :
      !bluetoothAvailable ? '현재 환경에서는 업로드할 수 없어요. 위의 브라우저 안내를 확인해 주세요.' : state.loading ? '이미지를 여는 중이에요.' : !state.target ? '라벨 번호를 입력하면 태그 종류가 자동 선택됩니다.' : !state.image ? '업로드할 이미지를 선택해 주세요.' :
      `${state.target.brand} ${activeModel().display_name}에 올릴 준비가 됐어요.`;
  }
  function activeModel() {
    return state.target ? api.getPreset(state.target.protocol, state.modelKey || state.target.key) : null;
  }
  function applyModel() {
    const model = activeModel();
    if (model) {
      state.width = model.width; state.height = model.height;
      canvas.width = sourceCanvas.width = model.width;
      canvas.height = sourceCanvas.height = model.height;
      canvas.style.aspectRatio = `${model.width} / ${model.height}`;
      $('tagName').textContent = `${state.target.brand} · ${model.display_name}`;
      $('resolutionText').textContent = `${model.width} × ${model.height}`;
    }
    fit();
  }
  function targetChanged() {
    const oldProtocol = state.target?.protocol, oldLabel = state.target?.label;
    state.target = api.label.parse($('labelInput').value);
    const target = state.target;
    if (oldProtocol !== target?.protocol || oldLabel !== target?.label) {
      state.modelKey = (target && api.memory.modelFor(target)) || target?.key || null;
      $('modelSelect').replaceChildren();
      if (target) {
        for (const model of api.label.modelsFor(target.protocol)) {
          const option = document.createElement('option'); option.value = model.key;
          option.textContent = `${model.display_name} · ${model.width} × ${model.height}${model.key === target.key ? ' (기본)' : ''}`;
          $('modelSelect').append(option);
        }
        $('modelSelect').value = state.modelKey;
      } else { const option = document.createElement('option'); option.textContent = '라벨 번호를 먼저 입력하세요'; $('modelSelect').append(option); }
    }
    $('labelResult').classList.toggle('valid', !!target);
    $('tagName').textContent = target ? `${target.brand} · ${activeModel().display_name}` : $('labelInput').value.trim() ? '번호 형식을 확인해 주세요' : '번호를 입력하면 태그 종류를 찾아드려요';
    $('tagDetails').textContent = target ? `${target.protocol === 'xte' ? '4색 (흰색 · 검정 · 빨강 · 노랑)' : '3색 (흰색 · 검정 · 빨강)'} · ${target.name}` : 'Gicisky: 92.95.75.10 / Poshiji: 373917109A4F';
    $('targetName').textContent = target?.name || '입력한 번호의 장치';
    $('paletteText').textContent = target?.protocol === 'xte' ? 'Poshiji · 흰색 / 검정 / 빨강 / 노랑' : 'Gicisky · 흰색 / 검정 / 빨강';
    $('yellowWrap').hidden = target?.protocol !== 'xte';
    $('labelInput').setAttribute('aria-invalid', String(!!$('labelInput').value.trim() && !target));
    $('progressWrap').hidden = true; status('');
    if (oldProtocol !== target?.protocol || oldLabel !== target?.label) applyModel(); else render();
  }
  $('modelSelect').addEventListener('change', () => {
    state.modelKey = $('modelSelect').value; status(''); $('progressWrap').hidden = true; applyModel();
  });
  function dimensions() {
    if (!state.image) return [state.width, state.height];
    return state.angle % 180 ? [state.image.naturalHeight, state.image.naturalWidth] : [state.image.naturalWidth, state.image.naturalHeight];
  }
  function fit(fill = false) {
    const [w, h] = dimensions();
    state.baseScale = (fill ? Math.max : Math.min)(state.width / w, state.height / h);
    state.zoom = 1; state.x = state.width / 2; state.y = state.height / 2;
    $('zoom').value = '100'; render();
  }
  function render() {
    sourceContext.fillStyle = '#fff'; sourceContext.fillRect(0, 0, state.width, state.height);
    $('emptyPreview').hidden = !!state.image;
    $('zoomValue').textContent = `${Math.round(state.zoom * 100)}%`;
    if (!state.image) {
      context.fillStyle = '#fff'; context.fillRect(0, 0, state.width, state.height); state.quantized = null; updateButtons(); return;
    }
    sourceContext.save(); sourceContext.translate(state.x, state.y);
    sourceContext.rotate(state.angle * Math.PI / 180);
    sourceContext.scale(state.baseScale * state.zoom, state.baseScale * state.zoom);
    sourceContext.drawImage(state.image, -state.image.naturalWidth / 2, -state.image.naturalHeight / 2);
    sourceContext.restore();
    const data = sourceContext.getImageData(0, 0, state.width, state.height);
    const converted = api.preview.quantize(data, {
      colors: state.target?.protocol === 'xte' ? 'BWRY' : 'BWR', mode: $('dither').value,
      black: Number($('blackAmount').value), red: Number($('redAmount').value), yellow: Number($('yellowAmount').value),
    });
    state.quantized = new ImageData(converted.data, converted.width, converted.height);
    context.putImageData(state.quantized, 0, 0); updateButtons();
  }
  function scheduleRender() {
    if (state.renderFrame) return;
    state.renderFrame = requestAnimationFrame(() => { state.renderFrame = 0; render(); });
  }
  $('labelInput').addEventListener('input', targetChanged);
  $('imageInput').addEventListener('change', async event => {
    const file = event.target.files[0]; if (!file) return;
    const version = ++state.imageLoad, url = URL.createObjectURL(file), image = new Image();
    state.loading = true; updateButtons();
    $('fileName').textContent = '이미지를 여는 중…';
    try {
      image.src = url; await image.decode();
      if (version !== state.imageLoad) return;
      if (!image.naturalWidth || !image.naturalHeight) throw new Error('Empty image');
      state.image = image; state.angle = 0; $('fileName').textContent = file.name;
      status(''); $('progressWrap').hidden = true; fit();
    } catch {
      if (version === state.imageLoad) { $('fileName').textContent = state.image ? '이전 이미지를 유지합니다' : '선택한 이미지 없음'; status('이미지를 열 수 없어요. JPG, PNG 또는 WebP 파일을 선택해 주세요.', 'error'); }
    } finally { URL.revokeObjectURL(url); if (version === state.imageLoad) { state.loading = false; updateButtons(); } }
  });
  $('fit').addEventListener('click', () => fit());
  $('fill').addEventListener('click', () => fit(true));
  $('rotate').addEventListener('click', () => { state.angle = (state.angle + 90) % 360; fit(); });
  $('zoom').addEventListener('input', () => { state.zoom = Number($('zoom').value) / 100; scheduleRender(); });
  for (const id of ['dither', 'blackAmount', 'redAmount', 'yellowAmount']) $(id).addEventListener('input', () => { updateAmounts(); scheduleRender(); });
  function updateAmounts() { for (const color of ['black','red','yellow']) $(color + 'Value').value = $(color + 'Amount').value; }
  $('resetColors').addEventListener('click', () => { for (const color of ['black','red','yellow']) $(color + 'Amount').value = '128'; updateAmounts(); render(); });
  function zoomTo(value) {
    state.zoom = Math.max(.25, Math.min(4, value)); $('zoom').value = String(Math.round(state.zoom * 100)); scheduleRender();
  }
  canvas.addEventListener('wheel', event => {
    if (!state.image || state.busy) return;
    event.preventDefault(); zoomTo(state.zoom * Math.exp(-event.deltaY * .001));
  }, { passive: false });
  const pointers = new Map(); let gesture = null;
  function position(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * state.width / rect.width, y: (event.clientY - rect.top) * state.height / rect.height };
  }
  function resetGesture() {
    const points = [...pointers.values()];
    gesture = points.length > 1 ? { distance: Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y), zoom: state.zoom } : null;
  }
  canvas.addEventListener('pointerdown', event => {
    if (!state.image || state.busy) return;
    canvas.setPointerCapture(event.pointerId); pointers.set(event.pointerId, position(event)); canvas.classList.add('dragging'); resetGesture();
  });
  canvas.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId) || state.busy) return;
    const point = position(event), previous = pointers.get(event.pointerId); pointers.set(event.pointerId, point);
    if (pointers.size === 1) { state.x += point.x - previous.x; state.y += point.y - previous.y; scheduleRender(); }
    else if (gesture?.distance > 0) {
      const [a, b] = [...pointers.values()]; zoomTo(gesture.zoom * Math.hypot(a.x - b.x, a.y - b.y) / gesture.distance);
    }
  });
  for (const type of ['pointerup','pointercancel','lostpointercapture']) canvas.addEventListener(type, event => { pointers.delete(event.pointerId); resetGesture(); if (!pointers.size) canvas.classList.remove('dragging'); });
  $('download').addEventListener('click', () => {
    if (!state.quantized) return;
    const a = document.createElement('a'); a.download = `${state.target?.brand || 'ESL'}-${state.width}x${state.height}-preview.png`; a.href = canvas.toDataURL('image/png'); a.click();
  });
  $('cancel').addEventListener('click', () => state.controller?.abort());
  function explain(error) {
    if (error.name === 'AbortError') return '업로드를 중단했어요. 다시 시도할 수 있습니다.';
    if (error.message.startsWith('Selected device name')) return '선택한 태그 이름이 입력한 번호와 달라 전송하지 않았어요. 디버깅 로그의 선택된 이름을 확인해 주세요.';
    if (error.message.includes('XTE END reply')) return '이미지는 보냈지만 태그의 완료 응답을 받지 못했어요. 전송 중 일부 데이터가 누락됐을 수 있습니다. 태그를 가까이 두고 다른 앱의 연결을 끊은 뒤 다시 시도해 주세요.';
    if (error.name === 'NotFoundError') return '장치 선택을 취소했거나 태그를 찾지 못했어요. 번호와 태그 전원을 확인한 뒤 다시 눌러 주세요.';
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') return '블루투스 접근을 허용해 주세요. Chrome의 사이트 권한과 기기의 블루투스 설정을 확인해 주세요.';
    if (error.message.includes('Model mismatch')) return '광고에서 다른 모델이 확인됐어요. 선택한 화면 크기와 태그 번호를 확인해 주세요.';
    return '업로드를 완료하지 못했어요. 태그를 가까이 두고 다른 앱의 연결을 끊은 뒤 다시 시도해 주세요.';
  }
  $('upload').addEventListener('click', () => upload());
  async function upload() {
    if (state.busy || state.loading || !state.target || !state.quantized) return;
    // Render synchronously to include any slider/pointer update waiting for requestAnimationFrame.
    render();
    const target = { ...state.target, key: state.modelKey }, image = new ImageData(new Uint8ClampedArray(state.quantized.data), state.width, state.height);
    state.busy = true; state.controller = new AbortController(); updateButtons();
    logLines.length = 0; omittedLogs = 0; logStart = performance.now();
    $('log').textContent = ''; $('progressWrap').hidden = false; $('progress').removeAttribute('value');
    $('progressLabel').textContent = '장치 선택창에서 연결할 태그를 선택해 주세요.'; status('');
    log(`UI version: ${VERSION}`);
    log(`Browser: ${navigator.userAgent}; secure=${window.isSecureContext}; Bluetooth available=${availability}`);
    log(`Origin: ${location.origin}; label=${$('labelInput').value.trim()}`);
    log(`${target.brand} ${state.width}×${state.height} · ${target.name} · MAC ${target.mac}`);
    log(`Model: ${target.key}; scan=${JSON.stringify(activeModel().extra)}; dither=${$('dither').value}; amounts=${$('blackAmount').value}/${$('redAmount').value}/${$('yellowAmount').value}`);
    let device;
    try {
      // Must call directly during this click, before the first asynchronous preparation.
      const chooser = api.label.requestOptions(target);
      log(`requestDevice: ${JSON.stringify(chooser)}`);
      $('logDetails').open = true;
      device = await navigator.bluetooth.requestDevice(chooser);
      if (state.controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      log(`선택: ${device.name || '(이름 없음)'}`);
      if (!api.label.matches(target, device)) throw new Error(`Selected device name '${device.name}' does not match '${target.name}'`);
      const prepared = await api.prepare(target.protocol, target.key, image);
      log(`Prepared payload: ${prepared.payload.length} bytes; input=${image.width}×${image.height}`);
      let lastStage = '';
      const result = await api.upload(device, prepared, {
        signal: state.controller.signal,
        onTrace: event => log(`TRACE ${JSON.stringify(event)}`),
        onProgress: ({ stage, current, total, percent }) => {
          if (stage !== lastStage) { log(stage); lastStage = stage; }
          const messages = { connect: '태그에 연결하고 있어요.', handshake: '태그를 준비하고 있어요.', transfer: `이미지를 보내고 있어요. ${percent}%`, finish: '태그의 완료 응답을 기다리고 있어요.', complete: '이미지 전송 완료' };
          $('progressLabel').textContent = messages[stage] || stage;
          if (stage === 'transfer' || stage === 'complete') $('progress').value = percent;
          else $('progress').removeAttribute('value');
        },
      });
      if (result.success) {
        const remembered=api.memory.remember(target,target.key);
        log(remembered?'성공한 라벨 번호와 크기를 저장했습니다.':'브라우저 저장소를 사용할 수 없어 번호를 저장하지 못했습니다.');
        status('이미지를 보냈어요! 태그 화면이 바뀔 때까지 잠시 기다려 주세요.', 'success');
      }
    } catch (error) {
      status(explain(error), error.name === 'AbortError' ? '' : 'error'); log(`${error.name}: ${error.message}`);
      if (error.stack) log(error.stack); $('logDetails').open = true;
      $('progressWrap').hidden = true;
    } finally {
      if (device?.gatt?.connected) device.gatt.disconnect();
      state.busy = false; state.controller = null; updateButtons();
    }
  }
  function updateSupport() {
    const support = api.environment.inspect({ navigator, isSecureContext: window.isSecureContext, availability });
    bluetoothAvailable = support.canUpload;
    $('supportNotice').hidden = !support.message;
    $('supportNotice').textContent = support.message;
    updateButtons();
  }
  updateSupport();
  const availabilityChanged = event => { availability = event.value; updateSupport(); };
  navigator.bluetooth?.addEventListener?.('availabilitychanged', availabilityChanged);
  if (navigator.bluetooth?.getAvailability) {
    navigator.bluetooth.getAvailability().then(value => { availability = value; updateSupport(); }).catch(() => {
      // A failed availability query does not prove lack of GATT support.
    });
  }
  window.addEventListener('pagehide', () => state.controller?.abort());
  const previous=api.memory.last();
  if(previous) $('labelInput').value=previous.target.label;
  targetChanged();
  if(previous) status('지난번 전송에 성공한 라벨 번호와 화면 크기를 불러왔어요.');
})();
