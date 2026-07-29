import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MarchingCubes } from "three/addons/objects/MarchingCubes.js";

const MODEL_URL = "assets/SN2_PES_animation_HQ.glb";
const SOURCE_FRAMES = 615;
const SOURCE_FPS = 30;
const FIELD_SIZE = 12.4;
const IS_MOBILE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 760;

const ui = {
  canvas: document.getElementById("scene"),
  video: document.getElementById("cameraVideo"),
  loading: document.getElementById("loading"),
  loadingDetail: document.getElementById("loadingDetail"),
  galleryMode: document.getElementById("galleryMode"),
  arMode: document.getElementById("arMode"),
  cameraFlip: document.getElementById("cameraFlip"),
  playPause: document.getElementById("playPause"),
  restart: document.getElementById("restart"),
  timeline: document.getElementById("timeline"),
  timeLabel: document.getElementById("timeLabel"),
  speed: document.getElementById("speed"),
  pesToggle: document.getElementById("pesToggle"),
  phaseLabel: document.getElementById("phaseLabel"),
  phaseDot: document.getElementById("phaseDot"),
  frameLabel: document.getElementById("frameLabel"),
  hint: document.getElementById("interactionHint"),
  arNotice: document.getElementById("arNotice"),
  toast: document.getElementById("toast")
};

const renderer = new THREE.WebGLRenderer({
  canvas: ui.canvas,
  antialias: true,
  alpha: true,
  powerPreference: "high-performance"
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, IS_MOBILE ? 1.65 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.setClearColor(0xf5f0e8, 1);

const scene = new THREE.Scene();
scene.background = new THREE.Color("#f5f0e8");
scene.fog = new THREE.Fog("#f5f0e8", 18, 36);

const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.05, 120);
camera.position.set(0, 0.25, 10);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.enablePan = false;
controls.minDistance = 3.2;
controls.maxDistance = 28;
controls.target.set(0, 0, 0);

scene.add(new THREE.HemisphereLight(0xffffff, 0x6b7280, 2.25));
const keyLight = new THREE.DirectionalLight(0xfff3e6, 3.0);
keyLight.position.set(-5, 7, 8);
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0xc7ddff, 2.1);
fillLight.position.set(6, -2, 7);
scene.add(fillLight);
const rimLight = new THREE.DirectionalLight(0xffa8a8, 1.7);
rimLight.position.set(0, 4, -7);
scene.add(rimLight);

const reactionGroup = new THREE.Group();
reactionGroup.name = "SN2_Web_Presentation";
scene.add(reactionGroup);

let gltfScene = null;
let reactionRoot = null;
let directorPivot = null;
let atoms = {};
let dynamicBonds = {};
let mixer = null;
let clip = null;
let action = null;
let pesSurface = null;
let sourceWidth = 10.8;
let isPlaying = true;
let isScrubbing = false;
let speed = 1;
let isAR = false;
let stream = null;
let facingMode = "environment";
let toastTimer = null;
let surfaceFrame = 0;

const clock = new THREE.Clock();
const tempColor = new THREE.Color();

const PES_BALLS = {
  C: { radius: 0.43 * 1.85, color: "#8b9d38" },
  H1: { radius: 0.27 * 1.75, color: "#3f8df4" },
  H2: { radius: 0.27 * 1.75, color: "#3f8df4" },
  H3: { radius: 0.27 * 1.75, color: "#3f8df4" },
  Cl: { radius: 0.53 * 1.80, color: "#ee5a55" },
  Br: { radius: 0.61 * 1.85, color: "#a71f3b" }
};

function showToast(message) {
  clearTimeout(toastTimer);
  ui.toast.textContent = message;
  ui.toast.classList.remove("hidden");
  toastTimer = setTimeout(() => ui.toast.classList.add("hidden"), 3600);
}

