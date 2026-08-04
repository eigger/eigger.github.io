/**
 * Gicisky Image Uploader i18n (ko / en).
 * Language: ?lang=en|ko → localStorage → browser → ko
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'gicisky-uploader-lang';
  const SUPPORTED = ['ko', 'en'];

  const STRINGS = {
    ko: {
      title: 'Gicisky Image Uploader',
      pageTitle: '전자 라벨 (Gicisky)<br>Image Uploader',
      themeToggle: '테마 전환',
      langKo: '한국어',
      langEn: 'English',
      browserNotice: '⚠️ Chrome 브라우저가 아니면 정상 동작하지 않을 수 있습니다.',
      bleUnsupported: '해당 브라우저는 Web Bluetooth를 지원하지 않습니다.<br>Chrome 브라우저에서 시도하세요',

      step1Title: '라벨 번호와 타입 선택',
      step1Hint1: '화면 번호(예: 92.12.78.64)를 입력하면 이전에 맞춘 인치가 자동 선택됩니다.',
      step1Hint2: '처음에는 아래 크기 안내로 골라 주세요. 업로드 성공 시 번호별로 기억합니다.',
      scanBarcode: '바코드 스캔',
      scanBarcodeTitle: '바코드 인식 개선 전까지 일시 중단',
      sizeGuideSummary: '인치 구분이 어려울 때 — 모양으로 고르기',
      guideThInch: '인치',
      guideThShape: '모양',
      guideThSize: '대략 크기',
      guideThColors: '색',

      step2Title: '이미지 선택',
      step2Hint1: '갤러리에서 고르거나 카메라로 바로 촬영할 수 있습니다.',
      photoCapture: '사진 촬영',
      savePreview: '저장하기',

      step3Title: '크기 및 색상 조절',
      step3Hint1: 'PC: 드래그·휠 확대/축소 · 스마트폰: 한 손가락 드래그, 두 손가락 핀치 확대/축소',
      dither: '디더링',
      ditherOff: '없음 (임계값)',
      ditherFloyd: 'Floyd–Steinberg',
      lumThreshold: '검정 임계값:',
      redThreshold: '빨강 임계값:',
      legacy75: '7.5인치 구형 펌웨어 (0x8101) — 레거시 압축',
      resetView: '초기 위치로 되돌리기',

      step4Title: '전자라벨에 업로드',
      step4Hint1: '1단계에서 입력한 번호로 블루투스 선택창이 필터됩니다. (미입력 시 전체 표시)',
      upload: '이미지 업로드',

      scannerTitle: '바코드 스캔',
      scannerThreshold: '임계값',
      scannerReady: '카메라 준비 중...',
      scannerClose: '닫기',
      scannerPhoto: '사진 촬영',

      macFirstUse: '이 라벨은 처음 사용합니다. 아래에서 인치를 선택해 주세요.',
      macSaved: '저장된 설정: {inch}인치 ({shape}) — 틀리면 목록에서 변경하세요.',
      macRemembered: '이 라벨에 {inch}인치로 저장했습니다.',
      sizeSelected: '선택됨: {inch}인치 · {shape} · {cm} · {colors}',

      statusSelecting: '라벨 선택중...',
      statusConnecting: '연결중 : {name}',
      statusUploadStart: '이미지 업로드 시작',
      statusUploading: '이미지 업로드 중... ({current}/{total}, {pct}%)',
      statusUploadDone: '이미지 업로드 완료',
      statusError: '에러 : {error}',

      logGattRetry: 'GATT operation in progress. 재시도...',
      logTx: '송신 데이터 : {data}',
      logRx: '수신 데이터 : {data}',
      logUpload: '이미지 업로드',
      logReconnect: '새로운 이미지 전송을 위해 재연결하세요.',
      logStep3: '이미지 전송 단계 3 진행 중',
      logUploadDone: '이미지 업로드 완료',
      logUploadError: '업로드 중 오류 발생, 전송 중단!',
      logResend: '오류 발생, 마지막 부분 재전송',
      logDisconnected: '연결 해제됨.',
      logDevice: '장치: {model}{mode}',
      logTarget: '대상 라벨 : {name} (MAC {mac})',
      logReconnectTry: '재연결 시도',
      logConnecting: '연결중 : {name}',
      logServiceUuid: 'Service UUID : {uuid}',
      logUuid: 'UUID : 0x{uuid}',

      camNotAllowed: '카메라 권한이 거부되었습니다. 브라우저 설정에서 허용해 주세요.',
      camNotFound: '카메라를 찾을 수 없습니다.',
      camNotReadable: '카메라가 다른 앱에서 사용 중입니다.',
      camOverconstrained: '요청한 카메라 설정을 지원하지 않습니다.',
      alertZxingFail: '바코드 라이브러리 로드 실패. 페이지를 새로고침해 주세요.',
      alertNoCamera: '이 브라우저는 카메라를 지원하지 않습니다. HTTPS 환경의 Chrome/Edge를 사용해 주세요.',
      scannerGuide: '바코드를 가이드 안에 맞추고 임계값을 조절하세요.',
      scannerCamFail: '카메라 접근 실패: {error}',
      scannerAnalyzing: '사진 분석 중... 임계값을 조절하세요.',
      scannerNotRecognized: '바코드 미인식 — 임계값을 조절해 보세요.',
      alertBarcodeFail: '바코드 인식 실패: {error}',
      scannerOk: '인식 완료: {text}',
      scannerBadFormat: '바코드 읽음: {text} (번호 형식 아님)',

      // Device option labels & guide rows
      'device.0B': '2.1인치 — 가로형 소형 (약 6×3cm) · 흑백빨강',
      'device.33': '2.9인치 — 가로형 (약 7×3cm, 2.1보다 넓음) · 흑백빨강',
      'device.22B': '3.7인치 — 세로형 길쭉 (약 5×10cm) · 흑백빨강',
      'device.4B': '4.2인치 — 거의 정사각 (약 10×7cm) · 흑백빨강',
      'device.2B': '7.5인치 — 대형 가로 (약 16×10cm) · 흑백빨강',
      'device.8B': '10.2인치 — 초대형 (약 19×13cm) · 흑백빨강',
      'device.A0': '2.1인치 TFT — 가로형 (약 6×3cm) · 흑백만',

      'guide.0B.shape': '가로로 긴 작은 라벨',
      'guide.0B.size': '신용카드 절반 높이',
      'guide.0B.colors': '흑백빨강',
      'guide.33.shape': '가로로 긴 라벨 (2.1보다 넓음)',
      'guide.33.size': '신용카드와 비슷한 폭',
      'guide.33.colors': '흑백빨강',
      'guide.22B.shape': '세로로 긴 라벨',
      'guide.22B.size': '스마트폰 폭, 세로로 김',
      'guide.22B.colors': '흑백빨강',
      'guide.4B.shape': '넓은 직사각 (거의 정사각)',
      'guide.4B.size': '포스트잇보다 큼',
      'guide.4B.colors': '흑백빨강',
      'guide.2B.shape': '대형 가로 라벨',
      'guide.2B.size': '태블릿 1/2 정도',
      'guide.2B.colors': '흑백빨강',
      'guide.8B.shape': '초대형 가로 라벨',
      'guide.8B.size': '작은 태블릿급',
      'guide.8B.colors': '흑백빨강',
      'guide.A0.shape': '가로형 (TFT)',
      'guide.A0.size': '2.1과 비슷, 빨강 없음',
      'guide.A0.colors': '흑백만',

      'meta.0B.inch': '2.1',
      'meta.0B.shape': '가로형 소형',
      'meta.0B.cm': '약 6×3cm',
      'meta.0B.colors': '흑백빨강',
      'meta.33.inch': '2.9',
      'meta.33.shape': '가로형 (2.1보다 넓음)',
      'meta.33.cm': '약 7×3cm',
      'meta.33.colors': '흑백빨강',
      'meta.22B.inch': '3.7',
      'meta.22B.shape': '세로형 길쭉',
      'meta.22B.cm': '약 5×10cm',
      'meta.22B.colors': '흑백빨강',
      'meta.4B.inch': '4.2',
      'meta.4B.shape': '거의 정사각',
      'meta.4B.cm': '약 10×7cm',
      'meta.4B.colors': '흑백빨강',
      'meta.2B.inch': '7.5',
      'meta.2B.shape': '대형 가로',
      'meta.2B.cm': '약 16×10cm',
      'meta.2B.colors': '흑백빨강',
      'meta.8B.inch': '10.2',
      'meta.8B.shape': '초대형 가로',
      'meta.8B.cm': '약 19×13cm',
      'meta.8B.colors': '흑백빨강',
      'meta.A0.inch': '2.1 TFT',
      'meta.A0.shape': '가로형 (TFT)',
      'meta.A0.cm': '약 6×3cm',
      'meta.A0.colors': '흑백만',
    },

    en: {
      title: 'Gicisky Image Uploader',
      pageTitle: 'E-Label (Gicisky)<br>Image Uploader',
      themeToggle: 'Toggle theme',
      langKo: '한국어',
      langEn: 'English',
      browserNotice: '⚠️ May not work correctly outside Chrome.',
      bleUnsupported: 'This browser does not support Web Bluetooth.<br>Please try Chrome.',

      step1Title: 'Label number & display type',
      step1Hint1: 'Enter the on-screen number (e.g. 92.12.78.64) to recall the last size used.',
      step1Hint2: 'Pick a size from the guide below. Successful uploads are remembered per number.',
      scanBarcode: 'Scan barcode',
      scanBarcodeTitle: 'Temporarily disabled until barcode recognition improves',
      sizeGuideSummary: 'Hard to tell the size? Pick by shape',
      guideThInch: 'Size',
      guideThShape: 'Shape',
      guideThSize: 'Approx.',
      guideThColors: 'Colors',

      step2Title: 'Choose an image',
      step2Hint1: 'Pick from your gallery or take a photo.',
      photoCapture: 'Take photo',
      savePreview: 'Save preview',

      step3Title: 'Adjust size & colors',
      step3Hint1: 'Desktop: drag & scroll-wheel zoom · Phone: drag with one finger, pinch to zoom',
      dither: 'Dithering',
      ditherOff: 'Off (threshold)',
      ditherFloyd: 'Floyd–Steinberg',
      lumThreshold: 'Black threshold:',
      redThreshold: 'Red threshold:',
      legacy75: '7.5" legacy firmware (0x8101) — old compression',
      resetView: 'Reset view',

      step4Title: 'Upload to the label',
      step4Hint1: 'Bluetooth picker is filtered by the number from step 1 (shows all if empty).',
      upload: 'Upload image',

      scannerTitle: 'Barcode scan',
      scannerThreshold: 'Threshold',
      scannerReady: 'Preparing camera...',
      scannerClose: 'Close',
      scannerPhoto: 'Take photo',

      macFirstUse: 'First time for this label. Choose the inch size below.',
      macSaved: 'Saved: {inch}" ({shape}) — change in the list if wrong.',
      macRemembered: 'Saved {inch}" for this label.',
      sizeSelected: 'Selected: {inch}" · {shape} · {cm} · {colors}',

      statusSelecting: 'Selecting label...',
      statusConnecting: 'Connecting: {name}',
      statusUploadStart: 'Upload starting',
      statusUploading: 'Uploading... ({current}/{total}, {pct}%)',
      statusUploadDone: 'Upload complete',
      statusError: 'Error: {error}',

      logGattRetry: 'GATT operation in progress. Retrying...',
      logTx: 'TX: {data}',
      logRx: 'RX: {data}',
      logUpload: 'Image upload',
      logReconnect: 'Reconnect to start a new transfer.',
      logStep3: 'Image transfer step 3',
      logUploadDone: 'Upload complete',
      logUploadError: 'Upload error — aborting!',
      logResend: 'ACK mismatch — resending last part',
      logDisconnected: 'Disconnected.',
      logDevice: 'Device: {model}{mode}',
      logTarget: 'Target: {name} (MAC {mac})',
      logReconnectTry: 'Reconnecting',
      logConnecting: 'Connecting: {name}',
      logServiceUuid: 'Service UUID: {uuid}',
      logUuid: 'UUID: 0x{uuid}',

      camNotAllowed: 'Camera permission denied. Allow it in browser settings.',
      camNotFound: 'No camera found.',
      camNotReadable: 'Camera is in use by another app.',
      camOverconstrained: 'Requested camera settings are not supported.',
      alertZxingFail: 'Barcode library failed to load. Please refresh.',
      alertNoCamera: 'This browser cannot use the camera. Use Chrome/Edge over HTTPS.',
      scannerGuide: 'Align the barcode in the guide and adjust the threshold.',
      scannerCamFail: 'Camera failed: {error}',
      scannerAnalyzing: 'Analyzing photo... adjust the threshold.',
      scannerNotRecognized: 'Barcode not recognized — try adjusting the threshold.',
      alertBarcodeFail: 'Barcode recognition failed: {error}',
      scannerOk: 'Recognized: {text}',
      scannerBadFormat: 'Read: {text} (not a label number)',

      'device.0B': '2.1" — small landscape (~6×3cm) · BWR',
      'device.33': '2.9" — landscape (~7×3cm, wider than 2.1) · BWR',
      'device.22B': '3.7" — tall portrait (~5×10cm) · BWR',
      'device.4B': '4.2" — near-square (~10×7cm) · BWR',
      'device.2B': '7.5" — large landscape (~16×10cm) · BWR',
      'device.8B': '10.2" — extra-large (~19×13cm) · BWR',
      'device.A0': '2.1" TFT — landscape (~6×3cm) · BW only',

      'guide.0B.shape': 'Small wide label',
      'guide.0B.size': 'About half a credit-card height',
      'guide.0B.colors': 'BWR',
      'guide.33.shape': 'Wide label (wider than 2.1)',
      'guide.33.size': 'About credit-card width',
      'guide.33.colors': 'BWR',
      'guide.22B.shape': 'Tall portrait label',
      'guide.22B.size': 'Phone-width, tall',
      'guide.22B.colors': 'BWR',
      'guide.4B.shape': 'Wide near-square',
      'guide.4B.size': 'Larger than a sticky note',
      'guide.4B.colors': 'BWR',
      'guide.2B.shape': 'Large landscape',
      'guide.2B.size': '~half a tablet',
      'guide.2B.colors': 'BWR',
      'guide.8B.shape': 'Extra-large landscape',
      'guide.8B.size': 'Small-tablet class',
      'guide.8B.colors': 'BWR',
      'guide.A0.shape': 'Landscape (TFT)',
      'guide.A0.size': 'Like 2.1, no red',
      'guide.A0.colors': 'BW only',

      'meta.0B.inch': '2.1',
      'meta.0B.shape': 'Small landscape',
      'meta.0B.cm': '~6×3cm',
      'meta.0B.colors': 'BWR',
      'meta.33.inch': '2.9',
      'meta.33.shape': 'Landscape (wider than 2.1)',
      'meta.33.cm': '~7×3cm',
      'meta.33.colors': 'BWR',
      'meta.22B.inch': '3.7',
      'meta.22B.shape': 'Tall portrait',
      'meta.22B.cm': '~5×10cm',
      'meta.22B.colors': 'BWR',
      'meta.4B.inch': '4.2',
      'meta.4B.shape': 'Near-square',
      'meta.4B.cm': '~10×7cm',
      'meta.4B.colors': 'BWR',
      'meta.2B.inch': '7.5',
      'meta.2B.shape': 'Large landscape',
      'meta.2B.cm': '~16×10cm',
      'meta.2B.colors': 'BWR',
      'meta.8B.inch': '10.2',
      'meta.8B.shape': 'Extra-large landscape',
      'meta.8B.cm': '~19×13cm',
      'meta.8B.colors': 'BWR',
      'meta.A0.inch': '2.1 TFT',
      'meta.A0.shape': 'Landscape (TFT)',
      'meta.A0.cm': '~6×3cm',
      'meta.A0.colors': 'BW only',
    },
  };

  let currentLang = 'ko';

  function detectLang() {
    try {
      const params = new URLSearchParams(window.location.search);
      const fromQuery = (params.get('lang') || '').toLowerCase();
      if (SUPPORTED.includes(fromQuery)) return fromQuery;
      const saved = (localStorage.getItem(STORAGE_KEY) || '').toLowerCase();
      if (SUPPORTED.includes(saved)) return saved;
      const nav = (navigator.language || 'ko').toLowerCase();
      if (nav.startsWith('en')) return 'en';
      if (nav.startsWith('ko')) return 'ko';
    } catch (e) { /* ignore */ }
    return 'ko';
  }

  function t(key, vars) {
    const table = STRINGS[currentLang] || STRINGS.ko;
    let text = table[key];
    if (text == null) text = (STRINGS.ko[key] != null) ? STRINGS.ko[key] : key;
    if (vars) {
      Object.keys(vars).forEach((k) => {
        text = String(text).split('{' + k + '}').join(String(vars[k]));
      });
    }
    return text;
  }

  function deviceMeta(uiKey) {
    return {
      inch: t('meta.' + uiKey + '.inch'),
      shape: t('meta.' + uiKey + '.shape'),
      cm: t('meta.' + uiKey + '.cm'),
      colors: t('meta.' + uiKey + '.colors'),
    };
  }

  function applyDom(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const attr = el.getAttribute('data-i18n-attr');
      const html = el.hasAttribute('data-i18n-html');
      const value = t(key);
      if (attr) {
        el.setAttribute(attr, value);
      } else if (html) {
        el.innerHTML = value;
      } else {
        el.textContent = value;
      }
    });
    scope.querySelectorAll('[data-i18n-title]').forEach((el) => {
      el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
    });
    document.documentElement.lang = currentLang;
    document.title = t('title');
  }

  function setLang(lang, opts) {
    if (!SUPPORTED.includes(lang)) return;
    currentLang = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) { /* ignore */ }
    if (opts && opts.updateUrl !== false) {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('lang', lang);
        history.replaceState(null, '', url.toString());
      } catch (e) { /* ignore */ }
    }
    applyDom();
    if (typeof opts === 'function') opts(lang);
    else if (opts && typeof opts.onChange === 'function') opts.onChange(lang);
  }

  function init(onChange) {
    currentLang = detectLang();
    try {
      localStorage.setItem(STORAGE_KEY, currentLang);
    } catch (e) { /* ignore */ }
    applyDom();
    if (typeof onChange === 'function') onChange(currentLang);
    return currentLang;
  }

  global.GiciskyI18n = {
    STRINGS,
    SUPPORTED,
    STORAGE_KEY,
    t,
    deviceMeta,
    applyDom,
    setLang,
    init,
    detectLang,
    get lang() { return currentLang; },
  };
})(typeof window !== 'undefined' ? window : globalThis);
