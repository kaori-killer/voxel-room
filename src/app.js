/* ==========================================================================
   복셀 방 — 그림을 복셀 오브제로 깎아 보관함에 넣고, 내 방에 꺼내 꾸민다
   ========================================================================== */
(function () {
  'use strict';

  var T = window.THREE;
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var STORE_KEY = 'voxel-room.v1';

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function fmt(n) { return n.toLocaleString('ko-KR'); }
  function uid() { return Math.random().toString(36).slice(2, 10); }

  function isDark() {
    var s = document.documentElement.getAttribute('data-theme');
    if (s === 'dark') return true;
    if (s === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  /* ================================================================
     1. 이미지 → 복셀
     ================================================================ */

  function sampleImage(img, gw, gh) {
    var src = img, cw = img.width, ch = img.height;
    while (cw * 0.5 > gw && ch * 0.5 > gh) {
      cw = Math.max(gw, Math.round(cw / 2));
      ch = Math.max(gh, Math.round(ch / 2));
      var t = document.createElement('canvas');
      t.width = cw; t.height = ch;
      var tc = t.getContext('2d');
      tc.imageSmoothingEnabled = true;
      tc.imageSmoothingQuality = 'high';
      tc.clearRect(0, 0, cw, ch);
      tc.drawImage(src, 0, 0, cw, ch);
      src = t;
    }
    var c = document.createElement('canvas');
    c.width = gw; c.height = gh;
    var cx = c.getContext('2d', { willReadFrequently: true });
    cx.imageSmoothingEnabled = true;
    cx.imageSmoothingQuality = 'high';
    cx.clearRect(0, 0, gw, gh);
    cx.drawImage(src, 0, 0, gw, gh);
    return cx.getImageData(0, 0, gw, gh);
  }

  function colorDist(d, i, r, g, b) {
    var dr = d[i] - r, dg = d[i + 1] - g, db = d[i + 2] - b;
    return Math.sqrt(dr * dr + dg * dg + db * db);
  }

  function maskByFlood(d, gw, gh, tol) {
    var n = gw * gh, filled = new Uint8Array(n);
    filled.fill(1);
    var corners = [0, (gw - 1) * 4, (n - gw) * 4, (n - 1) * 4];
    var sr = 0, sg = 0, sb = 0, k;
    for (k = 0; k < 4; k++) { sr += d[corners[k]]; sg += d[corners[k] + 1]; sb += d[corners[k] + 2]; }
    sr /= 4; sg /= 4; sb /= 4;

    var queue = [], head = 0, x, y, i;
    function seed(idx) {
      if (filled[idx] && colorDist(d, idx * 4, sr, sg, sb) <= tol) { filled[idx] = 0; queue.push(idx); }
    }
    for (x = 0; x < gw; x++) { seed(x); seed((gh - 1) * gw + x); }
    for (y = 0; y < gh; y++) { seed(y * gw); seed(y * gw + gw - 1); }
    while (head < queue.length) {
      i = queue[head++]; x = i % gw; y = (i / gw) | 0;
      if (x > 0) seed(i - 1);
      if (x < gw - 1) seed(i + 1);
      if (y > 0) seed(i - gw);
      if (y < gh - 1) seed(i + gw);
    }
    return filled;
  }

  function despeckle(filled, gw, gh, erode) {
    var n = gw * gh, out = new Uint8Array(filled), i, x, y, c;
    for (y = 0; y < gh; y++) {
      for (x = 0; x < gw; x++) {
        i = y * gw + x;
        if (!filled[i]) continue;
        c = 0;
        if (x > 0 && filled[i - 1]) c++;
        if (x < gw - 1 && filled[i + 1]) c++;
        if (y > 0 && filled[i - gw]) c++;
        if (y < gh - 1 && filled[i + gw]) c++;
        if (c <= 1) out[i] = 0;
        else if (erode && c < 4) out[i] = 0;
      }
    }
    var kept = 0;
    for (i = 0; i < n; i++) if (out[i]) kept++;
    return kept < 12 ? filled : out;
  }

  function distanceField(filled, gw, gh) {
    var n = gw * gh, dist = new Float32Array(n), i, x, y, dv;
    var INF = 1e9, D1 = 1, D2 = 1.4142;
    for (i = 0; i < n; i++) dist[i] = filled[i] ? INF : 0;
    for (y = 0; y < gh; y++) for (x = 0; x < gw; x++) {
      i = y * gw + x;
      if (dist[i] === 0) continue;
      dv = dist[i];
      if (x === 0 || y === 0 || x === gw - 1 || y === gh - 1) dv = Math.min(dv, D1);
      if (x > 0) dv = Math.min(dv, dist[i - 1] + D1);
      if (y > 0) dv = Math.min(dv, dist[i - gw] + D1);
      if (x > 0 && y > 0) dv = Math.min(dv, dist[i - gw - 1] + D2);
      if (x < gw - 1 && y > 0) dv = Math.min(dv, dist[i - gw + 1] + D2);
      dist[i] = dv;
    }
    for (y = gh - 1; y >= 0; y--) for (x = gw - 1; x >= 0; x--) {
      i = y * gw + x;
      if (dist[i] === 0) continue;
      dv = dist[i];
      if (x < gw - 1) dv = Math.min(dv, dist[i + 1] + D1);
      if (y < gh - 1) dv = Math.min(dv, dist[i + gw] + D1);
      if (x < gw - 1 && y < gh - 1) dv = Math.min(dv, dist[i + gw + 1] + D2);
      if (x > 0 && y < gh - 1) dv = Math.min(dv, dist[i + gw - 1] + D2);
      dist[i] = dv;
    }
    return dist;
  }

  function voxelize(img, opt) {
    var N = opt.grid;
    var ratio = img.width / img.height, gw, gh;
    if (ratio >= 1) { gw = N; gh = Math.max(2, Math.round(N / ratio)); }
    else { gh = N; gw = Math.max(2, Math.round(N * ratio)); }

    var idata = sampleImage(img, gw, gh);
    var d = idata.data, n = gw * gh, i, x, y, z;

    var transparent = false;
    for (i = 0; i < n; i++) if (d[i * 4 + 3] < 250) { transparent = true; break; }

    var filled;
    if (opt.alphaOnly) {
      // 저장해 둔 마스크에서 되살릴 때: 배경은 이미 지워졌으니 다시 판정하지 않는다
      filled = new Uint8Array(n);
      for (i = 0; i < n; i++) filled[i] = d[i * 4 + 3] >= 128 ? 1 : 0;
    } else if (!opt.removeBg) {
      filled = new Uint8Array(n);
      for (i = 0; i < n; i++) filled[i] = d[i * 4 + 3] >= 96 ? 1 : 0;
    } else if (transparent) {
      filled = new Uint8Array(n);
      for (i = 0; i < n; i++) filled[i] = d[i * 4 + 3] >= 128 ? 1 : 0;
    } else {
      filled = maskByFlood(d, gw, gh, opt.tolerance);
    }
    filled = despeckle(filled, gw, gh, opt.trim && opt.removeBg);

    var any = false;
    for (i = 0; i < n; i++) if (filled[i]) { any = true; break; }
    if (!any) return null;

    /* 여백을 잘라내 오브제가 바닥에 딱 붙게 한다 */
    var minX = gw, maxX = -1, minY = gh, maxY = -1;
    for (y = 0; y < gh; y++) for (x = 0; x < gw; x++) {
      if (!filled[y * gw + x]) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }

    var D = opt.depth;
    var depth = new Int16Array(n);
    if (opt.mode === 'inflate') {
      var dist = distanceField(filled, gw, gh), maxD = 1;
      for (i = 0; i < n; i++) if (dist[i] > maxD) maxD = dist[i];
      var R = Math.max(1, Math.min(D * 0.6, maxD));
      for (i = 0; i < n; i++) if (filled[i]) depth[i] = 1 + Math.round((D - 1) * Math.sqrt(clamp(dist[i] / R, 0, 1)));
    } else if (opt.mode === 'relief') {
      for (i = 0; i < n; i++) {
        if (!filled[i]) continue;
        var lum = (0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]) / 255;
        depth[i] = 1 + Math.round((D - 1) * lum);
      }
    } else {
      for (i = 0; i < n; i++) if (filled[i]) depth[i] = D;
    }

    var z0 = new Int16Array(n), z1 = new Int16Array(n), dzMax = 1;
    for (i = 0; i < n; i++) {
      if (!filled[i]) continue;
      z0[i] = -Math.floor(depth[i] / 2);
      z1[i] = z0[i] + depth[i] - 1;
      if (depth[i] > dzMax) dzMax = depth[i];
    }

    function occ(px, py, pz) {
      if (px < 0 || py < 0 || px >= gw || py >= gh) return false;
      var j = py * gw + px;
      if (!filled[j]) return false;
      return pz >= z0[j] && pz <= z1[j];
    }

    var bw = maxX - minX + 1, bh = maxY - minY + 1;
    var ox = minX + bw / 2 - 0.5;      // 좌우 중심
    var pos = [], col = [];
    for (y = minY; y <= maxY; y++) {
      for (x = minX; x <= maxX; x++) {
        i = y * gw + x;
        if (!filled[i]) continue;
        var r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
        for (z = z0[i]; z <= z1[i]; z++) {
          var open = 0;
          if (!occ(x - 1, y, z)) open++;
          if (!occ(x + 1, y, z)) open++;
          if (!occ(x, y - 1, z)) open++;
          if (!occ(x, y + 1, z)) open++;
          if (!occ(x, y, z - 1)) open++;
          if (!occ(x, y, z + 1)) open++;
          if (open === 0) continue;
          // 바닥(y=0)에 딱 서도록 아래끝을 0에 맞춘다
          pos.push(x - ox, maxY - y + 0.5, z);
          col.push(r / 255, g / 255, b / 255, Math.min(1, 0.86 + 0.045 * open));
        }
      }
    }

    /* 저장·복원용 마스크 PNG (배경 투명, 격자 해상도 그대로) */
    var mc = document.createElement('canvas');
    mc.width = bw; mc.height = bh;
    var mctx = mc.getContext('2d');
    var mimg = mctx.createImageData(bw, bh);
    for (y = 0; y < bh; y++) for (x = 0; x < bw; x++) {
      var si = (y + minY) * gw + (x + minX), di = (y * bw + x) * 4;
      if (filled[si]) {
        mimg.data[di] = d[si * 4]; mimg.data[di + 1] = d[si * 4 + 1];
        mimg.data[di + 2] = d[si * 4 + 2]; mimg.data[di + 3] = 255;
      }
    }
    mctx.putImageData(mimg, 0, 0);

    var count = pos.length / 3;
    var colors = new Float32Array(count * 4);
    colors.set(col);
    return {
      gw: bw, gh: bh, dz: dzMax, count: count,
      positions: new Float32Array(pos), colors: colors,
      png: mc.toDataURL('image/png')
    };
  }

  /* ================================================================
     2. 복셀 → 메시
     ================================================================ */

  var BOX = new T.BoxGeometry(1, 1, 1);
  var _dummy = new T.Object3D();
  var _color = new T.Color();

  function buildMesh(data, forShadow) {
    var mat = new T.MeshLambertMaterial({ color: 0xffffff });
    var mesh = new T.InstancedMesh(BOX, mat, data.count);
    mesh.raycast = function () {};
    for (var i = 0; i < data.count; i++) {
      _dummy.position.set(data.positions[i * 3], data.positions[i * 3 + 1], data.positions[i * 3 + 2]);
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);
      var o = i * 4;
      _color.setRGB(data.colors[o], data.colors[o + 1], data.colors[o + 2], T.SRGBColorSpace);
      _color.multiplyScalar(data.colors[o + 3]);
      mesh.setColorAt(i, _color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = false;
    if (forShadow) { mesh.castShadow = true; mesh.receiveShadow = true; }
    return mesh;
  }

  /* ================================================================
     3. 방
     ================================================================ */

  var PALETTES = {
    wood:   { name: '우드 & 크림', floorA: 0xC9A268, floorB: 0xBE9760, wallA: 0xF0E7D7, wallB: 0xE8DECC, base: 0xB08A57, sky1: '#F3EDE1', sky2: '#DED2BE' },
    mint:   { name: '민트 타일',   floorA: 0xBCD8CC, floorB: 0xAECDC0, wallA: 0xE6F0EB, wallB: 0xDBE9E2, base: 0x8FB6A6, sky1: '#EAF3EE', sky2: '#D2E4DB' },
    night:  { name: '밤하늘',      floorA: 0x554E7C, floorB: 0x4B4570, wallA: 0x413C64, wallB: 0x3A3559, base: 0x2E2B47, sky1: '#332F4E', sky2: '#191830' },
    sakura: { name: '벚꽃',        floorA: 0xE0C0C4, floorB: 0xD6B4B9, wallA: 0xF7EAEB, wallB: 0xF0E1E3, base: 0xC59BA1, sky1: '#F7ECEE', sky2: '#E4CDD1' }
  };

  var TILE_H = 0.35;
  var WALL_H = 5;
  var FOV = 24;

  var room = { size: 12, palette: 'wood', group: null, walls: [] };
  var scene, camera, renderer, lights;
  var view = { yaw: 0, pitch: 0.58, zoom: 1 };
  var placed = [];
  var items = [];
  var selected = null;

  function buildRoom() {
    if (room.group) {
      scene.remove(room.group);
      room.group.traverse(function (o) {
        if (o.isInstancedMesh) { o.dispose(); o.material.dispose(); }
        else if (o.isMesh || o.isLine) { o.geometry.dispose(); o.material.dispose(); }
      });
    }
    var P = PALETTES[room.palette], N = room.size, half = N / 2;
    var g = new T.Group();

    // 바닥
    var floorGeo = new T.BoxGeometry(1, TILE_H, 1);
    var floor = new T.InstancedMesh(floorGeo, new T.MeshLambertMaterial({ color: 0xffffff }), N * N);
    floor.receiveShadow = true;
    var k = 0, x, z, y;
    for (z = 0; z < N; z++) for (x = 0; x < N; x++) {
      _dummy.position.set(x + 0.5 - half, -TILE_H / 2, z + 0.5 - half);
      _dummy.updateMatrix();
      floor.setMatrixAt(k, _dummy.matrix);
      floor.setColorAt(k, _color.setHex((x + z) % 2 ? P.floorB : P.floorA, T.SRGBColorSpace));
      k++;
    }
    floor.instanceMatrix.needsUpdate = true;
    if (floor.instanceColor) floor.instanceColor.needsUpdate = true;
    floor.raycast = function () {};
    g.add(floor);

    // 네 벽을 모두 세우고, 카메라를 가로막는 앞쪽 벽만 그때그때 숨긴다
    var span = N;
    var defs = [
      { n: new T.Vector3(0, 0, 1),  axis: 'z', sign: -1 },
      { n: new T.Vector3(0, 0, -1), axis: 'z', sign: 1 },
      { n: new T.Vector3(1, 0, 0),  axis: 'x', sign: -1 },
      { n: new T.Vector3(-1, 0, 0), axis: 'x', sign: 1 }
    ];
    room.walls = defs.map(function (def) {
      var m = new T.InstancedMesh(
        new T.BoxGeometry(1, 1, 1),
        new T.MeshLambertMaterial({ color: 0xffffff }),
        span * WALL_H
      );
      m.receiveShadow = true;
      m.raycast = function () {};
      var i = 0;
      for (var yy = 0; yy < WALL_H; yy++) {
        var shade = yy === 0 ? P.base : ((yy % 2) ? P.wallB : P.wallA);
        for (var t = 0; t < span; t++) {
          var u = t + 0.5 - half;
          if (def.axis === 'z') {
            _dummy.position.set(u, yy + 0.5, def.sign * (half + 0.2));
            _dummy.scale.set(1, 1, 0.4);
          } else {
            _dummy.position.set(def.sign * (half + 0.2), yy + 0.5, u);
            _dummy.scale.set(0.4, 1, 1);
          }
          _dummy.updateMatrix();
          m.setMatrixAt(i, _dummy.matrix);
          m.setColorAt(i, _color.setHex(shade, T.SRGBColorSpace));
          i++;
        }
      }
      _dummy.scale.set(1, 1, 1);
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      g.add(m);
      return { mesh: m, n: def.n };
    });

    // 벽이 만나는 네 모서리 기둥 (벽을 서로 겹치게 늘리면 밖으로 삐져나온다)
    var corner = new T.InstancedMesh(
      new T.BoxGeometry(1, 1, 1),
      new T.MeshLambertMaterial({ color: 0xffffff }),
      4 * WALL_H
    );
    corner.receiveShadow = true;
    corner.raycast = function () {};
    var ci = 0, off = half + 0.2;
    for (var cy = 0; cy < WALL_H; cy++) {
      var cShade = cy === 0 ? P.base : ((cy % 2) ? P.wallB : P.wallA);
      [[-off, -off], [off, -off], [-off, off], [off, off]].forEach(function (q) {
        _dummy.position.set(q[0], cy + 0.5, q[1]);
        _dummy.scale.set(0.4, 1, 0.4);
        _dummy.updateMatrix();
        corner.setMatrixAt(ci, _dummy.matrix);
        corner.setColorAt(ci, _color.setHex(cShade, T.SRGBColorSpace));
        ci++;
      });
    }
    _dummy.scale.set(1, 1, 1);
    corner.instanceMatrix.needsUpdate = true;
    if (corner.instanceColor) corner.instanceColor.needsUpdate = true;
    g.add(corner);

    room.group = g;
    scene.add(g);

    document.body.style.setProperty('--sky-1', P.sky1);
    document.body.style.setProperty('--sky-2', P.sky2);

    // 네 벽이 모두 서 있으므로 빛은 위에서 비스듬히 — 벽은 그림자를 만들지 않는다
    lights.key.position.set(N * 0.5, N * 1.7, N * 0.7);
    lights.fill.position.set(-N * 0.8, N * 0.55, -N * 0.4);
    var sc = lights.key.shadow.camera;
    sc.left = -N * 1.2; sc.right = N * 1.2;
    sc.top = N * 1.2; sc.bottom = -N * 1.2;
    sc.near = 0.5; sc.far = N * 5;
    sc.updateProjectionMatrix();

    view.zoom = 1;
    updateWalls();      // 새로 만든 벽에도 앞면 감추기를 바로 적용한다
    clampAllInside();
  }

  function initScene() {
    var canvas = $('#stage');
    renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;

    scene = new T.Scene();
    camera = new T.PerspectiveCamera(FOV, 1, 0.5, 900);

    var amb = new T.AmbientLight(0xfff4e4, 0.22);
    var hemi = new T.HemisphereLight(0xfff4e2, 0xc0b5a2, 0.95);
    var key = new T.DirectionalLight(0xfff0d2, 1.05);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0009;
    key.shadow.normalBias = 0.08;
    key.shadow.radius = 2;
    var fill = new T.DirectionalLight(0xe8ecff, 0.42);
    scene.add(amb, hemi, key, key.target, fill);
    lights = { hemi: hemi, key: key, fill: fill };

    buildRoom();
    resize();
    window.addEventListener('resize', resize);
  }

  function resize() {
    var w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    updateCamera();
  }

  var RAIL_W = 292;

  function updateCamera() {
    var N = room.size;
    var W = window.innerWidth, H = Math.max(1, window.innerHeight);
    var rail = W > 900 ? RAIL_W : 0;         // 왼쪽 보관함이 가리는 폭
    var usable = Math.max(320, W - rail);
    camera.aspect = W / H;

    // 방이 화면에 꽉 차도록 거리를 잡는다 (좁은 화각 = 동물의숲 같은 디오라마 원근)
    var need = N * 1.34;
    var tanV = Math.tan(FOV * Math.PI / 360);
    var dist = Math.max(need / (2 * tanV), (need * 1.06) / (2 * tanV * (usable / H))) / view.zoom;

    var ty = N * 0.12;
    camera.position.set(
      Math.cos(view.pitch) * Math.sin(view.yaw) * dist,
      Math.sin(view.pitch) * dist + ty,
      Math.cos(view.pitch) * Math.cos(view.yaw) * dist
    );
    camera.lookAt(0, ty, 0);
    camera.near = Math.max(0.5, dist * 0.05);
    camera.far = dist * 3.5;
    // 보관함이 가린 만큼 방을 오른쪽으로 밀어 준다
    camera.setViewOffset(W, H, -rail / 2, 0, W, H);
    updateWalls();
  }

  // 카메라와 방 사이를 가로막는 벽은 감춘다
  var _camDir = new T.Vector3();
  function updateWalls() {
    if (!room.walls.length) return;
    _camDir.copy(camera.position).setY(0);
    if (_camDir.lengthSq() < 1e-6) _camDir.set(0, 0, 1);
    _camDir.normalize();
    for (var i = 0; i < room.walls.length; i++) {
      var w = room.walls[i];
      w.mesh.visible = w.n.dot(_camDir) > -0.06;
    }
  }

  /* ================================================================
     4. 오브제 배치
     ================================================================ */

  var FLOOR_PLANE = new T.Plane(new T.Vector3(0, 1, 0), 0);
  var _ray = new T.Raycaster();
  var _ndc = new T.Vector2();
  var _hitPt = new T.Vector3();

  function setRay(cx, cy) {
    _ndc.set((cx / window.innerWidth) * 2 - 1, -(cy / window.innerHeight) * 2 + 1);
    _ray.setFromCamera(_ndc, camera);
  }

  function floorPoint(cx, cy) {
    setRay(cx, cy);
    return _ray.ray.intersectPlane(FLOOR_PLANE, _hitPt) ? _hitPt.clone() : null;
  }

  // 회전을 반영한 바닥 점유 크기
  function footprint(p) {
    var s = p.h / p.data.gh;
    var w = p.data.gw * s, dd = p.data.dz * s;
    var c = Math.abs(Math.cos(p.rot)), n = Math.abs(Math.sin(p.rot));
    return { w: w * c + dd * n, d: w * n + dd * c };
  }

  function placeItem(item, x, z, opts) {
    opts = opts || {};
    var data = item.data;
    var group = new T.Group();
    var mesh = buildMesh(data, true);
    var inner = new T.Group();
    inner.add(mesh);
    group.add(inner);
    scene.add(group);

    var p = {
      key: opts.key || uid(),
      itemId: item.id,
      data: data,
      group: group, inner: inner, mesh: mesh,
      x: x, z: z, y: opts.y || 0,
      rot: opts.rot || 0,
      h: opts.h || clamp(2.6 * (data.gh / Math.max(data.gw, data.gh)) + 0.8, 0.8, 5)
    };
    placed.push(p);
    applyTransform(p);
    if (item.traits && item.traits.character) attachChar(p);
    return p;
  }

  function applyTransform(p) {
    var s = p.h / p.data.gh;
    p.group.position.set(p.x, p.y, p.z);
    p.group.rotation.y = p.rot;
    p.inner.scale.setScalar(s);
    p.inner.position.set(0, 0, 0);
  }

  function removePlaced(p) {
    scene.remove(p.group);
    p.mesh.dispose();
    p.mesh.material.dispose();
    var i = placed.indexOf(p);
    if (i >= 0) placed.splice(i, 1);
    if (activeChar === p) {
      var next = null;
      for (var j = 0; j < placed.length; j++) if (placed[j].char) { next = placed[j]; break; }
      setActiveChar(next);
    }
    if (selected === p) select(null);
    save();
  }

  function clampAllInside() {
    var half = room.size / 2;
    placed.forEach(function (p) {
      var f = footprint(p);
      p.x = clamp(p.x, -half + f.w / 2, half - f.w / 2);
      p.z = clamp(p.z, -half + f.d / 2, half - f.d / 2);
      applyTransform(p);
    });
  }

  // 다른 오브제 '위에' 정확히 놓았을 때만 얹는다 (스쳐 지나가면 그대로 바닥)
  function restY(p, x, z) {
    var top = 0;
    for (var i = 0; i < placed.length; i++) {
      var q = placed[i];
      if (q === p) continue;
      var g = footprint(q);
      if (Math.abs(q.x - x) < g.w / 2 && Math.abs(q.z - z) < g.d / 2) {
        top = Math.max(top, q.y + q.h);
      }
    }
    return top;
  }

  function snap(v) { return Math.round(v * 2) / 2; }

  function moveTo(p, wx, wz) {
    var half = room.size / 2, f = footprint(p);
    var x = clamp(snap(wx), -half + f.w / 2, half - f.w / 2);
    var z = clamp(snap(wz), -half + f.d / 2, half - f.d / 2);
    p.x = x; p.z = z;
    p.y = restY(p, x, z);
    applyTransform(p);
  }

  /* ------------------------------------------------------------- 선택 */
  var marker, markerLine;

  function initMarker() {
    var geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(new Float32Array(15), 3));
    markerLine = new T.Line(geo, new T.LineBasicMaterial({ color: 0x18b39c, transparent: true, opacity: 0.95 }));
    markerLine.visible = false;
    markerLine.renderOrder = 5;
    markerLine.material.depthTest = false;
    scene.add(markerLine);

    marker = new T.Mesh(
      new T.PlaneGeometry(1, 1),
      new T.MeshBasicMaterial({ color: 0x18b39c, transparent: true, opacity: 0.16, depthWrite: false })
    );
    marker.rotation.x = -Math.PI / 2;
    marker.visible = false;
    scene.add(marker);
  }

  function updateMarker() {
    if (!selected) { markerLine.visible = false; marker.visible = false; return; }
    var p = selected, f = footprint(p);
    var hw = f.w / 2, hd = f.d / 2, y = p.y + 0.02;
    var a = markerLine.geometry.attributes.position.array;
    var pts = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd], [-hw, -hd]];
    for (var i = 0; i < 5; i++) { a[i * 3] = p.x + pts[i][0]; a[i * 3 + 1] = y; a[i * 3 + 2] = p.z + pts[i][1]; }
    markerLine.geometry.attributes.position.needsUpdate = true;
    markerLine.geometry.computeBoundingSphere();
    markerLine.visible = true;
    marker.position.set(p.x, y - 0.005, p.z);
    marker.scale.set(f.w, f.d, 1);
    marker.visible = true;
  }

  function select(p) {
    selected = p;
    var bar = $('#objbar');
    $('#traits').hidden = true;
    if (!p) {
      bar.classList.remove('is-on');
      document.body.classList.remove('has-sel');
      $('#player').hidden = true;
      $('#charhint').hidden = true;
      updateMarker();
      return;
    }
    bar.classList.add('is-on');
    document.body.classList.add('has-sel');
    $('#size').value = p.h;
    $('#size-v').textContent = p.h.toFixed(1) + '칸';
    var it = itemById(p.itemId);
    $('#objbar-name').textContent = it ? it.name : '오브제';
    renderTraitPanel();
    syncPanels(p);
    updateMarker();
  }

  function hitPlaced(cx, cy) {
    setRay(cx, cy);
    var best = null, bestD = Infinity;
    for (var i = 0; i < placed.length; i++) {
      var p = placed[i], f = footprint(p);
      // 회전과 무관한 축정렬 박스로 잡는다 (넉넉하고 빠르다)
      var box = new T.Box3(
        new T.Vector3(p.x - f.w / 2, p.y, p.z - f.d / 2),
        new T.Vector3(p.x + f.w / 2, p.y + p.h, p.z + f.d / 2)
      );
      var pt = _ray.ray.intersectBox(box, new T.Vector3());
      if (pt) {
        var dd = pt.distanceTo(camera.position);
        if (dd < bestD) { bestD = dd; best = p; }
      }
    }
    return best;
  }

  /* ------------------------------------------------------------- 입력 */
  var drag = null;

  function onDown(e) {
    if (e.button === 2) return;
    if (studio.open) return;
    if (e.target.closest && e.target.closest('.ui, .studio, #dropveil')) return;
    var p = hitPlaced(e.clientX, e.clientY);
    if (p) {
      select(p);
      var fp = floorPoint(e.clientX, e.clientY);
      drag = { mode: 'move', p: p, offX: fp ? p.x - fp.x : 0, offZ: fp ? p.z - fp.z : 0, moved: false };
      document.body.classList.add('grabbing');
    } else {
      select(null);
      drag = { mode: 'orbit', sx: e.clientX, sy: e.clientY, yaw: view.yaw, pitch: view.pitch };
      document.body.classList.add('orbiting');
    }
    e.preventDefault();
  }

  function onMove(e) {
    if (!drag) {
      var over = hitPlaced(e.clientX, e.clientY);
      document.body.classList.toggle('over-obj', !!over);
      return;
    }
    if (drag.mode === 'orbit') {
      view.yaw = drag.yaw - (e.clientX - drag.sx) * 0.008;
      view.pitch = clamp(drag.pitch + (e.clientY - drag.sy) * 0.005, 0.18, 1.35);
      updateCamera();
    } else {
      var fp = floorPoint(e.clientX, e.clientY);
      if (!fp) return;
      moveTo(drag.p, fp.x + drag.offX, fp.z + drag.offZ);
      drag.moved = true;
      updateMarker();
    }
  }

  function onUp() {
    if (drag) {
      if (drag.mode === 'move' && drag.moved) save();
      document.body.classList.remove('grabbing', 'orbiting');
      drag = null;
    }
  }

  function onWheel(e) {
    if (studio.open) return;
    if (e.target.closest && e.target.closest('.ui, .studio')) return;
    e.preventDefault();
    if (selected && hitPlaced(e.clientX, e.clientY) === selected) {
      setSize(selected.h * (e.deltaY > 0 ? 0.93 : 1.075));
    } else {
      view.zoom = clamp(view.zoom * (e.deltaY > 0 ? 0.92 : 1.087), 0.45, 3.2);
      updateCamera();
    }
  }

  function setSize(h) {
    if (!selected) return;
    var p = selected;
    p.h = clamp(h, 0.3, 7);
    moveTo(p, p.x, p.z);
    $('#size').value = p.h;
    $('#size-v').textContent = p.h.toFixed(1) + '칸';
    updateMarker();
    saveSoon();
  }

  function rotate(dir) {
    if (!selected) return;
    selected.rot += dir * Math.PI / 4;
    moveTo(selected, selected.x, selected.z);
    updateMarker();
    save();
  }

  function inField(e) {
    var t = e.target;
    return !!(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable));
  }

  var MOVE_KEYS = {
    w: 'w', a: 'a', s: 's', d: 'd',
    arrowup: 'w', arrowleft: 'a', arrowdown: 's', arrowright: 'd',
    'ㅈ': 'w', 'ㅁ': 'a', 'ㄴ': 's', 'ㅇ': 'd'   // 한글 자판이 켜져 있어도 걷게
  };

  function onKey(e) {
    if (inField(e)) return;
    var k = (e.key || '').toLowerCase();

    if (k === 'escape') {
      if (!$('#askbox').hasAttribute('hidden')) { answer(false); return; }
      if (studio.open) { closeStudio(); return; }
      select(null);
      return;
    }
    if (!$('#askbox').hasAttribute('hidden')) {
      if (k === 'enter') answer(true);
      return;
    }
    if (studio.open) return;

    // 캐릭터 조작
    if (MOVE_KEYS[k]) { keys[MOVE_KEYS[k]] = true; if (activeChar) e.preventDefault(); return; }
    if (k === ' ' || k === 'spacebar') {
      if (activeChar) { activeChar.char.jump = true; e.preventDefault(); }
      return;
    }
    if (k === 'z' || k === 'ㅋ') {
      if (activeChar) { activeChar.char.sitting = !activeChar.char.sitting; saveSoon(); }
      return;
    }

    if (!selected) return;
    if (k === 'delete' || k === 'backspace') { e.preventDefault(); removePlaced(selected); }
    else if (k === 'r' || k === 'ㄱ') rotate(e.shiftKey ? -1 : 1);
  }

  function onKeyUp(e) {
    var k = (e.key || '').toLowerCase();
    if (MOVE_KEYS[k]) keys[MOVE_KEYS[k]] = false;
  }

  function releaseKeys() { for (var k in keys) keys[k] = false; }

  /* ================================================================
     5. 보관함
     ================================================================ */

  function itemById(id) {
    for (var i = 0; i < items.length; i++) if (items[i].id === id) return items[i];
    return null;
  }

  var thumbRenderer = null, thumbScene = null, thumbCam = null;
  function makeThumb(data) {
    if (!thumbRenderer) {
      var c = document.createElement('canvas');
      c.width = c.height = 160;
      thumbRenderer = new T.WebGLRenderer({ canvas: c, antialias: true, alpha: true, preserveDrawingBuffer: true });
      thumbRenderer.setPixelRatio(1);
      thumbRenderer.setSize(160, 160, false);
      thumbRenderer.outputColorSpace = T.SRGBColorSpace;
      thumbScene = new T.Scene();
      var h = new T.HemisphereLight(0xe4ecff, 0x77809b, 1.0);
      var k = new T.DirectionalLight(0xfff4e2, 1.25); k.position.set(-0.6, 1, 0.8);
      var f = new T.DirectionalLight(0xc9d8ff, 0.4); f.position.set(0.8, 0.2, 0.5);
      thumbScene.add(h, k, f);
      thumbCam = new T.OrthographicCamera(-1, 1, 1, -1, -600, 600);
    }
    var m = buildMesh(data, false);
    m.position.y = -data.gh / 2;
    var g = new T.Group();
    g.add(m);
    g.rotation.set(0.18, -0.5, 0);
    thumbScene.add(g);
    var r = Math.max(data.gw, data.gh) * 0.62;
    thumbCam.left = -r; thumbCam.right = r; thumbCam.top = r; thumbCam.bottom = -r;
    thumbCam.position.set(0, 0, 400);
    thumbCam.updateProjectionMatrix();
    thumbRenderer.render(thumbScene, thumbCam);
    var url = thumbRenderer.domElement.toDataURL('image/png');
    thumbScene.remove(g);
    m.dispose(); m.material.dispose();
    return url;
  }

  function addItem(data, name) {
    var item = {
      id: uid(), name: name || ('오브제 ' + (items.length + 1)),
      data: data, thumb: makeThumb(data),
      traits: {}, tracks: []
    };
    items.push(item);
    renderInventory();
    return item;
  }

  function renderInventory() {
    var list = $('#inv-list');
    list.innerHTML = '';
    $('#inv-count').textContent = items.length ? items.length + '개' : '';
    if (!items.length) {
      var empty = document.createElement('p');
      empty.className = 'inv-empty';
      empty.textContent = '아직 오브제가 없습니다. 그림을 올려 첫 오브제를 깎아 보세요.';
      list.appendChild(empty);
      return;
    }
    items.forEach(function (it) {
      var card = document.createElement('div');
      card.className = 'inv-card';
      var tr = it.traits || {};
      var badges = '';
      if (tr.character) badges += '<span class="badge badge-c">캐릭터</span>';
      if (tr.music) badges += '<span class="badge badge-m">음악</span>';
      card.innerHTML =
        '<button class="inv-take" type="button" title="방에 꺼내기">' +
          '<img src="' + it.thumb + '" alt="">' +
          '<span class="inv-name"></span>' +
        '</button>' +
        (badges ? '<span class="inv-badges">' + badges + '</span>' : '') +
        '<button class="inv-del" type="button" aria-label="보관함에서 지우기">✕</button>';
      card.querySelector('.inv-name').textContent = it.name;
      card.querySelector('.inv-take').addEventListener('click', function () { takeOut(it); });
      card.querySelector('.inv-del').addEventListener('click', function () { deleteItem(it); });
      list.appendChild(card);
    });
  }

  function freeSpot() {
    var half = room.size / 2 - 1.5;
    for (var tries = 0; tries < 40; tries++) {
      var x = snap((Math.random() * 2 - 1) * half);
      var z = snap((Math.random() * 2 - 1) * half);
      var ok = true;
      for (var i = 0; i < placed.length; i++) {
        if (Math.abs(placed[i].x - x) < 1.2 && Math.abs(placed[i].z - z) < 1.2) { ok = false; break; }
      }
      if (ok) return { x: x, z: z };
    }
    return { x: 0, z: 0 };
  }

  function takeOut(item) {
    var s = freeSpot();
    var p = placeItem(item, s.x, s.z);
    moveTo(p, s.x, s.z);
    select(p);
    save();
    toast(item.name + ' 을(를) 방에 꺼냈습니다. 끌어서 옮기고 크기를 맞춰 보세요.');
  }

  function deleteItem(item) {
    var used = placed.filter(function (p) { return p.itemId === item.id; });
    var q = used.length
      ? '‘' + item.name + '’을(를) 보관함에서 지웁니다. 방에 놓인 ' + used.length + '개도 함께 사라집니다.'
      : '‘' + item.name + '’을(를) 보관함에서 지울까요?';
    ask(q, '지우기').then(function (ok) {
      if (!ok) return;
      used.slice().forEach(removePlaced);
      (item.tracks || []).forEach(function (t) { idbDel(t.id); });
      if (music.itemId === item.id) stopMusic();
      items.splice(items.indexOf(item), 1);
      renderInventory();
      save();
    });
  }

  /* ================================================================
     6. 오브제 속성 — 캐릭터 / 음악재생
     ================================================================ */

  function traitsOf(id) {
    var it = itemById(id);
    return (it && it.traits) || {};
  }

  function setTrait(item, name, on) {
    item.traits = item.traits || {};
    item.traits[name] = !!on;
    placed.forEach(function (p) {
      if (p.itemId !== item.id) return;
      if (name === 'character') { if (on) attachChar(p); else detachChar(p); }
    });
    if (name === 'music' && !on && music.itemId === item.id) stopMusic();
    renderInventory();
    renderTraitPanel();
    if (selected) syncPanels(selected);
    save();
  }

  /* ------------------------------------------------- 음악 파일 보관 (IDB) */
  var _db;
  function idb() {
    if (_db) return _db;
    _db = new Promise(function (res) {
      try {
        var r = indexedDB.open('voxel-room', 1);
        r.onupgradeneeded = function () {
          if (!r.result.objectStoreNames.contains('tracks')) r.result.createObjectStore('tracks', { keyPath: 'id' });
        };
        r.onsuccess = function () { res(r.result); };
        r.onerror = function () { res(null); };
      } catch (e) { res(null); }
    });
    return _db;
  }
  function idbPut(id, blob) {
    return idb().then(function (db) {
      if (!db) return null;
      return new Promise(function (res) {
        var tx = db.transaction('tracks', 'readwrite');
        tx.objectStore('tracks').put({ id: id, blob: blob });
        tx.oncomplete = function () { res(true); };
        tx.onerror = function () { res(null); };
      });
    });
  }
  function idbGet(id) {
    return idb().then(function (db) {
      if (!db) return null;
      return new Promise(function (res) {
        var rq = db.transaction('tracks', 'readonly').objectStore('tracks').get(id);
        rq.onsuccess = function () { res(rq.result ? rq.result.blob : null); };
        rq.onerror = function () { res(null); };
      });
    });
  }
  function idbDel(id) {
    delete blobCache[id];
    return idb().then(function (db) {
      if (!db) return;
      try { db.transaction('tracks', 'readwrite').objectStore('tracks').delete(id); } catch (e) {}
    });
  }

  // 이번 세션에 넣은 파일은 곧바로 쓸 수 있게 메모리에도 들고 있는다
  var blobCache = Object.create(null);
  function getBlob(id) {
    if (blobCache[id]) return Promise.resolve(blobCache[id]);
    return idbGet(id).then(function (b) { if (b) blobCache[id] = b; return b; });
  }

  /* ------------------------------------------------------------- 캐릭터 */
  var keys = Object.create(null);
  var activeChar = null;

  function attachChar(p) {
    if (p.char) return;
    p.char = { vx: 0, vz: 0, vy: 0, phase: 0, sit: 0, sitting: false, onGround: true, jump: false, idle: Math.random() * 6.28 };
    if (!activeChar) setActiveChar(p);
  }

  function detachChar(p) {
    p.char = null;
    p.inner.rotation.set(0, 0, 0);
    p.inner.position.y = 0;
    applyTransform(p);
    if (activeChar === p) {
      var next = null;
      for (var i = 0; i < placed.length; i++) if (placed[i].char) { next = placed[i]; break; }
      setActiveChar(next);
    }
  }

  function setActiveChar(p) {
    activeChar = p;
    var badge = $('#charbadge');
    if (!p) { badge.setAttribute('hidden', ''); return; }
    badge.removeAttribute('hidden');
    var it = itemById(p.itemId);
    $('#charbadge-name').textContent = it ? it.name : '캐릭터';
  }

  function updateCharacters(dt, t) {
    var half = room.size / 2;
    var fx = -Math.sin(view.yaw), fz = -Math.cos(view.yaw);   // 화면 위쪽 방향
    var rx = -fz, rz = fx;                                     // 화면 오른쪽 방향

    for (var i = 0; i < placed.length; i++) {
      var p = placed[i], c = p.char;
      if (!c) continue;
      var live = (p === activeChar) && !(drag && drag.p === p) && !studio.open;

      var mvx = 0, mvz = 0;
      if (live && !c.sitting) {
        if (keys.w) { mvx += fx; mvz += fz; }
        if (keys.s) { mvx -= fx; mvz -= fz; }
        if (keys.d) { mvx += rx; mvz += rz; }
        if (keys.a) { mvx -= rx; mvz -= rz; }
        var len = Math.sqrt(mvx * mvx + mvz * mvz);
        if (len > 0) { mvx /= len; mvz /= len; }
      }

      var maxSpd = 2.3 + p.h * 0.32;
      var acc = 1 - Math.exp(-dt * (c.onGround ? 15 : 4.5));
      c.vx += (mvx * maxSpd - c.vx) * acc;
      c.vz += (mvz * maxSpd - c.vz) * acc;
      var spd = Math.sqrt(c.vx * c.vx + c.vz * c.vz);
      if (spd < 0.03) { c.vx = c.vz = 0; spd = 0; }

      if (spd > 0) {
        p.x = clamp(p.x + c.vx * dt, -half + 0.45, half - 0.45);
        p.z = clamp(p.z + c.vz * dt, -half + 0.45, half - 0.45);
        if (spd > 0.2) {
          // 그림을 밀어낸 오브제라 옆을 보면 얇다.
          // 늘 카메라 쪽을 보되 가는 방향으로만 살짝 트는 3/4 자세를 유지한다.
          var u = (c.vx * Math.cos(view.yaw) - c.vz * Math.sin(view.yaw)) / spd;
          var want = view.yaw + clamp(u, -1, 1) * 0.95;
          var diff = ((want - p.rot + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          p.rot += diff * (1 - Math.exp(-dt * 10));
        }
      }

      // 점프와 중력
      var g = restY(p, p.x, p.z);
      if (c.jump && c.onGround && !c.sitting) { c.vy = 6.4; c.onGround = false; }
      c.jump = false;
      if (c.onGround && p.y - g > 0.06) { c.onGround = false; c.vy = 0; }  // 턱에서 떨어지기
      if (!c.onGround) {
        c.vy -= 20 * dt;
        p.y += c.vy * dt;
        if (p.y <= g) { p.y = g; c.vy = 0; c.onGround = true; }
      } else if (p.y !== g) {
        p.y += (g - p.y) * (1 - Math.exp(-dt * 14));
        if (Math.abs(p.y - g) < 0.004) p.y = g;
      }

      c.sit += ((c.sitting ? 1 : 0) - c.sit) * (1 - Math.exp(-dt * 13));

      /* --- 걸음 모션: 발 디딜 때마다 위아래로 눌리고 좌우로 흔들린다 --- */
      var s = p.h / p.data.gh;
      var bob = 0, roll = 0, lean = 0, sy = 1, sxz = 1;
      if (!c.onGround) {
        lean = -0.1;
        sy = 1 + clamp(c.vy * 0.017, -0.09, 0.13);
        sxz = 1 - (sy - 1) * 0.55;
        c.phase = 0;
      } else if (spd > 0.12) {
        c.phase += dt * (5.0 + spd * 1.6);
        var st = Math.sin(c.phase), ast = Math.abs(st);
        bob = ast * 0.08 * p.h;
        roll = st * 0.07;
        lean = -Math.min(0.14, spd * 0.05);
        sy = 1 - ast * 0.05;
        sxz = 1 + ast * 0.035;
      } else {
        c.phase *= Math.exp(-dt * 6);
        var br = Math.sin(t * 1.7 + c.idle);
        bob = br * 0.007 * p.h;
        sy = 1 + br * 0.013;
        sxz = 1 - br * 0.009;
      }
      if (c.sit > 0.002) {
        sy *= 1 - 0.42 * c.sit;
        sxz *= 1 + 0.13 * c.sit;
        bob *= 1 - c.sit;
        lean += 0.07 * c.sit;
      }

      p.group.position.set(p.x, p.y, p.z);
      p.group.rotation.y = p.rot;
      p.inner.position.y = bob;
      p.inner.rotation.set(lean, 0, roll);
      p.inner.scale.set(s * sxz, s * sy, s * sxz);
    }
  }

  /* --------------------------------------------------------- 음악 재생 */
  var music = { audio: null, itemId: null, idx: -1, playing: false, url: null, one: false };

  function initMusic() {
    var a = music.audio = new Audio();
    a.preload = 'metadata';
    a.volume = 0.7;
    a.addEventListener('ended', function () {
      if (music.one) { a.currentTime = 0; a.play().catch(function () {}); return; }
      step(1, true);
    });
    a.addEventListener('timeupdate', updateTransport);
    a.addEventListener('loadedmetadata', updateTransport);
    a.addEventListener('play', function () { music.playing = true; updateTransport(); updateNowPlaying(); });
    a.addEventListener('pause', function () { music.playing = false; updateTransport(); updateNowPlaying(); });
  }

  function currentItem() { return music.itemId ? itemById(music.itemId) : null; }

  function playTrack(item, idx) {
    var tr = (item.tracks || [])[idx];
    if (!tr) return;
    getBlob(tr.id).then(function (blob) {
      if (!blob) {
        tr.missing = true;
        renderPlaylist();
        toast('‘' + tr.name + '’ 파일이 이 브라우저에 없습니다. 다시 넣어 주세요.');
        return;
      }
      if (music.url) URL.revokeObjectURL(music.url);
      music.url = URL.createObjectURL(blob);
      music.itemId = item.id;
      music.idx = idx;
      music.audio.src = music.url;
      music.audio.play().catch(function () { toast('재생을 시작하지 못했습니다.'); });
      renderPlaylist();
      updateNowPlaying();
    });
  }

  function step(dir, auto) {
    var item = currentItem();
    if (!item || !item.tracks || !item.tracks.length) return;
    var n = item.tracks.length;
    var next = (music.idx + dir + n) % n;
    if (auto && n === 1) { music.audio.currentTime = 0; music.audio.play().catch(function () {}); return; }
    playTrack(item, next);
  }

  function togglePlay() {
    var item = selectedItem();
    if (!item || !item.tracks || !item.tracks.length) return;
    if (music.itemId === item.id && music.audio.src) {
      if (music.audio.paused) music.audio.play().catch(function () {});
      else music.audio.pause();
    } else {
      playTrack(item, 0);
    }
  }

  function stopMusic() {
    if (!music.audio) return;
    music.audio.pause();
    music.audio.removeAttribute('src');
    try { music.audio.load(); } catch (e) {}
    if (music.url) { URL.revokeObjectURL(music.url); music.url = null; }
    music.itemId = null; music.idx = -1; music.playing = false;
    updateNowPlaying();
    renderPlaylist();
  }

  // 선택한 오브제가 속한 보관함 항목
  function selectedItem() {
    return selected ? itemById(selected.itemId) : null;
  }

  function addTracks(item, files) {
    var list = Array.prototype.slice.call(files).filter(function (f) {
      return /^audio\//.test(f.type) || /\.(mp3|m4a|aac|ogg|oga|wav|flac|webm)$/i.test(f.name);
    });
    if (!list.length) { toast('오디오 파일만 넣을 수 있습니다.'); return; }
    item.tracks = item.tracks || [];
    var recs = list.map(function (f) {
      var id = uid();
      var rec = { id: id, name: f.name.replace(/\.[a-z0-9]+$/i, '').slice(0, 70) };
      blobCache[id] = f;              // 바로 재생 가능
      item.tracks.push(rec);
      return { rec: rec, file: f };
    });
    renderPlaylist();
    save();
    toast(recs.length + '곡을 담았습니다.');

    // 저장은 뒤에서 — 실패하면 이번 세션에만 남는다고 표시한다
    Promise.all(recs.map(function (r) {
      return idbPut(r.rec.id, r.file).then(function (ok) { if (!ok) r.rec.volatile = true; return ok; });
    })).then(function (res) {
      if (res.some(function (v) { return !v; })) {
        renderPlaylist();
        toast('이 브라우저에는 음악을 저장할 수 없어, 새로고침하면 목록에서 사라집니다.');
      }
    });
  }

  function removeTrack(item, idx) {
    var tr = item.tracks[idx];
    if (!tr) return;
    var playing = music.itemId === item.id && music.idx === idx;
    idbDel(tr.id);
    item.tracks.splice(idx, 1);
    if (playing) stopMusic();
    else if (music.itemId === item.id && music.idx > idx) music.idx--;
    renderPlaylist();
    save();
  }

  function fmtTime(s) {
    if (!isFinite(s) || s < 0) s = 0;
    var m = Math.floor(s / 60);
    return m + ':' + String(Math.floor(s % 60)).padStart(2, '0');
  }

  function renderPlaylist() {
    var item = selectedItem();
    var list = $('#pl-list');
    if (!item) return;
    $('#pl-title').textContent = item.name;
    list.innerHTML = '';
    var tracks = item.tracks || [];
    if (!tracks.length) {
      var e = document.createElement('p');
      e.className = 'pl-empty';
      e.textContent = '아직 담긴 음악이 없습니다. 아래에서 음악 파일을 넣어 보세요.';
      list.appendChild(e);
    }
    tracks.forEach(function (tr, i) {
      var row = document.createElement('div');
      var on = music.itemId === item.id && music.idx === i;
      row.className = 'pl-row' + (on ? ' is-on' : '') + (tr.missing ? ' is-missing' : '');
      row.title = tr.missing ? '파일이 없습니다' : (tr.volatile ? '이 세션에만 남습니다' : tr.name);
      row.innerHTML =
        '<button class="pl-play" type="button"><span class="pl-i"></span><span class="pl-name"></span></button>' +
        '<button class="pl-x" type="button" aria-label="빼기">✕</button>';
      row.querySelector('.pl-i').textContent = on && music.playing ? '▶' : String(i + 1);
      row.querySelector('.pl-name').textContent = tr.name;
      row.querySelector('.pl-play').addEventListener('click', function () {
        if (on) togglePlay(); else playTrack(item, i);
      });
      row.querySelector('.pl-x').addEventListener('click', function () { removeTrack(item, i); });
      list.appendChild(row);
    });
    updateTransport();
  }

  function updateTransport() {
    var a = music.audio;
    if (!a) return;
    var tg = $('#pl-toggle');
    tg.classList.toggle('ico-pause', music.playing);
    tg.classList.toggle('ico-play', !music.playing);
    tg.setAttribute('aria-label', music.playing ? '일시정지' : '재생');
    var dur = isFinite(a.duration) ? a.duration : 0;
    var seek = $('#pl-seek');
    if (document.activeElement !== seek) {
      seek.max = dur || 0;
      seek.value = a.currentTime || 0;
    }
    seek.disabled = !dur;
    $('#pl-time').textContent = fmtTime(a.currentTime) + ' / ' + fmtTime(dur);
    $('#pl-one').setAttribute('aria-pressed', music.one ? 'true' : 'false');
  }

  function updateNowPlaying() {
    var bar = $('#nowplaying');
    var item = currentItem();
    var tr = item && item.tracks ? item.tracks[music.idx] : null;
    if (!tr || !music.audio || !music.audio.src) { bar.setAttribute('hidden', ''); return; }
    bar.removeAttribute('hidden');
    $('#np-name').textContent = tr.name;
    $('#np-from').textContent = item.name;
    var nt = $('#np-toggle');
    nt.classList.toggle('ico-pause', music.playing);
    nt.classList.toggle('ico-play', !music.playing);
  }

  // 재생 중인 음악 오브제는 리듬 타듯 살짝 들썩인다
  function updateMusicObjects(dt, t) {
    for (var i = 0; i < placed.length; i++) {
      var p = placed[i];
      if (p.char) continue;
      var on = music.playing && music.itemId === p.itemId;
      if (!p.mus) p.mus = { amt: 0, ph: Math.random() * 6.28, dirty: false };
      var m = p.mus;
      m.amt += ((on ? 1 : 0) - m.amt) * (1 - Math.exp(-dt * 5));
      if (m.amt < 0.003) {
        if (m.dirty) { p.inner.position.y = 0; p.inner.rotation.set(0, 0, 0); applyTransform(p); m.dirty = false; }
        continue;
      }
      m.dirty = true;
      var s = p.h / p.data.gh, a = m.amt, ph = t * 5.4 + m.ph;
      var st = Math.sin(ph);
      p.inner.position.y = Math.abs(st) * 0.055 * p.h * a;
      p.inner.rotation.set(0, 0, Math.sin(ph * 0.5) * 0.055 * a);
      p.inner.scale.set(s * (1 + 0.028 * a * st), s * (1 - 0.028 * a * st), s * (1 + 0.028 * a * st));
    }
  }

  /* --------------------------------------------------------- 속성 패널 */
  function renderTraitPanel() {
    var item = selectedItem();
    if (!item) return;
    $('#tr-character').checked = !!(item.traits && item.traits.character);
    $('#tr-music').checked = !!(item.traits && item.traits.music);
  }

  function syncPanels(p) {
    var it = p ? itemById(p.itemId) : null;
    var tr = (it && it.traits) || {};
    $('#player').hidden = !tr.music;
    if (tr.music) renderPlaylist();
    $('#charhint').hidden = !tr.character;
    if (p && p.char) setActiveChar(p);
  }

  /* ================================================================
     7. 저장
     ================================================================ */

  var saveTimer;
  function saveSoon() { clearTimeout(saveTimer); saveTimer = setTimeout(save, 450); }

  function serialize() {
    return {
      v: 1,
      room: { size: room.size, palette: room.palette },
      items: items.map(function (it) {
        return {
          id: it.id, name: it.name, png: it.data.png, opt: it.opt,
          traits: it.traits || {}, tracks: it.tracks || []
        };
      }),
      placed: placed.map(function (p) {
        return { key: p.key, itemId: p.itemId, x: p.x, z: p.z, y: p.y, rot: p.rot, h: p.h };
      })
    };
  }

  function save() {
    clearTimeout(saveTimer);
    try { localStorage.setItem(STORE_KEY, JSON.stringify(serialize())); }
    catch (e) { /* 용량 초과·차단된 저장소 — 무시하고 계속 */ }
  }

  function loadImage(src) {
    return new Promise(function (res, rej) {
      var i = new Image();
      i.onload = function () { res(i); };
      i.onerror = rej;
      i.src = src;
    });
  }

  function restore(state) {
    if (!state || !state.items) return Promise.resolve(false);
    room.size = state.room && state.room.size || 12;
    room.palette = (state.room && PALETTES[state.room.palette]) ? state.room.palette : 'wood';
    buildRoom();
    syncRoomUI();

    return Promise.all(state.items.map(function (rec) {
      return loadImage(rec.png).then(function (img) {
        var opt = rec.opt || { grid: Math.max(img.width, img.height), depth: 11, mode: 'inflate' };
        opt = {
          grid: Math.max(img.width, img.height),
          depth: opt.depth, mode: opt.mode,
          alphaOnly: true, removeBg: true, tolerance: 60, trim: false
        };
        var data = voxelize(img, opt);
        if (!data) return null;
        var item = {
          id: rec.id, name: rec.name, data: data,
          opt: { depth: opt.depth, mode: opt.mode }, thumb: makeThumb(data),
          traits: rec.traits || {}, tracks: rec.tracks || []
        };
        items.push(item);
        return item;
      }).catch(function () { return null; });
    })).then(function () {
      renderInventory();
      (state.placed || []).forEach(function (rec) {
        var it = itemById(rec.itemId);
        if (!it) return;
        var p = placeItem(it, rec.x, rec.z, { key: rec.key, y: rec.y, rot: rec.rot, h: rec.h });
        applyTransform(p);
      });
      return items.length > 0;
    });
  }

  function exportRoom() {
    var json = JSON.stringify(serialize());
    var name = 'my-voxel-room.json';
    // 아티팩트 안에서는 페이지가 직접 시작하는 다운로드가 막혀 있어 전용 통로를 쓴다
    if (window.claude && window.claude.use) {
      window.claude.use('downloads').then(function (dl) {
        if (!dl) { toast('이 화면에서는 파일 저장이 허용되지 않았습니다.'); return; }
        return dl.save({ filename: name, data: json }).then(function () {
          toast('방 파일을 저장했습니다.');
        });
      }).catch(function () { toast('저장이 취소되었습니다.'); });
      return;
    }
    try {
      var blob = new Blob([json], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast('방 파일을 내려받았습니다.');
    } catch (e) {
      toast('이 화면에서는 파일 저장이 막혀 있습니다.');
    }
  }

  function importRoom(file) {
    var fr = new FileReader();
    fr.onload = function () {
      var state;
      try { state = JSON.parse(fr.result); }
      catch (e) { toast('방 파일을 읽지 못했습니다.'); return; }
      resetAll(true);
      restore(state).then(function () { save(); toast('방을 불러왔습니다.'); });
    };
    fr.readAsText(file);
  }

  function resetAll(keepStorage) {
    stopMusic();
    placed.slice().forEach(function (p) {
      scene.remove(p.group); p.mesh.dispose(); p.mesh.material.dispose();
    });
    placed.length = 0;
    if (!keepStorage) items.forEach(function (it) { (it.tracks || []).forEach(function (t) { idbDel(t.id); }); });
    items.length = 0;
    setActiveChar(null);
    releaseKeys();
    select(null);
    renderInventory();
    if (!keepStorage) { try { localStorage.removeItem(STORE_KEY); } catch (e) {} }
  }

  /* ================================================================
     7. 변환 스튜디오
     ================================================================ */

  var studio = {
    open: false, img: null, data: null, timer: null, name: '',
    renderer: null, scene: null, camera: null, group: null, mesh: null,
    yaw: -0.5, pitch: 0.22, autoYaw: true, dragging: null, dist: 100, lights: null
  };

  function initStudio() {
    var canvas = $('#preview');
    studio.renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    studio.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    studio.renderer.outputColorSpace = T.SRGBColorSpace;
    studio.scene = new T.Scene();
    studio.camera = new T.PerspectiveCamera(30, 1, 0.5, 4000);
    studio.group = new T.Group();
    studio.scene.add(studio.group);
    var h = new T.HemisphereLight(0xe4ecff, 0x77809b, 1.0);
    var k = new T.DirectionalLight(0xfff4e2, 1.2); k.position.set(-0.55, 0.95, 0.75);
    var f = new T.DirectionalLight(0xc9d8ff, 0.42); f.position.set(0.8, 0.15, 0.55);
    studio.scene.add(h, k, f);

    canvas.addEventListener('pointerdown', function (e) {
      studio.dragging = { x: e.clientX, y: e.clientY, yaw: studio.yaw, pitch: studio.pitch };
      studio.autoYaw = false;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!studio.dragging) return;
      studio.yaw = studio.dragging.yaw + (e.clientX - studio.dragging.x) * 0.011;
      studio.pitch = clamp(studio.dragging.pitch + (e.clientY - studio.dragging.y) * 0.011, -1.3, 1.3);
    });
    canvas.addEventListener('pointerup', function () { studio.dragging = null; });
    canvas.addEventListener('pointercancel', function () { studio.dragging = null; });
  }

  function renderStudio() {
    var canvas = $('#preview');
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    if (canvas.width !== Math.round(w * studio.renderer.getPixelRatio())) {
      studio.renderer.setSize(w, h, false);
      studio.camera.aspect = w / h;
      studio.camera.updateProjectionMatrix();
    }
    if (studio.autoYaw && !REDUCED) studio.yaw += 0.006;
    studio.group.rotation.set(studio.pitch, studio.yaw, 0);
    studio.camera.position.set(0, 0, studio.dist);
    studio.camera.lookAt(0, 0, 0);
    studio.renderer.render(studio.scene, studio.camera);
  }

  function studioOptions() {
    return {
      grid: +$('#opt-grid').value,
      depth: +$('#opt-depth').value,
      mode: $('.seg [aria-pressed="true"]').dataset.mode,
      removeBg: $('#opt-bg').checked,
      tolerance: +$('#opt-tol').value,
      trim: $('#opt-trim').checked
    };
  }

  function rebuildPreview() {
    if (!studio.img) return;
    var opt = studioOptions();
    $('#opt-grid-v').textContent = opt.grid;
    $('#opt-depth-v').textContent = opt.depth;
    $('#opt-tol-v').textContent = opt.tolerance;
    $('#tol-row').hidden = !opt.removeBg;
    $('#trim-row').hidden = !opt.removeBg;
    $('#studio-status').textContent = '깎는 중…';

    clearTimeout(studio.timer);
    studio.timer = setTimeout(function () {
      var data;
      try { data = voxelize(studio.img, opt); }
      catch (err) { $('#studio-status').textContent = '변환에 실패했습니다.'; return; }
      if (!data) {
        $('#studio-status').textContent = '남는 부분이 없습니다. 배경 판정 민감도를 낮춰 보세요.';
        $('#make').disabled = true;
        return;
      }
      studio.data = data;
      studio.opt = { depth: opt.depth, mode: opt.mode };
      $('#make').disabled = false;
      if (studio.mesh) {
        studio.group.remove(studio.mesh);
        studio.mesh.material.dispose();
        studio.mesh.dispose();
      }
      studio.mesh = buildMesh(data, false);
      studio.mesh.position.y = -data.gh / 2;
      studio.group.add(studio.mesh);
      studio.dist = Math.max(data.gw, data.gh) * 2.4;
      $('#studio-status').innerHTML = '복셀 <b>' + fmt(data.count) + '</b>개 · 격자 ' + data.gw + '×' + data.gh;
    }, 90);
  }

  function openStudio(img, name) {
    studio.img = img;
    studio.autoYaw = true;
    studio.yaw = -0.5; studio.pitch = 0.22;
    studio.name = (name || '').replace(/\.[a-z0-9]+$/i, '').slice(0, 24) || ('오브제 ' + (items.length + 1));
    $('#obj-name').value = studio.name;
    document.body.classList.add('studio-open');
    studio.open = true;
    $('#studio').removeAttribute('hidden');
    var thumb = $('#src-thumb');
    thumb.innerHTML = '';
    var c = document.createElement('canvas');
    var sc = Math.min(1, 88 / Math.max(img.width, img.height));
    c.width = Math.max(1, Math.round(img.width * sc));
    c.height = Math.max(1, Math.round(img.height * sc));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    thumb.appendChild(c);
    rebuildPreview();
  }

  function closeStudio() {
    document.body.classList.remove('studio-open');
    studio.open = false;
    $('#studio').setAttribute('hidden', '');
  }

  function makeFromStudio() {
    if (!studio.data) return;
    var item = addItem(studio.data, ($('#obj-name').value || '').trim() || studio.name);
    item.opt = studio.opt;
    studio.data = null;
    closeStudio();
    takeOut(item);
  }

  /* ------------------------------------------------------- 파일 / 알림 */
  function loadFile(file) {
    if (!file || !/^image\//.test(file.type)) { toast('이미지 파일만 올릴 수 있습니다.'); return; }
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () { openStudio(img, file.name); };
    img.onerror = function () { toast('이미지를 읽지 못했습니다.'); };
    img.src = url;
  }

  // 아티팩트는 샌드박스 iframe이라 window.confirm 이 막힌다 — 자체 다이얼로그를 쓴다
  var askResolve = null;
  function ask(msg, okLabel) {
    var box = $('#askbox');
    $('#ask-msg').textContent = msg;
    $('#ask-ok').textContent = okLabel || '확인';
    box.removeAttribute('hidden');
    $('#ask-ok').focus();
    return new Promise(function (res) { askResolve = res; });
  }
  function answer(v) {
    $('#askbox').setAttribute('hidden', '');
    if (askResolve) { askResolve(v); askResolve = null; }
  }

  var toastTimer;
  function toast(msg) {
    var el = $('#toast');
    el.textContent = msg;
    el.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('is-on'); }, 3400);
  }

  /* ================================================================
     8. 기본 오브제
     ================================================================ */

  function newCanvas(s) { var c = document.createElement('canvas'); c.width = c.height = s; return c; }

  function drawMushroom() {
    var c = newCanvas(360), x = c.getContext('2d');
    x.fillStyle = '#F6E9CE';
    x.beginPath();
    x.moveTo(126, 196); x.lineTo(234, 196);
    x.quadraticCurveTo(246, 300, 208, 318); x.lineTo(152, 318);
    x.quadraticCurveTo(114, 300, 126, 196); x.fill();
    x.fillStyle = '#E4E0D0'; x.fillRect(126, 196, 26, 100);
    x.fillStyle = '#D9484B';
    x.beginPath(); x.moveTo(40, 200);
    x.quadraticCurveTo(46, 62, 180, 58);
    x.quadraticCurveTo(314, 62, 320, 200);
    x.quadraticCurveTo(180, 226, 40, 200); x.fill();
    x.fillStyle = '#C13B3F';
    x.beginPath(); x.moveTo(40, 200);
    x.quadraticCurveTo(180, 228, 320, 200);
    x.quadraticCurveTo(180, 214, 40, 200); x.fill();
    x.fillStyle = '#FBF3E4';
    [[104, 132, 30], [188, 106, 38], [262, 148, 26], [148, 176, 18], [236, 190, 15]].forEach(function (s) {
      x.beginPath(); x.ellipse(s[0], s[1], s[2], s[2] * 0.86, 0, 0, 6.3); x.fill();
    });
    x.fillStyle = '#3A3140';
    x.beginPath(); x.ellipse(154, 246, 9, 13, 0, 0, 6.3); x.fill();
    x.beginPath(); x.ellipse(206, 246, 9, 13, 0, 0, 6.3); x.fill();
    x.fillStyle = '#F2A6A8';
    x.beginPath(); x.ellipse(132, 264, 12, 8, 0, 0, 6.3); x.fill();
    x.beginPath(); x.ellipse(228, 264, 12, 8, 0, 0, 6.3); x.fill();
    return c;
  }

  function drawPlant() {
    var c = newCanvas(360), x = c.getContext('2d');
    x.fillStyle = '#C77B4E';
    x.beginPath();
    x.moveTo(112, 226); x.lineTo(248, 226);
    x.lineTo(226, 330); x.lineTo(134, 330); x.closePath(); x.fill();
    x.fillStyle = '#B06A41'; x.fillRect(112, 226, 30, 104);
    x.fillStyle = '#DE9068';
    x.fillRect(104, 212, 152, 26);
    x.fillStyle = '#4E9E63';
    [[180, 96, 46, 120, 0], [124, 132, 40, 96, -0.5], [238, 136, 40, 96, 0.5],
     [148, 168, 32, 74, -0.8], [214, 170, 32, 74, 0.8]].forEach(function (s) {
      x.save(); x.translate(s[0], s[1]); x.rotate(s[4]);
      x.beginPath(); x.ellipse(0, 0, s[2], s[3], 0, 0, 6.3); x.fill(); x.restore();
    });
    x.fillStyle = '#3F855230'; x.globalAlpha = 0.45;
    x.beginPath(); x.ellipse(200, 120, 24, 80, 0.2, 0, 6.3); x.fill();
    x.globalAlpha = 1;
    return c;
  }

  function drawStar() {
    var c = newCanvas(300), x = c.getContext('2d');
    function star(cx, cy, R, r, fill) {
      x.beginPath();
      for (var i = 0; i < 10; i++) {
        var a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r : R;
        x[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
      }
      x.closePath(); x.fillStyle = fill; x.fill();
    }
    star(150, 152, 132, 56, '#E39A2A');
    star(150, 146, 116, 48, '#F5C24E');
    star(150, 140, 76, 31, '#FBE08A');
    return c;
  }

  function drawLamp() {
    var c = newCanvas(360), x = c.getContext('2d');
    x.fillStyle = '#8A8FA8';
    x.fillRect(168, 150, 24, 160);
    x.fillStyle = '#6E7389';
    x.beginPath(); x.ellipse(180, 322, 62, 20, 0, 0, 6.3); x.fill();
    x.fillStyle = '#F2D68C';
    x.beginPath();
    x.moveTo(112, 148); x.lineTo(248, 148);
    x.lineTo(214, 52); x.lineTo(146, 52); x.closePath(); x.fill();
    x.fillStyle = '#E4C06B';
    x.beginPath(); x.moveTo(112, 148); x.lineTo(146, 52); x.lineTo(164, 52); x.lineTo(140, 148); x.closePath(); x.fill();
    x.fillStyle = '#FFF3CE';
    x.fillRect(126, 138, 108, 12);
    return c;
  }

  function drawSpeaker() {
    var c = newCanvas(320), x = c.getContext('2d');
    x.fillStyle = '#6E5B4B';
    x.fillRect(80, 48, 160, 240);
    x.fillStyle = '#5A4A3D';
    x.fillRect(80, 48, 26, 240);
    x.fillStyle = '#3A3F4A';
    x.beginPath(); x.arc(160, 168, 58, 0, 6.3); x.fill();
    x.fillStyle = '#2A2E38';
    x.beginPath(); x.arc(160, 168, 34, 0, 6.3); x.fill();
    x.fillStyle = '#8A929E';
    x.beginPath(); x.arc(160, 168, 14, 0, 6.3); x.fill();
    x.fillStyle = '#3A3F4A';
    x.beginPath(); x.arc(160, 88, 22, 0, 6.3); x.fill();
    x.fillStyle = '#D8A24A';
    x.beginPath(); x.arc(128, 254, 12, 0, 6.3); x.fill();
    x.beginPath(); x.arc(192, 254, 12, 0, 6.3); x.fill();
    return c;
  }

  function canvasToImage(c) { return loadImage(c.toDataURL()); }

  function seedRoom() {
    var specs = [
      { draw: drawMushroom, name: '버섯', grid: 60, depth: 13, h: 2.4, x: -1.5, z: 1.5, traits: { character: true } },
      { draw: drawSpeaker, name: '스피커', grid: 56, depth: 16, h: 2.2, x: 3.5, z: -3, traits: { music: true } },
      { draw: drawPlant, name: '화분', grid: 60, depth: 14, h: 3.0, x: -4, z: -3 },
      { draw: drawLamp, name: '스탠드', grid: 56, depth: 12, h: 3.4, x: 4, z: 2 },
      { draw: drawStar, name: '별', grid: 44, depth: 11, h: 1.2, x: 0.5, z: -2 }
    ];
    return specs.reduce(function (chain, s) {
      return chain.then(function () {
        return canvasToImage(s.draw()).then(function (img) {
          var data = voxelize(img, { grid: s.grid, depth: s.depth, mode: 'inflate', removeBg: true, tolerance: 60, trim: false });
          if (!data) return;
          var item = addItem(data, s.name);
          item.opt = { depth: s.depth, mode: 'inflate' };
          item.traits = s.traits || {};
          var p = placeItem(item, s.x, s.z, { h: s.h });
          moveTo(p, s.x, s.z);
        });
      });
    }, Promise.resolve()).then(function () {
      renderInventory();
      select(null);
      save();
    });
  }

  /* ================================================================
     9. UI 배선
     ================================================================ */

  function syncRoomUI() {
    $$('#size-seg button').forEach(function (b) {
      b.setAttribute('aria-pressed', +b.dataset.size === room.size ? 'true' : 'false');
    });
    $$('.pal button').forEach(function (b) {
      b.setAttribute('aria-pressed', b.dataset.pal === room.palette ? 'true' : 'false');
    });
  }

  function initUI() {
    var input = $('#file');
    $$('[data-open-file]').forEach(function (b) {
      b.addEventListener('click', function () { input.value = ''; input.click(); });
    });
    input.addEventListener('change', function () { loadFile(input.files[0]); });

    var roomInput = $('#roomfile');
    $('#import').addEventListener('click', function () { roomInput.value = ''; roomInput.click(); });
    roomInput.addEventListener('change', function () { if (roomInput.files[0]) importRoom(roomInput.files[0]); });
    $('#export').addEventListener('click', exportRoom);

    // 드롭 / 붙여넣기
    var dz = $('#dropveil'), dcount = 0;
    window.addEventListener('dragenter', function (e) {
      if (!e.dataTransfer || Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') < 0) return;
      dcount++; dz.classList.add('is-on');
    });
    window.addEventListener('dragover', function (e) { e.preventDefault(); });
    window.addEventListener('dragleave', function () { dcount = Math.max(0, dcount - 1); if (!dcount) dz.classList.remove('is-on'); });
    window.addEventListener('drop', function (e) {
      e.preventDefault(); dcount = 0; dz.classList.remove('is-on');
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f && /^image\//.test(f.type)) loadFile(f);
      else if (f && /json$/i.test(f.name)) importRoom(f);
    });
    window.addEventListener('paste', function (e) {
      var it = e.clipboardData && e.clipboardData.items;
      if (!it) return;
      for (var i = 0; i < it.length; i++) {
        if (it[i].type.indexOf('image') === 0) { loadFile(it[i].getAsFile()); break; }
      }
    });

    // 스튜디오
    ['#opt-grid', '#opt-depth', '#opt-tol'].forEach(function (s) { $(s).addEventListener('input', rebuildPreview); });
    ['#opt-bg', '#opt-trim'].forEach(function (s) { $(s).addEventListener('change', rebuildPreview); });
    $$('.seg button').forEach(function (b) {
      b.addEventListener('click', function () {
        $$('.seg button').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
        b.setAttribute('aria-pressed', 'true');
        $('#mode-note').textContent = b.dataset.note;
        rebuildPreview();
      });
    });
    $('#make').addEventListener('click', makeFromStudio);
    $('#cancel').addEventListener('click', closeStudio);
    $('#studio-close').addEventListener('click', closeStudio);

    // 오브제 조작 바
    $('#objbar').addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b || !selected) return;
      var a = b.dataset.act;
      if (a === 'rot-l') rotate(-1);
      else if (a === 'rot-r') rotate(1);
      else if (a === 'copy') {
        var it = itemById(selected.itemId);
        if (it) {
          var f = footprint(selected);
          var nx = selected.x + Math.max(1, f.w) + 0.5, nz = selected.z;
          var p = placeItem(it, nx, nz, { rot: selected.rot, h: selected.h });
          moveTo(p, nx, nz);
          select(p); save();
        }
      }
      else if (a === 'del') removePlaced(selected);
      else if (a === 'done') select(null);
    });
    $('#size').addEventListener('input', function () { setSize(+this.value); });

    // 방 설정
    $$('#size-seg button').forEach(function (b) {
      b.addEventListener('click', function () {
        room.size = +b.dataset.size;
        buildRoom(); syncRoomUI(); updateCamera(); save();
      });
    });
    $$('.pal button').forEach(function (b) {
      b.addEventListener('click', function () {
        room.palette = b.dataset.pal;
        buildRoom(); syncRoomUI(); save();
      });
    });
    $('#cam-reset').addEventListener('click', function () {
      view.yaw = 0; view.pitch = 0.58; view.zoom = 1; updateCamera();
    });
    $('#wipe').addEventListener('click', function () {
      ask('보관함과 방을 모두 비웁니다. 되돌릴 수 없습니다.', '비우기').then(function (ok) {
        if (!ok) return;
        stopMusic();
        resetAll(false);
        save();
        toast('방을 비웠습니다.');
      });
    });
    $('#ask-ok').addEventListener('click', function () { answer(true); });
    $('#ask-no').addEventListener('click', function () { answer(false); });
    $('#panel-toggle').addEventListener('click', function () {
      var open = document.body.classList.toggle('panel-open');
      this.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    // 입력
    var c = $('#stage');
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', releaseKeys);
    c.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    /* --------------------------------------------------------- 속성 */
    $('#objbar').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-act="traits"]');
      if (!b) return;
      var box = $('#traits');
      box.hidden = !box.hidden;
      if (!box.hidden) renderTraitPanel();
    });
    $('#tr-character').addEventListener('change', function () {
      var it = selectedItem();
      if (it) setTrait(it, 'character', this.checked);
    });
    $('#tr-music').addEventListener('change', function () {
      var it = selectedItem();
      if (it) setTrait(it, 'music', this.checked);
    });
    $('#charbadge-release').addEventListener('click', function () { setActiveChar(null); releaseKeys(); });

    /* ----------------------------------------------------- 음악 조작 */
    var audioInput = $('#audiofile');
    $('#pl-add').addEventListener('click', function () { audioInput.value = ''; audioInput.click(); });
    audioInput.addEventListener('change', function () {
      var it = selectedItem();
      if (it && audioInput.files.length) addTracks(it, audioInput.files);
    });
    $('#pl-toggle').addEventListener('click', togglePlay);
    $('#pl-prev').addEventListener('click', function () { step(-1); });
    $('#pl-next').addEventListener('click', function () { step(1); });
    $('#pl-one').addEventListener('click', function () {
      music.one = !music.one;
      this.setAttribute('aria-pressed', music.one ? 'true' : 'false');
    });
    $('#pl-seek').addEventListener('input', function () {
      if (music.audio && isFinite(music.audio.duration)) music.audio.currentTime = +this.value;
    });
    $('#pl-vol').addEventListener('input', function () {
      if (music.audio) music.audio.volume = +this.value;
    });
    $('#np-toggle').addEventListener('click', function () {
      if (!music.audio.src) return;
      if (music.audio.paused) music.audio.play().catch(function () {});
      else music.audio.pause();
    });
    $('#np-stop').addEventListener('click', stopMusic);
  }

  /* ------------------------------------------------------------ 루프 */
  var clock;
  function tick() {
    requestAnimationFrame(tick);
    var dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime;
    updateCharacters(dt, t);
    updateMusicObjects(dt, t);
    if (selected) updateMarker();
    lights.key.target.position.set(0, 0, 0);
    lights.key.target.updateMatrixWorld();
    renderer.render(scene, camera);
    if (studio.open) renderStudio();
  }

  function boot() {
    if (!T) return;
    clock = new T.Clock();
    initScene();
    initMarker();
    initStudio();
    initMusic();
    initUI();
    syncRoomUI();
    updateCamera();
    tick();

    // 콘솔에서 방 상태를 들여다볼 수 있는 읽기 전용 창구
    window.voxelRoom = {
      get placed() { return placed; },
      get items() { return items; },
      get music() { return music; },
      get activeChar() { return activeChar; },
      get selected() { return selected; },
      get view() { return view; },
      get room() { return room; },
      get camera() { return camera; }
    };

    var saved = null;
    try { saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) {}
    var start = saved ? restore(saved) : Promise.resolve(false);
    start.then(function (ok) {
      if (!ok) return seedRoom();
    }).catch(function () { return seedRoom(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