function setControlsEnabled(enabled) {
  for (const element of [ui.playPause, ui.restart, ui.timeline, ui.speed]) element.disabled = !enabled;
}

function formatTime(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safe / 60);
  const rest = Math.floor(safe % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

function describeFrame(frame) {
  if (frame <= 45) return ["Reagentes separados", "#a32f42"];
  if (frame < 92) return ["Ataque traseiro do Br⁻", "#b04b43"];
  if (frame <= 133) return ["Estado de transição · ligações parciais", "#7654b5"];
  if (frame <= 225) return ["Produtos · inversão de Walden", "#3f78cc"];
  if (frame < 305) return ["Reação reversa", "#7c5ca7"];
  if (frame <= 345) return ["Novo ataque traseiro", "#b04b43"];
  if (frame <= 495) return ["Estado de transição em órbita", "#7654b5"];
  if (frame < 586) return ["Separação e retorno", "#3f78cc"];
  return ["Reagentes restaurados", "#a32f42"];
}

function updateInterface() {
  if (!action || !clip) return;
  const duration = clip.duration || (SOURCE_FRAMES / SOURCE_FPS);
  const progress = THREE.MathUtils.clamp(action.time / duration, 0, 1);
  const frame = Math.round(1 + progress * (SOURCE_FRAMES - 1));
  const [phase, color] = describeFrame(frame);
  ui.phaseLabel.textContent = phase;
  ui.phaseDot.style.background = color;
  ui.phaseDot.style.boxShadow = `0 0 0 5px ${color}22`;
  ui.frameLabel.textContent = `quadro ${frame}`;
  if (!isScrubbing) ui.timeline.value = String(Math.round(progress * 1000));
  ui.timeLabel.textContent = `${formatTime(progress * duration)} / ${formatTime(duration)}`;
}

function buildPESSurface() {
  const material = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    vertexColors: true,
    transparent: true,
    opacity: 0.42,
    roughness: 0.31,
    metalness: 0.0,
    transmission: 0.08,
    thickness: 0.28,
    clearcoat: 0.32,
    clearcoatRoughness: 0.36,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const resolution = IS_MOBILE ? 46 : 64;
  pesSurface = new MarchingCubes(resolution, material, false, true, IS_MOBILE ? 60000 : 120000);
  pesSurface.name = "PES_Surface_Runtime";
  pesSurface.isolation = 80;
  pesSurface.scale.setScalar(FIELD_SIZE / 2);
  pesSurface.position.set(0, 0, 0);
  pesSurface.renderOrder = 1;
  pesSurface.frustumCulled = false;
  reactionRoot.add(pesSurface);
  updatePESSurface(true);
}

function updatePESSurface(force = false) {
  if (!pesSurface || !pesSurface.visible) return;
  surfaceFrame += 1;
  if (!force && IS_MOBILE && surfaceFrame % 2) return;
  pesSurface.reset();
  const subtract = 12;
  for (const [key, atom] of Object.entries(atoms)) {
    if (!atom) continue;
    const item = PES_BALLS[key];
    const p = atom.position;
    const x = THREE.MathUtils.clamp(p.x / FIELD_SIZE + 0.5, 0.03, 0.97);
    const y = THREE.MathUtils.clamp(p.y / FIELD_SIZE + 0.5, 0.03, 0.97);
    const z = THREE.MathUtils.clamp(p.z / FIELD_SIZE + 0.5, 0.03, 0.97);
    const strength = Math.pow(item.radius / FIELD_SIZE, 2) * (pesSurface.isolation + subtract);
    pesSurface.addBall(x, y, z, strength, subtract, tempColor.set(item.color));
  }
  pesSurface.update();
}

function updateDynamicBonds() {
  for (const bond of Object.values(dynamicBonds)) {
    if (bond) bond.visible = bond.scale.x > 0.008;
  }
}

function fitPresentation() {
  if (!gltfScene) return;
  const aspect = Math.max(window.innerWidth / window.innerHeight, 0.35);
  const targetWidth = aspect < 0.72 ? 4.0 : 6.4;
  const scale = targetWidth / sourceWidth;
  reactionGroup.scale.setScalar(scale);
  reactionGroup.position.set(0, aspect < 0.72 ? 0.1 : 0.0, 0);
  const horizontalFov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * aspect);
  const framing = aspect < 0.72 ? 0.53 : 0.56;
  const distance = THREE.MathUtils.clamp((targetWidth * framing) / Math.tan(horizontalFov / 2), 7.0, 16.5);
  camera.position.set(0, 0.28, distance);
  camera.near = 0.05;
  camera.far = 120;
  camera.updateProjectionMatrix();
  controls.target.set(0, 0, 0);
  controls.minDistance = distance * 0.48;
  controls.maxDistance = distance * 2.4;
  controls.update();
}

