/** Browser guidance is advisory; Web Bluetooth capability decides upload availability. */
(function (global) {
  'use strict';
  const api = global.BleEsl = global.BleEsl || {};
  function inspect({ navigator: nav = {}, isSecureContext = false, availability = true } = {}) {
    if (!isSecureContext) return { canUpload: false, reason: 'insecure', message: '이 주소에서는 블루투스에 접근할 수 없어요. HTTPS 주소 또는 localhost로 열어 주세요. 이미지 편집과 저장은 사용할 수 있습니다.' };
    if (typeof nav.bluetooth?.requestDevice !== 'function') return { canUpload: false, reason: 'unsupported', message: '이 브라우저는 웹 블루투스 업로드를 지원하지 않아요. 웹 블루투스를 지원하는 기기의 Chrome에서 열어 주세요. 이미지 편집과 저장은 사용할 수 있습니다.' };
    if (!availability) return { canUpload: false, reason: 'unavailable', message: '현재 이 기기에서 블루투스를 사용할 수 없어요. 블루투스 설정과 브라우저·운영체제 권한을 확인해 주세요. 이미지 편집과 저장은 사용할 수 있습니다.' };
    const brands = nav.userAgentData?.brands;
    const chrome = brands?.length ? brands.some(b => b.brand === 'Google Chrome') : /CriOS/.test(nav.userAgent || '') || (/Chrome/.test(nav.userAgent || '') && !/Edg|OPR|SamsungBrowser/.test(nav.userAgent || ''));
    return { canUpload: true, reason: chrome ? 'supported' : 'recommended', message: chrome ? '' : 'Chrome 사용을 권장합니다. 현재 브라우저에서 연결이 잘 되지 않으면 Chrome으로 다시 열어 주세요.' };
  }
  api.environment = { inspect };
})(typeof window !== 'undefined' ? window : globalThis);
