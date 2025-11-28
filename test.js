// 何ミリ秒ごとに記録するか（例：5000 = 5秒）
const SAMPLE_INTERVAL_MS = 5000;

window.addEventListener("load", () => {
  // 保存するCSVファイル名
  let filename = "data.csv";

  // ログ（1行ずつ）を入れておく配列
  const logLines = [];

  // 計測中フラグ
  let collecting = false;

  // センサー最新値を保持する変数（対応していれば値が入る）
  let alpha = null,
    beta = null,
    gamma = null,
    absolute = null;

  let acceleration = { x: null, y: null, z: null };
  let accelerationIncludingGravity = { x: null, y: null, z: null };
  let rotationRate = { alpha: null, beta: null, gamma: null };
  let motionInterval = null;

  // 位置情報
  let latitude = null;
  let longitude = null;
  let altitude = null;

  // geolocation.watchPosition 用 ID（重複起動防止）
  let geoWatchId = null;

  // DOM 取得
  const dom = {
    result: document.getElementById("result"),
    deviceorientation: document.getElementById("deviceorientation"),
    devicemotion: document.getElementById("devicemotion"),
    geolocation: document.getElementById("geolocation"),
    startBtn: document.getElementById("startBtn"),
    stopBtn: document.getElementById("stopBtn"),
    saveCsvBtn: document.getElementById("saveCsv"),
  };

  // ==============================
  // センサーイベント登録
  // ==============================

  // デバイスの向き（対応していれば）
  if ("DeviceOrientationEvent" in window) {
    window.addEventListener("deviceorientation", (event) => {
      alpha = event.alpha;
      beta = event.beta;
      gamma = event.gamma;
      absolute = event.absolute;

      dom.deviceorientation.value = [alpha, beta, gamma, absolute]
        .map((v) => (v == null ? "" : v))
        .join(",");
    });
  } else {
    dom.deviceorientation.value = "DeviceOrientationEvent が使えません";
  }

  // 加速度・角速度（対応していれば）
  if ("DeviceMotionEvent" in window) {
    window.addEventListener("devicemotion", (event) => {
      if (event.acceleration) {
        acceleration = event.acceleration;
      }
      if (event.accelerationIncludingGravity) {
        accelerationIncludingGravity = event.accelerationIncludingGravity;
      }
      if (event.rotationRate) {
        rotationRate = event.rotationRate;
      }
      motionInterval = event.interval;

      const acc = [
        acceleration.x,
        acceleration.y,
        acceleration.z,
      ]
        .map((v) => (v == null ? "" : v))
        .join(",");
      const accG = [
        accelerationIncludingGravity.x,
        accelerationIncludingGravity.y,
        accelerationIncludingGravity.z,
      ]
        .map((v) => (v == null ? "" : v))
        .join(",");
      const rot = [
        rotationRate.alpha,
        rotationRate.beta,
        rotationRate.gamma,
      ]
        .map((v) => (v == null ? "" : v))
        .join(",");

      dom.devicemotion.value = [acc, accG, rot, motionInterval ?? ""].join(
        "\n"
      );
    });
  } else {
    dom.devicemotion.value = "DeviceMotionEvent が使えません";
  }

  // ==============================
  // ログ管理系
  // ==============================

  // ログ表示用
  function show(str) {
    dom.result.value = str + "\n" + dom.result.value;
  }

  // 最初の1回だけヘッダ行を追加
  function addHeaderIfNeeded() {
    if (logLines.length > 0) return;

    const header = [
      "time_iso",
      "type",
      // orientation
      "alpha",
      "beta",
      "gamma",
      "absolute",
      // motion
      "acc_x",
      "acc_y",
      "acc_z",
      "accG_x",
      "accG_y",
      "accG_z",
      "rot_alpha",
      "rot_beta",
      "rot_gamma",
      "motion_interval",
      // location
      "lat",
      "lng",
      "alt",
    ];
    logLines.push(header.join(","));
  }

  // 1行追加（type別）
  function logRow(type, valuesArray) {
    const now = new Date().toISOString();
    const dataStr = valuesArray.map((v) =>
      v === null || v === undefined ? "" : v
    );
    const line = [now, type, ...dataStr].join(",");
    logLines.push(line);
    show(line);
  }

  // ==============================
  // 一定間隔ごとに記録
  // ==============================
  setInterval(() => {
    if (!collecting) return;

    addHeaderIfNeeded();

    // 向き
    logRow("orientation", [alpha, beta, gamma, absolute]);

    // 加速度・角速度
    logRow("motion", [
      null, // alpha
      null, // beta
      null, // gamma
      null, // absolute
      acceleration.x,
      acceleration.y,
      acceleration.z,
      accelerationIncludingGravity.x,
      accelerationIncludingGravity.y,
      accelerationIncludingGravity.z,
      rotationRate.alpha,
      rotationRate.beta,
      rotationRate.gamma,
      motionInterval,
      null, // lat
      null, // lng
      null, // alt
    ]);

    // 位置
    logRow("location", [
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      latitude,
      longitude,
      altitude,
    ]);
  }, SAMPLE_INTERVAL_MS);

  // ==============================
  // ボタン操作
  // ==============================

  // ★ 計測開始ボタン：ここで geolocation を起動する（←重要）
  dom.startBtn.addEventListener("click", () => {
    collecting = true;
    show("=== 計測開始 ===");

    // geolocation はユーザー操作（クリック）後に開始 → 許可ダイアログが出やすい
    if (geoWatchId === null && "geolocation" in navigator) {
      geoWatchId = navigator.geolocation.watchPosition(
        (pos) => {
          const c = pos.coords;
          latitude = c.latitude;
          longitude = c.longitude;
          altitude = c.altitude;

          dom.geolocation.value = [latitude, longitude, altitude]
            .map((v) => (v == null ? "" : v))
            .join(",");
        },
        (err) => {
          dom.geolocation.value = "geolocation error: " + err.message;
        },
        {
          enableHighAccuracy: true,
          maximumAge: 1000,
          timeout: 5000,
        }
      );
    } else if (!("geolocation" in navigator)) {
      dom.geolocation.value = "Geolocation が使えません";
    }
  });

  // 計測停止ボタン
  dom.stopBtn.addEventListener("click", () => {
    collecting = false;
    show("=== 計測停止 ===");
    // geolocation 自体は止めなくてもOK（止めたい場合は下のコメントアウトを外す）
    /*
    if (geoWatchId !== null && "geolocation" in navigator) {
      navigator.geolocation.clearWatch(geoWatchId);
      geoWatchId = null;
    }
    */
  });

  // CSV保存ボタン
  dom.saveCsvBtn.addEventListener("click", () => {
    if (logLines.length === 0) {
      alert("まだデータがありません");
      return;
    }
    const csvText = logLines.join("\n");
    const blob = new Blob([csvText], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
  });
});
