// 何ミリ秒ごとに記録するか（例：5000 = 5秒）
const SAMPLE_INTERVAL_MS = 5000;

window.addEventListener("load", () => {
  // 種類ごとに別配列でログを保持
  const logs = {
    orientation: [], // time_iso, alpha, beta, gamma, absolute
    motion: [],      // time_iso, acc_x, acc_y, acc_z, accG_x, accG_y, accG_z, rot_alpha, rot_beta, rot_gamma, motion_interval
    location: []     // time_iso, lat, lng, alt
  };

  let collecting = false;

  // センサー値（最新値を保存）
  let alpha = null, beta = null, gamma = null, absolute = null;
  let acc = { x: null, y: null, z: null };
  let accG = { x: null, y: null, z: null };
  let rot = { alpha: null, beta: null, gamma: null };
  let motionInterval = null;

  let latitude = null, longitude = null, altitude = null;
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

  // --------------------------------
  // 表示用関数
  // --------------------------------
  function show(msg) {
    dom.result.value = msg + "\n" + dom.result.value;
  }

  // --------------------------------
  // センサーイベント登録
  // --------------------------------

  // デバイスの向き（対応している場合）
  if ("DeviceOrientationEvent" in window) {
    window.addEventListener("deviceorientation", (e) => {
      alpha = e.alpha;
      beta = e.beta;
      gamma = e.gamma;
      absolute = e.absolute;

      dom.deviceorientation.value = [alpha, beta, gamma, absolute]
        .map(v => (v == null ? "" : v))
        .join(",");
    });
  } else {
    dom.deviceorientation.value = "DeviceOrientationEvent が使えません";
  }

  // 加速度・角速度（対応している場合）
  if ("DeviceMotionEvent" in window) {
    window.addEventListener("devicemotion", (e) => {
      if (e.acceleration) acc = e.acceleration;
      if (e.accelerationIncludingGravity) accG = e.accelerationIncludingGravity;
      if (e.rotationRate) rot = e.rotationRate;
      motionInterval = e.interval;

      const accStr = [acc.x, acc.y, acc.z]
        .map(v => (v == null ? "" : v))
        .join(",");
      const accGStr = [accG.x, accG.y, accG.z]
        .map(v => (v == null ? "" : v))
        .join(",");
      const rotStr = [rot.alpha, rot.beta, rot.gamma]
        .map(v => (v == null ? "" : v))
        .join(",");

      dom.devicemotion.value = [
        accStr,
        accGStr,
        rotStr,
        motionInterval ?? ""
      ].join("\n");
    });
  } else {
    dom.devicemotion.value = "DeviceMotionEvent が使えません";
  }

  // --------------------------------
  // ログ1行追加関数（種類ごと）
  // --------------------------------

  function addOrientationRow() {
    const now = new Date().toISOString();

    // ヘッダがまだなら追加
    if (logs.orientation.length === 0) {
      logs.orientation.push("time_iso,alpha,beta,gamma,absolute");
    }

    const row = [
      now,
      alpha,
      beta,
      gamma,
      absolute
    ].map(v => (v == null ? "" : v));

    logs.orientation.push(row.join(","));
    show("O: " + now);
  }

  function addMotionRow() {
    const now = new Date().toISOString();

    if (logs.motion.length === 0) {
      logs.motion.push("time_iso,acc_x,acc_y,acc_z,accG_x,accG_y,accG_z,rot_alpha,rot_beta,rot_gamma,motion_interval");
    }

    const row = [
      now,
      acc.x,
      acc.y,
      acc.z,
      accG.x,
      accG.y,
      accG.z,
      rot.alpha,
      rot.beta,
      rot.gamma,
      motionInterval
    ].map(v => (v == null ? "" : v));

    logs.motion.push(row.join(","));
    show("M: " + now);
  }

  function addLocationRow() {
    const now = new Date().toISOString();

    if (logs.location.length === 0) {
      logs.location.push("time_iso,lat,lng,alt");
    }

    const row = [
      now,
      latitude,
      longitude,
      altitude
    ].map(v => (v == null ? "" : v));

    logs.location.push(row.join(","));
    show("L: " + now);
  }

  // --------------------------------
  // 一定間隔ごとに記録
  // --------------------------------
  setInterval(() => {
    if (!collecting) return;

    // 各種センサーの最新値をそれぞれのログに追加
    addOrientationRow();
    addMotionRow();
    addLocationRow();
  }, SAMPLE_INTERVAL_MS);

  // --------------------------------
  // ボタン操作
  // --------------------------------

  // 計測開始
  dom.startBtn.addEventListener("click", () => {
    collecting = true;
    show("=== 計測開始 ===");

    // geolocation はユーザ操作後に開始（許可ダイアログを出すため）
    if (geoWatchId === null && "geolocation" in navigator) {
      geoWatchId = navigator.geolocation.watchPosition(
        (pos) => {
          const c = pos.coords;
          latitude = c.latitude;
          longitude = c.longitude;
          altitude = c.altitude;

          dom.geolocation.value = [latitude, longitude, altitude]
            .map(v => (v == null ? "" : v))
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

  // 計測停止
  dom.stopBtn.addEventListener("click", () => {
    collecting = false;
    show("=== 計測停止 ===");
    // geolocation 自体は止めなくてもよい（止めたいなら clearWatch を呼ぶ）
  });

  // CSV保存（1クリックで3ファイル）
  dom.saveCsvBtn.addEventListener("click", () => {
    // 何も記録してなければ警告
    if (
      logs.orientation.length === 0 &&
      logs.motion.length === 0 &&
      logs.location.length === 0
    ) {
      alert("まだデータがありません");
      return;
    }

    // 種類ごとにファイルをダウンロード
    downloadCsv(logs.orientation, "orientation.csv");
    downloadCsv(logs.motion, "motion.csv");
    downloadCsv(logs.location, "location.csv");
  });

  // --------------------------------
  // CSVダウンロード共通関数
  // --------------------------------
  function downloadCsv(linesArray, filename) {
    if (!linesArray || linesArray.length === 0) {
      // その種類のデータが1行も無い場合はスキップ
      return;
    }
    const csvText = linesArray.join("\n");
    const blob = new Blob([csvText], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
  }
});
