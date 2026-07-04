// Gang Beasts-style gummy beast. No imports — receives THREE, returns { group, update, poke }.
// Final design merged from a 3-variant exploration: wide planted stance + toes-out feet +
// permanent head tilt (variant C), head sunk into the shoulders (B), inertial head-chase
// spring for the bobble (A), silhouette/eyes/deep-red material from the baseline.
export function buildCharacter(THREE) {
  const group = new THREE.Group();

  const body = new THREE.MeshPhysicalMaterial({
    color: 0xb8140f,
    roughness: 0.36,
    clearcoat: 0.3,
    clearcoatRoughness: 0.55,
    sheen: 0.35,
    sheenRoughness: 0.6,
    sheenColor: new THREE.Color(0xff5a4a),
    envMapIntensity: 0.5,
  });
  const eyeMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.22,
    clearcoat: 0.5,
    envMapIntensity: 0.6,
  });

  const mesh = (geo, mat = body) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    return m;
  };

  // --- pelvis + legs: wide sumo-ish stance, toes slightly out ---
  const pelvis = mesh(new THREE.SphereGeometry(0.34, 32, 24));
  pelvis.scale.set(1.15, 0.7, 0.92);
  pelvis.position.y = 0.72;
  group.add(pelvis);

  const legs = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(0.26 * side, 0.78, 0);
    const leg = mesh(new THREE.CapsuleGeometry(0.175, 0.42, 8, 24));
    leg.position.y = -0.38;
    const foot = mesh(new THREE.SphereGeometry(0.23, 32, 24));
    foot.scale.set(1.08, 0.52, 1.45);
    foot.position.set(0.02 * side, -0.66, 0.1);
    foot.rotation.y = 0.1 * side; // toes out
    hip.add(leg, foot);
    hip.rotation.z = -0.05 * side; // outward splay
    group.add(hip);
    legs.push(hip);
  }

  // --- torso: lathe blob, slightly flattened front-to-back ---
  const profile = [
    [0.001, 0], [0.30, 0.03], [0.43, 0.16], [0.475, 0.45],
    [0.44, 0.72], [0.30, 0.87], [0.001, 0.92],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const torso = mesh(new THREE.LatheGeometry(profile, 48));
  torso.scale.z = 0.8;
  torso.position.y = 0.62;
  group.add(torso);

  // --- arms: pivot at shoulder so they swing from the joint ---
  const arms = [];
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(0.45 * side, 1.36, 0);
    const arm = mesh(new THREE.CapsuleGeometry(0.15, 0.40, 8, 24));
    arm.position.y = -0.30;
    const fist = mesh(new THREE.SphereGeometry(0.20, 32, 24));
    fist.scale.set(1.0, 1.08, 1.0);
    fist.position.y = -0.68;
    shoulder.add(arm, fist);
    group.add(shoulder);
    arms.push({ pivot: shoulder, side, hang: 0.15 * side }); // resting outward hang
  }

  // --- head: oversized, wider than the torso, sunk into the shoulders, no neck ---
  const headPivot = new THREE.Group();
  headPivot.position.y = 1.46;
  const HEAD_R = 0.56;
  const head = mesh(new THREE.SphereGeometry(HEAD_R, 48, 32));
  head.scale.set(1.06, 1.03, 0.97);
  head.position.y = 0.44;
  headPivot.add(head);

  for (const side of [-1, 1]) {
    const eye = mesh(new THREE.SphereGeometry(0.115, 24, 16), eyeMat);
    eye.scale.set(1, 1.15, 0.42);
    const ex = 0.21 * side, ey = 0.12;
    const ez = Math.sqrt(HEAD_R * HEAD_R - ex * ex - ey * ey) * 0.97;
    eye.position.set(ex * 1.06, 0.44 + ey, ez);
    eye.lookAt(ex * 3, 0.44 + ey * 3, ez * 3); // face outward from head center
    headPivot.add(eye);
  }
  group.add(headPivot);

  // --- jelly springs ---
  // lean: whole body tips at the feet. head: a softer spring CHASES the lean, so the
  // bobblehead counter-tilts from inertia first, then whips past with extra gain.
  const s = {
    lx: 0, lvx: 0, lz: 0, lvz: 0,   // body lean
    hx: 0, hvx: 0, hz: 0, hvz: 0,   // head chase
    sq: 0, sqv: 0,                  // squash & stretch
  };
  const LEAN_K = 42, LEAN_C = 3.6;
  const HEAD_K = 40, HEAD_C = 3.2, HEAD_FOLLOW = 0.9, HEAD_GAIN = 1.9;
  const SQ_K = 70, SQ_C = 5.5;
  const TILT = 0.05; // permanent charm tilt

  function poke(dir) {
    s.lvx += dir.x * 3.6;
    s.lvz += dir.z * 3.6;
    s.sqv -= 2.0;
  }

  function update(t, dt) {
    dt = Math.min(dt, 0.05);

    s.lvx += (-LEAN_K * s.lx - LEAN_C * s.lvx) * dt;
    s.lvz += (-LEAN_K * s.lz - LEAN_C * s.lvz) * dt;
    s.lx += s.lvx * dt;
    s.lz += s.lvz * dt;

    s.hvx += (HEAD_K * (HEAD_FOLLOW * s.lx - s.hx) - HEAD_C * s.hvx) * dt;
    s.hvz += (HEAD_K * (HEAD_FOLLOW * s.lz - s.hz) - HEAD_C * s.hvz) * dt;
    s.hx += s.hvx * dt;
    s.hz += s.hvz * dt;

    s.sqv += (-SQ_K * s.sq - SQ_C * s.sqv) * dt;
    s.sq += s.sqv * dt;

    const breathe = 0.012 * Math.sin(t * 2.1);
    group.scale.y = 1 + s.sq + breathe;
    group.scale.x = group.scale.z = 1 - (s.sq + breathe) * 0.55;

    // group origin is at the feet, so lean rotations pivot at ground contact
    group.rotation.x = s.lz * 0.55 + 0.012 * Math.sin(t * 0.9 + 1.7);
    group.rotation.z = -s.lx * 0.55 + 0.018 * Math.sin(t * 1.15);
    group.rotation.y = 0.03 * Math.sin(t * 0.55);

    // head: the lag term (chase - lean) counter-tilts, then overshoots — bobblehead
    const lagX = s.hx - s.lx, lagZ = s.hz - s.lz;
    headPivot.rotation.x = lagZ * HEAD_GAIN + 0.04 * Math.sin(t * 2.05);
    headPivot.rotation.z = TILT - lagX * HEAD_GAIN + 0.05 * Math.sin(t * 1.6 + 0.4);
    headPivot.rotation.y = 0.06 * Math.sin(t * 0.7 + 0.9);

    for (let i = 0; i < arms.length; i++) {
      const a = arms[i];
      const phase = i * Math.PI * 0.8;
      a.pivot.rotation.x = 0.09 * Math.sin(t * 1.9 + phase) + lagZ * 0.8;
      a.pivot.rotation.z = a.hang + 0.05 * Math.sin(t * 1.5 + phase) - lagX * 0.8;
    }

    // faint weight shift in the legs
    legs[0].rotation.x = 0.02 * Math.sin(t * 1.15);
    legs[1].rotation.x = -0.02 * Math.sin(t * 1.15);
  }

  return { group, update, poke };
}
