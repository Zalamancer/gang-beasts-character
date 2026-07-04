export function buildCharacter(THREE) {
  // ---------- materials ----------
  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: 0xd92318, // saturated gummy red
    roughness: 0.38,
    metalness: 0.0,
    clearcoat: 0.9,
    clearcoatRoughness: 0.32,
    sheen: 0.45,
    sheenColor: new THREE.Color(0xff6a55),
    sheenRoughness: 0.55,
    envMapIntensity: 0.85
  });
  const eyeMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.22,
    metalness: 0.0,
    clearcoat: 0.5,
    clearcoatRoughness: 0.3,
    envMapIntensity: 0.7
  });

  function M(geo, mat, receive) {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.receiveShadow = !!receive;
    return m;
  }

  // ---------- hierarchy ----------
  const group = new THREE.Group();
  const squash = new THREE.Group();          // whole-body squash & stretch, pivot at the ground
  group.add(squash);
  const lean = new THREE.Group();
  lean.position.y = 0.12;                    // ankle-height pivot: feet stay planted while body tips
  squash.add(lean);

  // ---------- feet (planted, outside the lean pivot) ----------
  const footGeo = new THREE.SphereGeometry(0.2, 28, 20);
  for (const s of [-1, 1]) {
    const foot = M(footGeo, bodyMat, true);
    foot.scale.set(0.72, 0.5, 1.15);         // big rounded loaf, toes forward
    foot.position.set(s * 0.235, 0.10, 0.07);
    foot.rotation.y = s * 0.05;
    squash.add(foot);
  }

  // ---------- legs (short + chunky, slight outward splay) ----------
  const legGeo = new THREE.CapsuleGeometry(0.14, 0.28, 6, 20);
  for (const s of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(s * 0.20, 0.54, 0);     // hip pivots at world y=0.66
    hip.rotation.z = s * 0.064;              // splay lands leg ends over the feet at ±0.235
    const leg = M(legGeo, bodyMat);
    leg.position.y = -0.27;
    hip.add(leg);
    lean.add(hip);
  }

  // ---------- torso (rounded slab, widest under the shoulders, tapers to hips) ----------
  const prof = [
    [0.02, 0.0], [0.17, 0.015], [0.255, 0.06], [0.305, 0.16],
    [0.345, 0.31], [0.365, 0.46], [0.378, 0.6], [0.38, 0.7],
    [0.362, 0.8], [0.315, 0.87], [0.215, 0.915], [0.02, 0.92]
  ].map(p => new THREE.Vector2(p[0], p[1]));
  const torsoGrp = new THREE.Group();        // scale pivot at torso base so breathing keeps hips fixed
  torsoGrp.position.y = 0.40;
  const torso = M(new THREE.LatheGeometry(prof, 48), bodyMat, true);
  torso.scale.z = 0.62;                      // flatten front-to-back into a slab
  torsoGrp.add(torso);
  lean.add(torsoGrp);

  // ---------- arms (stubby, hanging, mitten fists at hip height) ----------
  const armGeo = new THREE.CapsuleGeometry(0.115, 0.34, 6, 20);
  const fistGeo = new THREE.SphereGeometry(0.155, 24, 18);
  function makeArm(s) {
    const shoulder = new THREE.Group();
    shoulder.position.set(s * 0.44, 1.22, 0); // shoulder pivots at world y=1.34, top of torso
    const arm = M(armGeo, bodyMat);
    arm.position.y = -0.27;
    const fist = M(fistGeo, bodyMat);
    fist.scale.set(0.95, 1.1, 0.95);
    fist.position.set(0, -0.56, 0.02);        // fist bottom ≈ 0.62 world, right at hip height
    shoulder.add(arm, fist);
    lean.add(shoulder);
    return shoulder;
  }
  const shoulderL = makeArm(-1);
  const shoulderR = makeArm(1);

  // ---------- head (wider than torso, no neck, ~41% of total height) ----------
  const headGrp = new THREE.Group();          // bobble pivot at the neck base
  headGrp.position.y = 1.34;
  lean.add(headGrp);
  const headCore = new THREE.Group();
  headCore.position.y = 0.44;                 // head center world y=1.90, top of skull 2.40
  headGrp.add(headCore);

  const head = M(new THREE.SphereGeometry(0.5, 48, 32), bodyMat);
  head.scale.set(1.06, 1.0, 0.98);            // width 1.06 vs torso 0.76 — head clearly wider
  headCore.add(head);

  // eyes: computed on the ellipsoid surface, close-set and high on the face
  const RX = 0.53, RY = 0.50, RZ = 0.49;
  const eyeGeo = new THREE.SphereGeometry(0.075, 24, 18);
  const fwd = new THREE.Vector3(0, 0, 1);
  for (const s of [-1, 1]) {
    const eye = M(eyeGeo, eyeMat);
    eye.scale.set(0.8, 1.45, 0.42);           // blank vertical oval
    const yaw = s * 0.21, pitch = 0.21;
    const d = new THREE.Vector3(
      Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      Math.cos(yaw) * Math.cos(pitch)
    );
    eye.position.set(d.x * RX, d.y * RY, d.z * RZ).multiplyScalar(0.99); // slight embed, bulge sits proud
    eye.quaternion.setFromUnitVectors(fwd, d);
    headCore.add(eye);
  }

  // ---------- spring state ----------
  const lp = new THREE.Vector2(), lv = new THREE.Vector2(); // body lean (rot.x, rot.z)
  const hp = new THREE.Vector2(), hv = new THREE.Vector2(); // head/arm chase spring (creates lag)
  let sq = 0, sqv = 0;                                      // squash & stretch scalar
  const K_LEAN = 36, C_LEAN = 4.6;   // underdamped: 2-3 visible overshoots
  const K_HEAD = 40, C_HEAD = 3.6, HEAD_FOLLOW = 0.9, HEAD_GAIN = 1.8;
  const K_SQ = 110, C_SQ = 6.0;
  const clamp = THREE.MathUtils.clamp;

  function update(t, dt) {
    if (!(dt > 0)) dt = 0.016;
    dt = Math.min(dt, 0.05);

    // body lean spring -> 0
    lv.x += (-K_LEAN * lp.x - C_LEAN * lv.x) * dt;
    lv.y += (-K_LEAN * lp.y - C_LEAN * lv.y) * dt;
    lp.x = clamp(lp.x + lv.x * dt, -0.45, 0.45);
    lp.y = clamp(lp.y + lv.y * dt, -0.45, 0.45);

    // head chases the lean with a softer spring: it trails, then whips past
    hv.x += (K_HEAD * (HEAD_FOLLOW * lp.x - hp.x) - C_HEAD * hv.x) * dt;
    hv.y += (K_HEAD * (HEAD_FOLLOW * lp.y - hp.y) - C_HEAD * hv.y) * dt;
    hp.x = clamp(hp.x + hv.x * dt, -0.6, 0.6);
    hp.y = clamp(hp.y + hv.y * dt, -0.6, 0.6);

    // squash spring -> 0
    sqv += (-K_SQ * sq - C_SQ * sqv) * dt;
    sq = clamp(sq + sqv * dt, -0.18, 0.18);

    // breathing: torso swells from its base
    const br = Math.sin(t * 1.9);
    torsoGrp.scale.set(1 - 0.016 * br, 1 + 0.03 * br, 1 - 0.016 * br);

    // whole-body lean = spring + slow idle wobble
    lean.rotation.x = lp.x + 0.018 * Math.sin(t * 0.62);
    lean.rotation.z = lp.y + 0.015 * Math.sin(t * 0.47 + 1.3);

    // head: lag term (hp - lp) counter-tilts first, then overshoots bigger than the body
    const lagX = hp.x - lp.x, lagZ = hp.y - lp.y;
    headGrp.rotation.x = HEAD_GAIN * lagX + 0.03 * Math.sin(t * 1.15 + 0.9);
    headGrp.rotation.z = HEAD_GAIN * lagZ + 0.024 * Math.sin(t * 0.83 + 2.0);
    headGrp.rotation.y = 0.02 * Math.sin(t * 0.36 + 0.5);
    headGrp.position.y = 1.34 + 0.018 * Math.sin(t * 1.9 - 0.55); // bob trails the breath

    // arms: pendulum follow-through plus out-of-phase idle sway
    const armLagX = lagX * 0.9, armLagZ = lagZ * 0.9;
    const flare = 0.015 * br; // inhale pushes the arms slightly outward
    shoulderR.rotation.x = armLagX + 0.05 * Math.sin(t * 1.13 + 2.1);
    shoulderR.rotation.z = 0.08 + flare + armLagZ + 0.02 * Math.sin(t * 0.9);
    shoulderL.rotation.x = armLagX + 0.05 * Math.sin(t * 1.13 + 4.5);
    shoulderL.rotation.z = -0.08 - flare + armLagZ + 0.02 * Math.sin(t * 0.9 + 2.6);

    // squash & stretch, volume-ish preserving, pivot at the ground
    const sxz = 1 - sq * 0.55;
    squash.scale.set(sxz, 1 + sq, sxz);
  }

  const _pokeDir = new THREE.Vector3();
  function poke(dir) {
    _pokeDir.set(dir.x, 0, dir.z);
    if (_pokeDir.lengthSq() < 1e-10) _pokeDir.set(0, 0, 1);
    _pokeDir.normalize();
    // kick the lean velocity so the body tips away along the push;
    // the head/arm lag emerges from the chase spring, not a direct kick
    lv.x += _pokeDir.z * 1.7;
    lv.y += -_pokeDir.x * 1.7;
    sqv -= 2.6; // compress first, rebound stretch follows
  }

  return { group, update, poke };
}
