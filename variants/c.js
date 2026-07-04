export function buildCharacter(THREE) {
  // ---------- materials: gummy vinyl, subtle two-tone (torso darker) ----------
  const mkGummy = (color) => new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.38,
    metalness: 0.0,
    clearcoat: 0.9,
    clearcoatRoughness: 0.32,
    sheen: 0.55,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color(0xff7a66),
    envMapIntensity: 0.9,
    specularIntensity: 0.8
  });
  const matBody = mkGummy(0xe0241d);
  const matTorso = mkGummy(0xc11a13);      // darker torso helps the belly read
  const matEye = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.2, metalness: 0,
    clearcoat: 0.5, clearcoatRoughness: 0.25, envMapIntensity: 0.7
  });

  const shadow = (m, recv) => { m.castShadow = true; if (recv) m.receiveShadow = true; return m; };

  // ---------- proportions (total height ~2.32, head ~39% and wider than torso) ----------
  const HIP_Y = 0.60;
  const TORSO_BASE = 0.42;
  const UPPER_Y = 0.55;                    // waist pivot: jelly bend happens here
  const SHOULDER_Y = 1.32, SHOULDER_X = 0.375;
  const NECK_Y = 1.46;
  const HEAD_R = 0.48, HEAD_LIFT = 0.40, HEAD_SQUASH = 0.95;
  const HEAD_TILT = 0.08;                  // permanent charm tilt

  const root = new THREE.Group();
  const rig = new THREE.Group();           // ground-pivot group: all wobble lives below root
  root.add(rig);
  const upper = new THREE.Group();         // waist pivot
  upper.position.y = UPPER_Y;
  rig.add(upper);

  // ---------- torso: lathe with a low round belly, tapering to the shoulders ----------
  const prof = [
    [0.001, 0.00], [0.16, 0.02], [0.28, 0.08], [0.345, 0.20],
    [0.37, 0.34],                          // belly max sits in the lower third
    [0.355, 0.52], [0.33, 0.70], [0.30, 0.84], [0.24, 0.96],
    [0.12, 1.03], [0.001, 1.05]
  ].map(p => new THREE.Vector2(p[0], p[1]));
  const torsoGeo = new THREE.LatheGeometry(new THREE.SplineCurve(prof).getPoints(40), 40);
  torsoGeo.scale(1, 1, 0.86);              // rounded slab: flattened front-to-back
  const torso = shadow(new THREE.Mesh(torsoGeo, matTorso), true);
  torso.position.y = TORSO_BASE - UPPER_Y;
  upper.add(torso);

  // ---------- head: no neck, sits straight on the shoulders, wider than the torso ----------
  const headPivot = new THREE.Group();
  headPivot.position.y = NECK_Y - UPPER_Y;
  upper.add(headPivot);
  const headGeo = new THREE.SphereGeometry(HEAD_R, 48, 32);
  headGeo.scale(1, HEAD_SQUASH, 1);
  const head = shadow(new THREE.Mesh(headGeo, matBody));
  head.position.y = HEAD_LIFT;
  headPivot.add(head);

  // eyes: wide-set vertical ovals placed ON the ellipsoid surface, facing outward
  const eyeGeo = new THREE.SphereGeometry(0.085, 24, 18);
  eyeGeo.scale(0.62, 1.3, 0.42);
  const EYE_YAW = 0.46, EYE_PITCH = 0.22;  // wider apart than variants A/B
  for (const s of [-1, 1]) {
    const eye = shadow(new THREE.Mesh(eyeGeo, matEye));
    const cp = Math.cos(EYE_PITCH), r = HEAD_R * 0.988;
    eye.position.set(
      Math.sin(EYE_YAW * s) * cp * r,
      Math.sin(EYE_PITCH) * r * HEAD_SQUASH + HEAD_LIFT,
      Math.cos(EYE_YAW * s) * cp * r
    );
    eye.rotation.order = 'YXZ';
    eye.rotation.y = EYE_YAW * s;
    eye.rotation.x = -EYE_PITCH;
    headPivot.add(eye);
  }

  // ---------- arms: stubby, pivoted at the shoulders, mitten fists at hip height ----------
  const armGeo = new THREE.CapsuleGeometry(0.12, 0.30, 6, 24);
  const fistGeo = new THREE.SphereGeometry(0.15, 24, 18);
  fistGeo.scale(1.0, 1.15, 1.05);
  const ARM_SPLAY = 0.19;                  // hangs just clear of the belly
  const arms = [];
  for (const s of [-1, 1]) {
    const p = new THREE.Group();
    p.position.set(SHOULDER_X * s, SHOULDER_Y - UPPER_Y, 0);
    const arm = shadow(new THREE.Mesh(armGeo, matBody));
    arm.position.y = -0.24;
    const fist = shadow(new THREE.Mesh(fistGeo, matBody));
    fist.position.y = -0.56;
    p.add(arm, fist);
    p.rotation.z = ARM_SPLAY * s;
    arms.push(p);
    upper.add(p);
  }

  // ---------- legs: chunky sumo stance, hip pivots, big flat-soled feet ----------
  const legGeo = new THREE.CapsuleGeometry(0.15, 0.24, 6, 24);
  const footGeo = new THREE.SphereGeometry(0.21, 28, 20);
  footGeo.scale(1.08, 0.55, 1.5);          // sole bottom = 0.1155 below foot center
  for (const s of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(0.27 * s, HIP_Y, 0);
    const leg = shadow(new THREE.Mesh(legGeo, matBody), true);
    leg.position.set(0.045 * s, -0.20, 0);
    leg.rotation.z = 0.13 * s;             // splayed outward, sumo
    const foot = shadow(new THREE.Mesh(footGeo, matBody), true);
    foot.position.set(0.07 * s, -(HIP_Y - 0.116), 0.09);
    foot.rotation.y = 0.12 * s;            // toes slightly out
    hip.add(leg, foot);
    rig.add(hip);
  }

  // ---------- jelly springs ----------
  const spr = {
    lx: 0, lvx: 0, lz: 0, lvz: 0,          // whole-body lean (rot about x / z)
    hx: 0, hvx: 0, hz: 0, hvz: 0,          // head chase spring: softer -> lag + overshoot
    sq: 0, sqv: 0                          // squash & stretch
  };
  const K_L = 48, C_L = 3.9;               // ~1.1 Hz, underdamped: a few visible overshoots
  const K_H = 30, C_H = 2.7, HEAD_GAIN = 0.85;
  const K_S = 90, C_S = 6.5;
  const clamp = (v, a) => Math.max(-a, Math.min(a, v));

  function update(t, dt) {
    dt = Math.min(Math.max(dt || 0.016, 1e-4), 0.05);

    // semi-implicit Euler springs
    spr.lvx += (-K_L * spr.lx - C_L * spr.lvx) * dt;
    spr.lvz += (-K_L * spr.lz - C_L * spr.lvz) * dt;
    spr.lx = clamp(spr.lx + spr.lvx * dt, 0.30);
    spr.lz = clamp(spr.lz + spr.lvz * dt, 0.30);

    spr.hvx += (K_H * (HEAD_GAIN * spr.lx - spr.hx) - C_H * spr.hvx) * dt;
    spr.hvz += (K_H * (HEAD_GAIN * spr.lz - spr.hz) - C_H * spr.hvz) * dt;
    spr.hx = clamp(spr.hx + spr.hvx * dt, 0.35);
    spr.hz = clamp(spr.hz + spr.hvz * dt, 0.35);

    spr.sqv += (-K_S * spr.sq - C_S * spr.sqv) * dt;
    spr.sq = clamp(spr.sq + spr.sqv * dt, 0.12);

    const br = Math.sin(t * 1.6) + 0.3 * Math.sin(t * 3.2 + 0.5); // uneven breath

    // lean split: 35% at the ankles, 90% at the waist -> jelly bend, feet stay planted
    const rx = spr.lx * 0.35 + Math.sin(t * 0.52 + 0.4) * 0.011;
    const rz = spr.lz * 0.35 + Math.sin(t * 0.61 + 1.9) * 0.013;
    rig.rotation.x = rx;
    rig.rotation.z = rz;
    rig.rotation.y = Math.sin(t * 0.37) * 0.02;
    // lift so no foot corner dips under the floor when tipping at the ground pivot
    rig.position.y = Math.sin(Math.abs(rz)) * 0.57 + Math.sin(Math.abs(rx)) * 0.42;
    rig.scale.set(1 - spr.sq * 0.55, 1 + spr.sq, 1 - spr.sq * 0.55);

    upper.rotation.x = spr.lx * 0.9 + Math.sin(t * 0.44 + 2.6) * 0.010;
    upper.rotation.z = spr.lz * 0.9 + Math.sin(t * 0.57 + 0.8) * 0.011;

    // breathing squash: torso mesh only (scales up from its base)
    torso.scale.set(1 - br * 0.010, 1 + br * 0.018, 1 - br * 0.007);

    // head: laggy chase spring + slow lazy bobble on top of the permanent tilt
    headPivot.position.y = (NECK_Y - UPPER_Y) + br * 0.02;
    headPivot.rotation.x = spr.hx + Math.sin(t * 0.83 + 0.9) * 0.028;
    headPivot.rotation.z = HEAD_TILT + spr.hz + Math.sin(t * 0.71 + 2.2) * 0.018;
    headPivot.rotation.y = Math.sin(t * 0.35 + 4.0) * 0.03;

    // arms: out-of-phase sway, plus floppy reaction against fast head motion
    const flop = -spr.hvx * 0.05;
    const lift = br * 0.012;
    arms[0].rotation.x = Math.sin(t * 1.15) * 0.045 + flop;
    arms[1].rotation.x = Math.sin(t * 1.15 + 2.4) * 0.045 + flop;
    arms[0].rotation.z = -ARM_SPLAY - lift - spr.hvz * 0.04;
    arms[1].rotation.z = ARM_SPLAY + lift - spr.hvz * 0.04;
    arms[0].position.y = (SHOULDER_Y - UPPER_Y) + lift;
    arms[1].position.y = (SHOULDER_Y - UPPER_Y) + lift;
  }

  function poke(dir) {
    const len = Math.hypot(dir.x, dir.z) || 1;
    const px = dir.x / len, pz = dir.z / len;
    spr.lvx += pz * 1.5;                   // body tips away along the push
    spr.lvz += -px * 1.5;
    spr.hvx += pz * 1.0;                   // head gets its own kick -> lags and overshoots
    spr.hvz += -px * 1.0;
    spr.sqv -= 1.1;                        // quick compress, spring rebounds into stretch
  }

  return { group: root, update, poke };
}
