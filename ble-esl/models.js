// Catalog from eigger/hass-ble-esl @ 723ac0e53437f3ed324fc14ad30e89cdd1e27529
(function (global) {
  'use strict';
  global.BleEsl = global.BleEsl || {};
  global.BleEsl.models = {
  "picksmart": [
    {
      "key": "0x00A0",
      "display_name": "2.1\" TFT BW",
      "width": 250,
      "height": 132,
      "colors": "BW",
      "extra": {
        "rotation": 90,
        "mirror_x": true,
        "mirror_y": false,
        "encoding": "planes",
        "resample": [
          125,
          264
        ]
      }
    },
    {
      "key": "0x000B",
      "display_name": "2.1\" EPD BWR",
      "width": 212,
      "height": 104,
      "colors": "BWR",
      "extra": {
        "rotation": 270,
        "mirror_x": true,
        "mirror_y": false,
        "encoding": "planes"
      }
    },
    {
      "key": "0x010B",
      "display_name": "2.1\" EPD BWR",
      "width": 250,
      "height": 128,
      "colors": "BWR",
      "extra": {
        "rotation": 270,
        "mirror_x": true,
        "mirror_y": false,
        "encoding": "planes"
      }
    },
    {
      "key": "0x0028",
      "display_name": "2.9\" EPD BW",
      "width": 296,
      "height": 128,
      "colors": "BW",
      "extra": {
        "rotation": 90,
        "mirror_x": false,
        "mirror_y": false,
        "encoding": "planes"
      }
    },
    {
      "key": "0x0033",
      "display_name": "2.9\" EPD BWR",
      "width": 296,
      "height": 128,
      "colors": "BWR",
      "extra": {
        "rotation": 90,
        "mirror_x": false,
        "mirror_y": false,
        "encoding": "planes"
      }
    },
    {
      "key": "0x002E",
      "display_name": "2.9\" EPD BWRY",
      "width": 296,
      "height": 128,
      "colors": "BWRY",
      "extra": {
        "rotation": 90,
        "mirror_x": false,
        "mirror_y": false,
        "encoding": "2bpp"
      }
    },
    {
      "key": "0x022B",
      "display_name": "3.7\" EPD BWR",
      "width": 240,
      "height": 416,
      "colors": "BWR",
      "extra": {
        "rotation": 180,
        "mirror_x": true,
        "mirror_y": false,
        "encoding": "lines"
      }
    },
    {
      "key": "0x004B",
      "display_name": "4.2\" EPD BWR",
      "width": 400,
      "height": 300,
      "colors": "BWR",
      "extra": {
        "rotation": 0,
        "mirror_x": false,
        "mirror_y": false,
        "encoding": "planes"
      }
    },
    {
      "key": "0x004E",
      "display_name": "4.2\" EPD BWRY",
      "width": 400,
      "height": 300,
      "colors": "BWRY",
      "extra": {
        "rotation": 0,
        "mirror_x": false,
        "mirror_y": false,
        "encoding": "2bpp"
      }
    },
    {
      "key": "0x012B",
      "display_name": "7.5\" EPD BWR",
      "width": 800,
      "height": 480,
      "colors": "BWR",
      "extra": {
        "rotation": 0,
        "mirror_x": false,
        "mirror_y": true,
        "encoding": "quicklz",
        "black_plane": true
      }
    },
    {
      "key": "0x008B",
      "display_name": "10.2\" EPD BWR",
      "width": 960,
      "height": 640,
      "colors": "BWR",
      "extra": {
        "rotation": 0,
        "mirror_x": false,
        "mirror_y": false,
        "encoding": "quicklz"
      }
    }
  ],
  "wolink": [
    {
      "key": "290",
      "display_name": "2.9\" BWRY",
      "width": 296,
      "height": 128,
      "colors": "BWRY",
      "extra": {
        "rotation": 270,
        "mirror_x": true,
        "mirror_y": false
      }
    },
    {
      "key": "290-bwr",
      "display_name": "2.9\" BWR",
      "width": 296,
      "height": 128,
      "colors": "BWR",
      "extra": {
        "rotation": 270,
        "mirror_x": false,
        "mirror_y": false,
        "display_version": 771
      }
    },
    {
      "key": "350",
      "display_name": "3.5\" BWRY",
      "width": 384,
      "height": 184,
      "colors": "BWRY",
      "extra": {
        "rotation": 270,
        "mirror_x": false,
        "mirror_y": false,
        "display_version": 513
      }
    },
    {
      "key": "750",
      "display_name": "7.5\" BWRY",
      "width": 800,
      "height": 480,
      "colors": "BWRY",
      "extra": {
        "rotation": 0,
        "mirror_x": false,
        "mirror_y": false
      }
    },
    {
      "key": "420",
      "display_name": "4.2\" BWRY",
      "width": 400,
      "height": 300,
      "colors": "BWRY",
      "extra": {
        "rotation": 0,
        "mirror_x": false,
        "mirror_y": false
      }
    },
    {
      "key": "266",
      "display_name": "2.66\" BWRY",
      "width": 296,
      "height": 152,
      "colors": "BWRY",
      "extra": {
        "rotation": 270,
        "mirror_x": true,
        "mirror_y": false
      }
    },
    {
      "key": "154",
      "display_name": "1.54\" BWRY",
      "width": 200,
      "height": 200,
      "colors": "BWRY",
      "extra": {
        "rotation": 270,
        "mirror_x": false,
        "mirror_y": false
      }
    },
    {
      "key": "213",
      "display_name": "2.13\" BWRY",
      "width": 250,
      "height": 122,
      "colors": "BWRY",
      "extra": {
        "rotation": 270,
        "mirror_x": false,
        "mirror_y": false
      }
    },
    {
      "key": "370",
      "display_name": "3.7\" BWRY",
      "width": 416,
      "height": 240,
      "colors": "BWRY",
      "extra": {
        "rotation": 270,
        "mirror_x": false,
        "mirror_y": true
      }
    },
    {
      "key": "583",
      "display_name": "5.83\" BWRY",
      "width": 648,
      "height": 480,
      "colors": "BWRY",
      "extra": {
        "rotation": 270,
        "mirror_x": false,
        "mirror_y": false
      }
    },
    {
      "key": "102",
      "display_name": "10.2\" BWR",
      "width": 960,
      "height": 640,
      "colors": "BWR",
      "extra": {
        "rotation": 270,
        "mirror_x": false,
        "mirror_y": false
      }
    },
    {
      "key": "133",
      "display_name": "13.3\" BWR",
      "width": 1600,
      "height": 1200,
      "colors": "BWR",
      "extra": {
        "rotation": 270,
        "mirror_x": false,
        "mirror_y": false
      }
    }
  ],
  "xte": [
    {
      "key": "psj-420",
      "display_name": "PSJ-420 4.2\" BWRY",
      "width": 400,
      "height": 300,
      "colors": "BWRY",
      "extra": {
        "device_number": 153
      }
    },
    {
      "key": "psj-213",
      "display_name": "PSJ-213 2.13\" BWRY",
      "width": 250,
      "height": 122,
      "colors": "BWRY",
      "extra": {
        "device_number": 140,
        "rotation": 90
      }
    },
    {
      "key": "psj-154",
      "display_name": "1.54\" BWRY",
      "width": 200,
      "height": 200,
      "colors": "BWRY",
      "extra": {}
    },
    {
      "key": "psj-266",
      "display_name": "PSJ-266 2.66\" BWRY",
      "width": 296,
      "height": 152,
      "colors": "BWRY",
      "extra": {
        "device_number": 156,
        "rotation": 270
      }
    },
    {
      "key": "psj-290",
      "display_name": "PSJ-290 2.9\" BWRY",
      "width": 296,
      "height": 128,
      "colors": "BWRY",
      "extra": {
        "device_number": 154,
        "rotation": 270
      }
    },
    {
      "key": "psj-350",
      "display_name": "3.5\" BWRY",
      "width": 384,
      "height": 184,
      "colors": "BWRY",
      "extra": {}
    },
    {
      "key": "psj-370",
      "display_name": "3.7\" BWRY",
      "width": 416,
      "height": 240,
      "colors": "BWRY",
      "extra": {}
    },
    {
      "key": "psj-750",
      "display_name": "7.5\" BWRY",
      "width": 800,
      "height": 480,
      "colors": "BWRY",
      "extra": {}
    }
  ],
  "easytag": [
    {
      "key": "33",
      "display_name": "1.54\" BWR (ET0154-33B)",
      "width": 200,
      "height": 200,
      "colors": "BWR",
      "extra": {
        "dither": true
      }
    },
    {
      "key": "36",
      "display_name": "2.13\" BWR (ETR0213-36B)",
      "width": 250,
      "height": 122,
      "colors": "BWR",
      "extra": {
        "dither": true
      }
    },
    {
      "key": "39",
      "display_name": "2.13\" BW (ETR0213-39B)",
      "width": 250,
      "height": 122,
      "colors": "BW",
      "extra": {
        "dither": true
      }
    },
    {
      "key": "3A",
      "display_name": "2.66\" BWR (ET0266-3A)",
      "width": 296,
      "height": 152,
      "colors": "BWR",
      "extra": {
        "dither": true
      }
    },
    {
      "key": "3D",
      "display_name": "2.9\" BWR (ET0290-3DB)",
      "width": 296,
      "height": 128,
      "colors": "BWR",
      "extra": {
        "dither": true
      }
    },
    {
      "key": "FF",
      "display_name": "2.9\" BWR Gen1 (ETR290-FF)",
      "width": 296,
      "height": 128,
      "colors": "BWR",
      "extra": {
        "dither": true
      }
    },
    {
      "key": "55",
      "display_name": "3.5\" BWR (ET0350-55B)",
      "width": 384,
      "height": 184,
      "colors": "BWR",
      "extra": {
        "dither": true
      }
    },
    {
      "key": "40",
      "display_name": "4.2\" BWR (ET0420-40B)",
      "width": 400,
      "height": 300,
      "colors": "BWR",
      "extra": {
        "dither": true
      }
    },
    {
      "key": "43",
      "display_name": "4.2\" BWR (ET0420-43B)",
      "width": 400,
      "height": 300,
      "colors": "BWR",
      "extra": {
        "dither": true
      }
    },
    {
      "key": "4F",
      "display_name": "5.8\" BWR (ETR0580-4FB)",
      "width": 648,
      "height": 480,
      "colors": "BWR",
      "extra": {
        "dither": true
      }
    },
    {
      "key": "44",
      "display_name": "7.5\" BWR (ET0750-44B)",
      "width": 800,
      "height": 480,
      "colors": "BWR",
      "extra": {
        "dither": true
      }
    },
    {
      "key": "64",
      "display_name": "10.2\" BWR (ET1020-64)",
      "width": 960,
      "height": 640,
      "colors": "BWR",
      "extra": {
        "dither": true
      }
    }
  ],
  "etag": [
    {
      "key": "etag213",
      "display_name": "ETAG 2.13",
      "width": 250,
      "height": 122,
      "colors": "BWR",
      "extra": {}
    }
  ]
};
})(typeof window !== 'undefined' ? window : globalThis);
