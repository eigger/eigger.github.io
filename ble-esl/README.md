# BLE ESL browser core

HTML/레이아웃 생성 방식과 독립적인 웹용 이미지 업로더입니다. Canvas, 이미지 파일,
텍스트 편집기 등에서 **모델 크기의 RGBA ImageData**만 넘기면 됩니다.
기존 `gicisky/`와 업로더 HTML은 그대로 사용할 수 있습니다.

참조: [hass-ble-esl](https://github.com/eigger/hass-ble-esl),
커밋 `723ac0e53437f3ed324fc14ad30e89cdd1e27529`의 `esl_ble/`.
로컬 체크아웃의 구현을 기준으로 포팅했습니다. 모델 목록은 해당 소스의 실제
`devices.py`에서 가져왔습니다. 브라우저 포팅의 실기기 전송은 아직 검증하지 않았습니다.

## 파일과 로드 순서

```html
<!-- QuickLZ 모델을 사용할 때 필요 -->
<script src="gicisky/compress2.js"></script>
<script src="ble-esl/models.js"></script>
<script src="ble-esl/image.js"></script>
<script src="ble-esl/wire.js"></script>
<script src="ble-esl/bluetooth.js"></script>
<script src="ble-esl/core.js"></script>
```

전역 API는 `BleEsl`입니다. 번들러나 외부 CDN은 필요하지 않습니다.

| 파일 | 역할 |
| --- | --- |
| `models.js` | 프로토콜별 모델, 해상도, 색상, 회전·미러·인코딩 설정 |
| `image.js` | 흰 배경 알파 합성, 스캔 방향, 팔레트 변환, 비트 패킹, TFT BICUBIC |
| `wire.js` | 압축, 명령/패킷 생성, CRC·체크섬, 응답 검사 |
| `bluetooth.js` | 장치 선택, 광고 수신·파싱, GATT 전송, 타임아웃·중단 |
| `core.js` | 모델 선택 → `prepare()` → `upload()` 공통 API |

## 최소 사용 예

```js
const models = BleEsl.listModels('xte'); // 복사본
const model = BleEsl.getPreset('xte', 'psj-420');
// UI는 model.width, model.height, model.colors를 참고해서 이미지를 만든다.
const imageData = context.getImageData(0, 0, model.width, model.height);
const prepared = await BleEsl.prepare('xte', model.key, imageData);

// requestDevice는 클릭 등의 사용자 동작 안에서 직접 호출한다.
// 이미지 준비를 먼저 해 두면 클릭 안에서는 장치 선택을 바로 호출할 수 있다.
async function onUploadClick() {
  const device = await BleEsl.requestDevice('xte');
  const controller = new AbortController();
  const result = await BleEsl.upload(device, prepared, {
    signal: controller.signal,
    onProgress: ({ stage, percent }) => console.log(stage, percent),
  });
  console.log(result);
  // 중단 버튼: controller.abort()
}
```

`prepare(protocol, modelKey, imageData, options)`는 BLE에 접근하지 않습니다.
`upload(device, prepared, options)`는 연결 후 전송하고 성공·실패·중단 시 연결과
알림 구독을 정리합니다. 동일한 장치로 동시 업로드를 시도하면 거부합니다.
성공은 프로토콜별 완료 응답을 확인한 뒤에만 반환합니다. 오류는 throw합니다.
자동 재시도는 하지 않으며, PickSmart의 START 재탐색 및 같은 파트 재요청만 처리합니다.
`onProgress`의 `transfer: 100%`는 데이터 전송 단계 완료입니다. 최종 성공은
`complete` 또는 `upload()` 반환값으로 판단합니다. 콜백에서는 예외를 던지지 마세요.

| protocol | 모델 수 | 이미지/전송 |
| --- | ---: | --- |
| `picksmart` | 11 | Gicisky BW/BWR/BWRY, TFT, planes/lines/QuickLZ/2bpp, 요청 파트 재전송 |
| `wolink` | 12 | BWR/BWRY, 8 KiB raw DEFLATE 블록, AES 인증, refresh 상태 확인 |
| `xte` | 8 | Poshiji BWRY, XTEK/RLE, 블록 전송, 시작/종료 ACK |
| `easytag` | 12 | BW/BWR, column-first 디더링, RLE/raw 선택, CRC/XOR, 배터리·온도 응답 |
| `etag` | 1 | Hipoink 2.13 BWR, 펌웨어별 방향 선택, 패킷별 ACK |

입력 크기가 다르면 거부하며 리사이즈·크롭·사용자 회전·텍스트/도형/QR 생성은
호출하는 쪽에서 결정합니다. core는 모델에 필요한 스캔 회전과 패킹을 적용합니다.
투명 픽셀은 흰색 배경에 합성합니다. PickSmart는 원본과 같은 채널 임계값,
WOLINK/XTE는 가장 가까운 팔레트, easyTag는 원본과 같은 디더링을 사용합니다.
ETAG는 Pillow의 고정 팔레트 검색과 같은 4단계 RGB 양자화를 사용합니다.

### 전송 옵션과 브라우저 제약

- HTTPS 또는 localhost에서 Web Bluetooth 지원 브라우저가 필요합니다.
  `BleEsl.bluetooth.capabilities(device)`로 API 노출 여부를 확인할 수 있습니다.
  API가 있어도 OS·권한·어댑터 상태 때문에 실제 호출이 실패할 수 있습니다.
- Web Bluetooth는 실제 MAC 주소와 협상된 MTU를 제공하지 않습니다.
  `BluetoothDevice.id`는 MAC으로 사용할 수 없습니다.
- **easyTag**: `prepare(..., { mac: 'AA:BB:CC:DD:EE:FF' })`에 실제 태그 주소를
  전달해야 합니다. 외부에서 확인한 주소를 사용하세요. 없으면 전송 준비를 거부합니다.
- **XTE**: `chunkSize` 기본 20바이트. 환경에서 검증한 경우 20~244로 조정할 수 있습니다.
  `chunkGapMs`로 ATT 쓰기 사이의 간격을 조정할 수 있습니다. 광고로 확인된
  미지원 packing device number는 거부합니다. 광고가 없으면 이를 자동 확인할 수 없습니다.
- **WOLINK**: `chunkSize` 기본 200바이트 + 명령 헤더 6바이트. 브라우저가 MTU를
  노출하지 않으므로 작은 링크에서는 조정이 필요할 수 있습니다(1~506 허용).
  지원되는 `CompressionStream('deflate-raw')`가 필요하며, 미지원 브라우저에서는
  `prepare(..., { deflateRaw: async bytes => Uint8Array })`로 raw DEFLATE 구현을
  주입할 수 있습니다. Web Crypto의 AES-CBC 첫 블록으로 16바이트 ECB 인증을 계산합니다.
- **PickSmart / easyTag / ETAG**: 이미지 패킷은 각각 최대 244/204/240바이트입니다.
  이 패킷을 담을 수 있는 링크가 필요합니다. 브라우저에서 MTU를 미리 검사할 수 없고
  쓰기가 거부되면 오류를 반환합니다. 임의 분할은 프로토콜을 바꾸므로 하지 않습니다.
- **ETAG**: Device Information 서비스에서 패널 펌웨어를 읽습니다. NP61/MN50 이외는
  거부합니다. 원본 통합에서도 MN50은 실기기 검증 전입니다.
- 공통 `pacingMs`는 데이터 전송 간격, `writeTimeoutMs`는 GATT 작업 제한 시간입니다.

## 광고 데이터 수신 검토와 API

선택한 장치는 `device.watchAdvertisements()`로, 주변 스캔은
`navigator.bluetooth.requestLEScan()`으로 광고를 받을 수 있습니다. 브라우저·플래그·OS에
따라 노출되지 않을 수 있으므로 GATT 업로드와 별개로 감지해야 합니다.
Chrome 공식 스캔 예제는 실험 웹 플랫폼 기능 플래그를 요구합니다.

`requestDevice()`는 처음부터 `optionalManufacturerData: [0x5053, 0xBBAA, 0x5258]`
및 필요한 서비스 접근 권한을 요청합니다. 프로토콜을 지정하면 해당 범위로 좁힙니다.
이름 필터나 `acceptAllDevices`만으로 선택한 경우에도 제조사 데이터 접근 권한이
필요합니다. `BleEsl.bluetooth.requestOptions()`를 사용해 동일한 옵션을 받을 수 있습니다.

```js
// 클릭 이벤트에서 장치를 먼저 선택한다. 광고 수신에는 GATT 연결이 필요하지 않다.
const device = await BleEsl.requestDevice();
const bt = BleEsl.bluetooth;
if (bt.capabilities(device).watchAdvertisements) {
  const stop = await bt.watchAdvertisements(device, info => {
    console.log(info.protocol, info.modelKey, info.batteryMv, info.batteryPercent);
    console.log(info.manufacturerData, info.serviceData, info.rssi, info.raw);
    // 나중에 prepare(..., { advertisement: info })에 전달하면
    // 확인된 모델과 PickSmart 펌웨어별 인코딩을 반영한다.
  });
  // 종료: stop(); 또는 옵션 { signal }로 중단
}

// 별도 사용자 클릭에서 실험적 스캔. 지원되는 환경에서만 호출한다.
const stopScan = await bt.scanAdvertisements(info => console.log(info), {
  protocol: 'wolink', // 생략하면 다섯 프로토콜의 필터
});
// 종료: stopScan()
```

| 프로토콜 | 웹에서 파싱 가능한 광고 정보 |
| --- | --- |
| PickSmart | 제조사 `0x5053`: 모델 ID, 배터리 mV, 펌웨어, 하드웨어 |
| WOLINK | 제조사 `0xBBAA`: 제품·앱·하드웨어·디스플레이 버전, 배터리 mV; 알려진 display version만 모델 자동 선택 |
| XTE | 제조사 `0x5258`: 알려진 device number의 모델, 배터리 %, 펌웨어·하드웨어 등; 교대하는 짧은 레코드는 무시 |
| easyTag | 이름으로 프로토콜 식별. 광고 배터리·모델·MAC 자동 해석은 없음. 전송 응답에서 배터리·온도 수신 |
| ETAG | 이름으로 프로토콜/모델 식별. 배터리는 `null` |

Web Bluetooth의 광고 이벤트는 제조사 데이터, 서비스 데이터, RSSI 등의 해석된 필드만
제공하며 **전체 raw AD 패킷과 MAC 주소를 제공하지 않습니다**. ETAG 배터리는
회사 ID가 없는 `02 FF xx` 레코드라 원본 Home Assistant 구현도 raw AD를 따로
분석합니다. 이 브라우저 core에서는 수신 가능하다고 가정하거나 가짜 제조사 ID로
추측하지 않습니다. 알 수 없는 모델은 `modelKey: null`이므로 사용자가 선택해야 합니다.

수신한 `DataView`는 offset/length를 유지해 바이트 복사하므로, 이벤트 버퍼 재사용과
부분 뷰에도 안전합니다. 수신 결과의 `manufacturerData`/`serviceData`는
`Map<id, Uint8Array>`입니다. 장치의 선택과 스캔은 사용자의 동작·권한 승인이 필요합니다.
지원 감지는 실제 광고 수신이나 하드웨어 호환성을 보장하지 않습니다.

참고 문서:
[Chrome 광고 수신 예제](https://googlechrome.github.io/samples/web-bluetooth/watch-advertisements-async-await.html),
[Chrome 스캔 예제](https://googlechrome.github.io/samples/web-bluetooth/scan.html),
[Web Bluetooth 명세](https://webbluetoothcg.github.io/web-bluetooth/).

## 검증

```sh
node --test ble-esl/tests/core.test.cjs
# Pillow가 설치된 Python과 로컬 hass-ble-esl 체크아웃 필요
python3 ble-esl/tests/crosscheck.py /path/to/hass-ble-esl
```

두 번째 검증은 44개 모델의 비대칭 RGB 패턴을 Python 원본과 비교합니다.
인코딩 결과, XTE 블록, easyTag 전송 프레임을 SHA-256으로 비교하며 TFT BICUBIC,
QuickLZ, 팔레트 변환, 패딩, 회전·미러를 포함합니다. WOLINK 압축은 스트림의 바이트
동일성 대신 블록별 압축 해제 결과를 검증합니다. 첫 번째 검증은 다섯 프로토콜의
가짜 GATT 세션, 오류·중단·연결 종료, 광고 파싱·수신 수명 주기를 검증합니다.
실제 브라우저/태그에서의 전송·광고 수신 검증은 별도로 필요합니다.
