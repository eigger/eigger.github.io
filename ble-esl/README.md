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
성공은 프로토콜별 완료 응답을 확인한 뒤에만 반환합니다. 오류는 throw합니다. 명시한 모델과 광고 모델이 다르면 `Model mismatch` 오류가 나며,
광고에서 자동 선택하려면 `modelKey`를 `undefined`로 전달합니다.
`chunkSize` 범위는 연결·인증 전에 검사합니다.
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
- **XTE**: `chunkSize` 기본 20바이트. 각 ATT 쓰기 사이 기본 간격은 30ms이고 START/END 응답 제한 시간은 15초입니다. 환경에서 검증한 경우 20~244로 조정할 수 있습니다.
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
easyTag/ETAG를 지정하면 제조사 데이터 권한은 빈 목록입니다.
제조사 데이터를 읽으려면 이름 필터나 `acceptAllDevices`로 선택해도 해당 권한이 필요합니다. `BleEsl.bluetooth.requestOptions()`를 사용해 동일한 옵션을 받을 수 있습니다.

```js
// 클릭 이벤트에서 장치를 먼저 선택한다. 광고 수신에는 GATT 연결이 필요하지 않다.
const device = await BleEsl.requestDevice();
const bt = BleEsl.bluetooth;
if (bt.capabilities(device).watchAdvertisements) {
  const stop = await bt.watchAdvertisements(device, info => {
    console.log(info.protocol, info.modelKey, info.batteryMv, info.batteryPercent);
    console.log(info.manufacturerData, info.serviceData, info.rssi, info.raw);
    // 나중에 prepare(..., { advertisement: info })에 전달하면
    // 명시한 modelKey와 광고 모델이 다르면 오류. 자동 선택은 modelKey를 undefined로 전달한다.
    // 같은 모델의 PickSmart 펌웨어별 인코딩은 반영한다.
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

### 완료 알림의 식별 한계

WOLINK는 원본과 동일하게 오류 없는 `00`(idle) 또는 `FF`(refresh finished)를
refresh 이후 완료 상태로 인정합니다. 전송 중 상태는 busy라는 원본의 전제를 따릅니다.
상태 프레임에 명령 ID가 없어, 마지막 데이터 처리의 늦은 idle이 실제로 발생한다면
refresh 응답과 구분할 수 없습니다. 큐 비우기나 고정 지연만으로 해결됐다고 보장할 수
없으며, 이 부분은 실기기 로그에서 전송/refresh별 상태를 확인해야 합니다.

easyTag는 마지막 패킷을 쓰기 직전에 이전 알림을 제외하고, 마지막 쓰기 중이나 이후에
수신한 응답은 보존합니다. 전송이 끝난 뒤 큐를 비우면 정상 완료 응답까지 잃으므로
그렇게 처리하지 않습니다. 원본 응답에는 검증된 명령/요청 ID 판별 규칙이 없어,
마지막 쓰기 이후 도착하는 무관한 알림까지 확실히 구분한다고 보장하지 않습니다.

## 4.2인치 기본 업로더 화면

[웹 업로더 열기](https://eigger.github.io/BLE_ESL_42_Image_Uploader.html)

`BLE_ESL_42_Image_Uploader.html`은 `label.js`로 번호 형식을 구분하고
`uploader.js`에서 이미지 선택·미리보기·이동·확대·회전·저장·전송을 제공합니다.
Gicisky는 BWR `0x004B`, Poshiji는 BWRY `psj-420`이 기본값입니다.
‘다른 화면 크기 선택’에서 같은 제조사·팔레트의 다른 모델을 고를 수 있습니다.
크기를 바꾸면 캔버스, 편집 좌표, 저장 PNG, core 전송 모델이 함께 변경됩니다.

- Gicisky `92.95.75.10` → 기존과 동일한 `namePrefix: NEMR92957510` 필터.
- Poshiji `373917109A4F` → `name: 373917109A4F` 필터.
  실제 MAC은 `4F:9A:10:17:39:37`이지만 검색에는 라벨과 같은 광고 이름을 사용합니다.
- `requestDevice`는 클릭 안에서 바로 호출하고, 선택한 장치 이름을 다시 검사합니다.
- 번호 형식은 제조사만 식별하며 화면 크기는 증명하지 않습니다. 입력 예제와 사용자
  제공 광고 데이터의 모델 번호로 4.2인치 여부를 추측하지 않습니다.
- core에 넘기는 이미지와 미리보기는 선택한 모델 크기의 동일한 팔레트 픽셀입니다.
  실기기 업로드는 별도 검증이 필요합니다.

주소 변환과 필터 검증: `node --test ble-esl/tests/label.test.cjs`

### 색상 농도와 사진

`preview.js`가 전송 전에 팔레트 변환을 담당합니다. Gicisky는 검정·빨강,
Poshiji는 검정·빨강·노랑의 변환량을 각각 조절할 수 있습니다. 128이 기본이며
오른쪽으로 올리면 그 색을 선택할 때의 거리 점수를 낮춰 변환되는 양을 늘립니다.
태그의 실제 잉크 농도나 파형을 제어하는 옵션은 아닙니다.

기본 모드는 디더링 없는 팔레트 변환입니다. ‘부드럽게 (사진)’는 Floyd–Steinberg
오차 확산으로 중간색을 점 패턴으로 표현합니다. 농도는 양쪽 모드에 모두 적용되며,
‘색상 기본값으로’ 버튼은 세 농도를 128로 되돌립니다. 파일 종류만으로 사진 여부를
추측해 자동 전환하지 않습니다. 기존 Gicisky 업로더의 변환 모듈은 변경하지 않습니다.

크기 선택의 Poshiji 항목은 실제 모델명이 `PSJ-`로 등록된 PSJ-213, PSJ-266,
PSJ-290, PSJ-420으로 제한합니다. core catalog의 `psj-154`처럼 key만 `psj-`이고
모델명은 크기뿐인 일반 프리셋은 Poshiji 제품으로 간주하지 않습니다.

브라우저 지원 안내는 `environment.js`에서 판단합니다. 안전한 컨텍스트가 아니거나
`requestDevice`가 없거나 `getAvailability()`가 false이면 이유를 안내하고 업로드를
비활성화합니다. Chrome 이외에는 권장 안내만 표시하며 API 지원이 있으면 사용할 수
있습니다. `availabilitychanged`에 따라 상태를 갱신하고, 조회 실패만으로 미지원으로
단정하지 않습니다. 이미지 편집·저장은 업로드 지원 여부와 독립적으로 사용할 수 있습니다.

### 실기기 디버깅

XTE 브라우저 기본값은 20바이트 쓰기, ATT 쓰기 간격 30ms, START/END 응답 대기
15초입니다. write-without-response가 큐에 들어간 직후 연속 전송되는 것을 피하기 위한
보수적 설정이며, 기존 종료 응답 누락의 원인이 확인되었거나 해결되었다는 의미는
아닙니다. core의 `replyTimeoutMs`, `chunkGapMs` 옵션으로 변경할 수 있습니다.
`onTrace`는 GATT 연결·특성·구독·쓰기 오류·정리, XTE 설정·명령/응답·블록 통계를
보고합니다. 이미지 픽셀을 기록하지 않습니다.

화면의 ‘디버깅 로그’에 시각, 경과 시간, 브라우저, 입력값, chooser 필터, 실제 선택된
이름, 모델과 인코딩 설정, 전송 크기와 프로토콜 trace를 남깁니다. 로그는 복사하거나
텍스트 파일로 저장할 수 있고 처음 30줄 및 최근 기록을 포함해 2,000줄을 보관합니다.
라벨·주소·브라우저 정보는 포함되며 자동으로 외부에 전송하지 않습니다.

선택된 장치 이름은 일치 검사 전에 로그에 기록하며, 입력한 이름과 다르면 쓰기를 진행하지 않습니다.

전송 성공 이후에만 라벨 번호와 모델 크기를 localStorage에 저장합니다. 같은
브라우저·origin에서 다시 열면 마지막 성공 라벨을 불러오고, 예전에 성공한 다른
라벨을 입력하면 그 라벨의 크기를 복원합니다(최대 50개). 이미지 파일은 저장하지
않습니다. 실패한 전송은 저장하지 않으며, 저장소가 차단되면 동작은 계속하고 로그에
기록합니다. localhost 포트, 배포 도메인, 브라우저가 달라지면 별도 저장소입니다.

페이지 상단에 버전(예: `v261029-7`)을 표시하며, 디버깅 로그도 HTML의 같은 버전 값을 사용합니다.