function loadModel() {
  const loader = new GLTFLoader();
  loader.load(
    MODEL_URL,
    gltf => {
      gltfScene = gltf.scene;
      reactionRoot = gltfScene.getObjectByName("SN2_HQ_ROOT");
      directorPivot = gltfScene.getObjectByName("SN2_CAMERA_ORBIT");
      if (!reactionRoot) throw new Error("O nó SN2_HQ_ROOT não foi encontrado no GLB.");

      for (const key of Object.keys(PES_BALLS)) atoms[key] = gltfScene.getObjectByName(`SN2_ATOM_${key}`);
      dynamicBonds = {
        CCl: gltfScene.getObjectByName("SN2_BOND_C_Cl"),
        CBr: gltfScene.getObjectByName("SN2_BOND_C_Br")
      };
      const missingAtoms = Object.entries(atoms).filter(([, node]) => !node).map(([key]) => key);
      if (missingAtoms.length) throw new Error(`Átomos ausentes no GLB: ${missingAtoms.join(", ")}`);

      gltfScene.traverse(object => {
        if (!object.isMesh) return;
        object.castShadow = true;
        object.receiveShadow = true;
        if (object.material) {
          object.material.envMapIntensity = 0.55;
          object.material.needsUpdate = true;
        }
      });

      reactionGroup.add(gltfScene);
      const sourceBox = new THREE.Box3();
      for (const atom of Object.values(atoms)) sourceBox.expandByObject(atom);
      const center = sourceBox.getCenter(new THREE.Vector3());
      const size = sourceBox.getSize(new THREE.Vector3());
      sourceWidth = Math.max(size.x, 10.8);
      // The whole animation reaches -4.15 and +4.15 on X. Centering on the
      // first frame would crop the leaving group in the product frames.
      gltfScene.position.set(0, -center.y, -center.z);

      clip = gltf.animations[0];
      if (!clip) throw new Error("O GLB não contém a animação SN2.");
      mixer = new THREE.AnimationMixer(gltfScene);
      action = mixer.clipAction(clip);
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.clampWhenFinished = false;
      action.play();
      mixer.setTime(0);
      updateDynamicBonds();

      buildPESSurface();
      fitPresentation();
      setControlsEnabled(true);
      ui.loading.classList.add("hidden");
      ui.playPause.textContent = "Pausar";
      updateInterface();
    },
    event => {
      if (!event.total) return;
      const percent = Math.round((event.loaded / event.total) * 100);
      ui.loadingDetail.textContent = `GLB de alta qualidade: ${percent}%`;
    },
    error => {
      console.error(error);
      ui.loadingDetail.textContent = "Não foi possível carregar o GLB. Recarregue a página.";
      showToast("Falha ao abrir o arquivo 3D.");
    }
  );
}

function setPlaying(next) {
  if (!action) return;
  isPlaying = next;
  action.paused = !next;
  ui.playPause.textContent = next ? "Pausar" : "Reproduzir";
}

