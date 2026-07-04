export function buildCharacter(THREE) {
  // ---------- proportions (world units; standing height ~2.42) ----------
  const HIP_Y = 0.62;                 // short chunky legs
  const TORSO_H = 0.92;
  const TORSO_R = 0.46;               // torso half-width at widest -> width 0.8, head must beat it
  const FLAT = 0.78;                  // front-back flatten makes the torso a rounded slab
  const HEAD_R = 0.62;                // head width 1.24 >> torso width
  const HEAD_SY = 0.9;                // vertically squashed head = chunkier toy
  const SHOULDER_X = 0.34;
  const SHOULDER_Y = 0.74;            // in spine space, near torso top
  const HEAD_PIVOT_Y = 0.88;          // low pivot sinks head ~0.24 into the shoulders
  const HEAD_LIFT = 0.36;

  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: 0xdd2417,
    roughness: 0.42,                  // matte gummy base...
    metalness: 0,
    clearcoat: 1.0,                   // ...under a hard candy-vinyl shell
    clearcoatRoughness: 0.16,
    sheen: 0.5,
    sheenColor: new THREE.Color(0xff7a5f),
    sheenRoughness: 0.45,
    envMapIntensity: 0.9,
    specularIntensity: 0.5
  });
  const eyeMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.2,
    metalness: 0,
    clearcoat: 0.7,
    clearcoatRoughness: 0.25,
    envMapIntensity: 0.6
  });

  function mesh(geo, mat, receive) {
    const m = new THREE.Mesh(geo, mat || bodyMat);
    m.castShadow = true;
    m.receiveShadow = !!receive;
    return m;
  }

  const group = new THREE.Group();

  // ---------- legs + feet (planted; they live outside the wobbling spine) ----------
  const legPivots = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.26, HIP_Y, 0);        // slightly wide stance
    const leg = mesh(new THREE.CapsuleGeometry(0.16, 0.18, 10, 24), bodyMat, true);
    leg.position.y = -0.25;
    const foot = mesh(new THREE.SphereGeometry(0.2, 32, 20), bodyMat, true);
    foot.scale.set(1.05, 0.5, 1.5);                   // big rounded foot pointing +Z
    foot.position.set(side * 0.02, -HIP_Y + 0.101, 0.09); // sole kisses y=0
    pivot.add(leg, foot);
    group.add(pivot);
    legPivots.push(pivot);
  }

  // ---------- spine: everything above the hips wobbles from this joint ----------
  const spine = new THREE.Group();
  spine.position.y = HIP_Y;
  group.add(spine);

  // rounded slab torso via lathe: squarish mid profile, round caps, hip taper
  const pts = [];
  const SEG = 28;
  for (let i = 0; i <= SEG; i++) {
    const v = i / SEG;
    const ang = (v - 0.5) * Math.PI;
    const round = Math.pow(Math.cos(ang), 0.62);      // exponent <1 => slabby, not egg-shaped
    const taper = 0.7 + 0.3 * v;                      // narrows toward the hips
    pts.push(new THREE.Vector2(Math.max(TORSO_R * taper * round, 0.002), v * TORSO_H));
  }
  const torso = mesh(new THREE.LatheGeometry(pts, 48), bodyMat, true);
  torso.scale.set(1, 1, FLAT);
  spine.add(torso);

  const pelvis = mesh(new THREE.SphereGeometry(0.3, 32, 20), bodyMat, true);
  pelvis.scale.set(1.3, 0.64, 1.0);                   // bridges the hip taper to the legs
  pelvis.position.y = 0.04;
  spine.add(pelvis);

  // ---------- stubby arms with oversized mitten fists ----------
  const shoulders = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * SHOULDER_X, SHOULDER_Y, 0);
    const arm = mesh(new THREE.CapsuleGeometry(0.135, 0.25, 10, 24));
    arm.position.y = -0.26;
    const fist = mesh(new THREE.SphereGeometry(0.19, 32, 20)); // oversized mitten
    fist.scale.set(1.05, 0.9, 1.0);
    fist.position.y = -0.575;                         // fist bottom lands at hip height
    pivot.add(arm, fist);
    spine.add(pivot);
    shoulders.push(pivot);
  }

  // ---------- huge neckless head ----------
  const headPivot = new THREE.Group();
  headPivot.position.y = HEAD_PIVOT_Y;
  spine.add(headPivot);
  const headGrp = new THREE.Group();
  headGrp.position.y = HEAD_LIFT;
  headPivot.add(headGrp);
  const head = mesh(new THREE.SphereGeometry(HEAD_R, 48, 32));
  head.scale.set(1, HEAD_SY, 0.97);
  headGrp.add(head);

  // blank white vertical-oval eyes, computed onto the ellipsoid surface (+Z face)
  for (const side of [-1, 1]) {
    const yaw = side * 0.24;
    const pitch = 0.3;                                // upper-face placement
    const n = new THREE.Vector3(
      Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      Math.cos(yaw) * Math.cos(pitch)
    );
    const eye = mesh(new THREE.SphereGeometry(0.1, 24, 18), eyeMat);
    eye.scale.set(0.55, 1.25, 0.4);                   // tall blank oval, thin dome
    eye.position
      .set(n.x * HEAD_R, n.y * HEAD_R * HEAD_SY, n.z * HEAD_R * 0.97)
      .addScaledVector(n, -0.015);                    // slight embed, sits just proud of shell
    eye.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    headGrp.add(eye);
  }

  // ---------- jelly spring state ----------
  let leanX = 0, leanZ = 0, leanVX = 0, leanVZ = 0;   // body lean (rad, rad/s)
  let headX = 0, headZ = 0, headVX = 0, headVZ = 0;   // head lag spring
  let sq = 0, sqV = 0;                                // squash scalar
  const cl = (v, m) => Math.max(-m, Math.min(m, v));

  function update(t, dt) {
    dt = cl(dt || 0, 0.05);
    if (dt > 0) {
      // semi-implicit Euler, underdamped for jelly overshoot
      leanVX += (-26 * leanX - 3.4 * leanVX) * dt;
      leanVZ += (-26 * leanZ - 3.4 * leanVZ) * dt;
      leanX += leanVX * dt;
      leanZ += leanVZ * dt;
      // head chases an amplified copy of the body lean => lag + bigger amplitude
      headVX += (46 * (1.7 * leanX - headX) - 3.0 * headVX) * dt;
      headVZ += (46 * (1.7 * leanZ - headZ) - 3.0 * headVZ) * dt;
      headX += headVX * dt;
      headZ += headVZ * dt;
      sqV += (-70 * sq - 5.2 * sqV) * dt;
      sq += sqV * dt;
    }

    const breath = 0.045 * Math.sin(t * 1.7);         // exaggerated chunky breathing
    const lx = cl(leanX, 0.34) + 0.022 * Math.sin(t * 0.8 + 1.7);
    const lz = cl(leanZ, 0.34) + 0.028 * Math.sin(t * 0.63);
    spine.rotation.set(lx, 0.035 * Math.sin(t * 0.45), lz);

    headPivot.rotation.set(
      cl(headX, 0.5) + 0.05 * Math.sin(t * 0.8 + 1.1), // phase offset = lazy lag vs body
      0.06 * Math.sin(t * 0.5 + 0.8),
      cl(headZ, 0.5) + 0.045 * Math.sin(t * 0.63 - 0.6)
    );

    const s = cl(sq, 0.3) + breath;
    const w = 1 - s * 0.55;                            // fake volume preservation
    torso.scale.set(w, 1 + s, FLAT * w);
    shoulders[0].position.set(-SHOULDER_X * w, SHOULDER_Y * (1 + s), 0);
    shoulders[1].position.set(SHOULDER_X * w, SHOULDER_Y * (1 + s), 0);
    headPivot.position.y = HEAD_PIVOT_Y * (1 + s) + 0.014 * Math.sin(t * 1.7 - 0.9);
    headGrp.scale.set(1 - s * 0.3, 1 + s * 0.5, 1 - s * 0.3); // head squashes along

    // arms: idle sway out of phase; on pokes they flail opposite the head
    const flailX = cl(-headX * 0.7, 0.4);
    const flailZ = cl(-headZ * 0.7, 0.4);
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      shoulders[i].rotation.x = 0.055 * Math.sin(t * 1.25 + i * 2.3) + flailX;
      shoulders[i].rotation.z = side * 0.24 + 0.04 * Math.sin(t * 1.05 + 0.6 + i * 1.4) + flailZ;
      // legs counter the lean a touch so the feet read planted
      legPivots[i].rotation.x = -lx * 0.14;
      legPivots[i].rotation.z = -lz * 0.14;
    }
  }

  function poke(dir) {
    const dx = (dir && dir.x) || 0;
    const dz = (dir && dir.z) || 0;
    leanVX = cl(leanVX + dz * 2.3, 6);
    leanVZ = cl(leanVZ - dx * 2.3, 6);
    headVX = cl(headVX + dz * 2.0, 8);                // extra snap so the head whips
    headVZ = cl(headVZ - dx * 2.0, 8);
    sqV = cl(sqV - 3.0, 8);                           // slam into squash; spring rebounds to stretch
  }

  return { group, update, poke };
}