function seekAnimation(time) {
  if (!mixer || !clip || !action) return;
  const paused = !isPlaying;
  action.paused = false;
  action.time = THREE.MathUtils.clamp(time, 0, clip.duration - 0.0001);
  mixer.update(0);
  action.paused = paused;
}

ui.playPause.addEventListener("click", () => setPlaying(!isPlaying));
ui.restart.addEventListener("click", () => {
  if (!mixer || !clip) return;
  mixer.setTime(0);
  setPlaying(true);
  updateDynamicBonds();
  updatePESSurface(true);
  updateInterface();
});

ui.timeline.addEventListener("pointerdown", () => { isScrubbing = true; });
ui.timeline.addEventListener("input", () => {
  if (!mixer || !clip) return;
  seekAnimation((Number(ui.timeline.value) / 1000) * clip.duration);
  updateDynamicBonds();
  updatePESSurface(true);
  updateInterface();
});
ui.timeline.addEventListener("change", () => { isScrubbing = false; });
window.addEventListener("pointerup", () => { isScrubbing = false; });

ui.speed.addEventListener("change", () => { speed = Number(ui.speed.value) || 1; });
ui.pesToggle.addEventListener("change", () => {
  if (!pesSurface) return;
  pesSurface.visible = ui.pesToggle.checked;
  if (pesSurface.visible) updatePESSurface(true);
});

async function stopAR() {
  if (stream) stream.getTracks().forEach(track => track.stop());
  stream = null;
  ui.video.srcObject = null;
  ui.video.classList.remove("visible");
  document.body.classList.remove("ar-active", "front-camera");
  ui.galleryMode.classList.add("active");
  ui.arMode.classList.remove("active");
  ui.arNotice.classList.add("hidden");
  scene.background = new THREE.Color("#f5f0e8");
  scene.fog = new THREE.Fog("#f5f0e8", 18, 36);
  renderer.setClearColor(0xf5f0e8, 1);
  isAR = false;
}

async function startAR() {
  if (!navigator.mediaDevices?.getUserMedia) {
    showToast("A câmera não está disponível neste navegador.");
    return;
  }
  try {
    if (stream) stream.getTracks().forEach(track => track.stop());
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
    ui.video.srcObject = stream;
    await ui.video.play();
    ui.video.classList.add("visible");
    document.body.classList.add("ar-active");
    document.body.classList.toggle("front-camera", facingMode === "user");
    ui.galleryMode.classList.remove("active");
    ui.arMode.classList.add("active");
    ui.arNotice.classList.remove("hidden");
    scene.background = null;
    scene.fog = null;
    renderer.setClearColor(0x000000, 0);
    isAR = true;
    showToast("Câmera ativa: arraste para girar e use a pinça para ampliar.");
  } catch (error) {
    console.error(error);
    showToast("Permita o acesso à câmera para usar o modo AR.");
    await stopAR();
  }
}

ui.galleryMode.addEventListener("click", stopAR);
ui.arMode.addEventListener("click", startAR);
ui.cameraFlip.addEventListener("click", async () => {
  facingMode = facingMode === "environment" ? "user" : "environment";
  if (isAR) await startAR();
});

controls.addEventListener("start", () => ui.hint.classList.add("hidden"));

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  if (mixer && isPlaying && !isScrubbing) mixer.update(delta * speed);
  if (mixer) updateDynamicBonds();
  if (directorPivot && reactionGroup) {
    // Equivalent relative view to the Blender orbit camera while retaining
    // free OrbitControls for the visitor.
    reactionGroup.quaternion.copy(directorPivot.quaternion).invert();
  }
  if (mixer && isPlaying) updatePESSurface();
  updateInterface();
  controls.update();
  renderer.render(scene, camera);
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, IS_MOBILE ? 1.65 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  fitPresentation();
});

window.addEventListener("pagehide", () => {
  if (stream) stream.getTracks().forEach(track => track.stop());
});

loadModel();
animate();
