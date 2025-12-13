import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Lensflare, LensflareElement } from 'three/examples/jsm/objects/Lensflare.js';
import { CONFIG } from '../constants';
import { AppMode, HandState, ParticleData, AppState } from '../types';

// Custom Shader
const ChromaticAberrationShader = {
  uniforms: {
    'tDiffuse': { value: null },
    'amount': { value: 0.0005 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float amount;
    varying vec2 vUv;

    void main() {
      vec2 offset = amount * (vUv - 0.5);
      vec4 cr = texture2D(tDiffuse, vUv + offset);
      vec4 cg = texture2D(tDiffuse, vUv);
      vec4 cb = texture2D(tDiffuse, vUv - offset);
      gl_FragColor = vec4(cr.r, cg.g, cb.b, cg.a);
    }
  `
};

export class SceneController {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private mainGroup: THREE.Group;
  private photoMeshGroup: THREE.Group;
  private particleSystem: ParticleData[] = [];
  private clock: THREE.Clock;
  private bokehPass!: BokehPass;
  private caneTexture!: THREE.Texture;
  private animationFrameId: number | null = null;
  
  // State from React
  private handStateRef: React.MutableRefObject<HandState>;
  private appState: AppState = {
    mode: 'TREE',
    focusTarget: null,
    rotation: { x: 0, y: 0, velocity: 0 }
  };

  private defaultPhotoParticle: ParticleData | null = null;

  constructor(
    canvas: HTMLCanvasElement, 
    handStateRef: React.MutableRefObject<HandState>,
    onLoadComplete: () => void
  ) {
    this.handStateRef = handStateRef;
    
    // Init Three.js
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(CONFIG.colors.bg);
    this.scene.fog = new THREE.FogExp2(CONFIG.colors.bg, 0.01);

    this.camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 2, CONFIG.camera.z);

    this.renderer = new THREE.WebGLRenderer({ 
      canvas, 
      antialias: true, 
      alpha: false, 
      powerPreference: "high-performance" 
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    this.mainGroup = new THREE.Group();
    this.scene.add(this.mainGroup);
    this.photoMeshGroup = new THREE.Group();
    this.mainGroup.add(this.photoMeshGroup);

    this.clock = new THREE.Clock();

    this.init();
    
    // Slight delay to simulate loading complex assets/shaders
    setTimeout(onLoadComplete, 1000);
  }

  private init() {
    this.setupEnvironment();
    this.setupLights();
    this.createTextures();
    this.createParticles();
    this.createDust();
    this.createSnowflakes();
    this.createDefaultPhotos();
    this.setupPostProcessing();
    this.startLoop();
  }

  private setupEnvironment() {
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
  }

  private setupLights() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambient);

    const innerLight = new THREE.PointLight(0xffaa00, 1.5, 20);
    innerLight.position.set(0, 5, 0);
    this.mainGroup.add(innerLight);

    const spotGold = new THREE.SpotLight(0xffcc66, 400);
    spotGold.position.set(30, 40, 40);
    spotGold.angle = 0.5;
    spotGold.penumbra = 0.5;
    this.scene.add(spotGold);

    // Lensflare
    const textureLoader = new THREE.TextureLoader();
    // Using a generated texture helper for lensflare to avoid external image dependencies breaking
    const createFlareTexture = (size: number, color: string, alpha: number) => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        gradient.addColorStop(0, `rgba(${color}, ${alpha})`);
        gradient.addColorStop(0.5, `rgba(${color}, ${alpha * 0.5})`);
        gradient.addColorStop(1, `rgba(${color}, 0)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
      }
      return new THREE.CanvasTexture(canvas);
    };

    const lensflare = new Lensflare();
    lensflare.addElement(new LensflareElement(createFlareTexture(256, '255, 215, 100', 0.3), 200, 0));
    lensflare.addElement(new LensflareElement(createFlareTexture(128, '255, 200, 150', 0.2), 60, 0.1));
    spotGold.add(lensflare);

    const spotBlue = new THREE.SpotLight(0x6688ff, 200);
    spotBlue.position.set(-30, 20, -30);
    this.scene.add(spotBlue);

    const fill = new THREE.DirectionalLight(0xffffff, 0.4);
    fill.position.set(0, 0, 50);
    this.scene.add(fill);
  }

  private createTextures() {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 128, 128);
      ctx.fillStyle = '#880000';
      ctx.beginPath();
      for (let i = -128; i < 256; i += 32) {
        ctx.moveTo(i, 0); ctx.lineTo(i + 32, 128); ctx.lineTo(i + 16, 128); ctx.lineTo(i - 16, 0);
      }
      ctx.fill();
    }
    this.caneTexture = new THREE.CanvasTexture(canvas);
    this.caneTexture.wrapS = THREE.RepeatWrapping;
    this.caneTexture.wrapT = THREE.RepeatWrapping;
    this.caneTexture.repeat.set(3, 3);
  }

  private setupPostProcessing() {
    const renderScene = new RenderPass(this.scene, this.camera);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.8, 0.3, 0.85
    );
    bloomPass.threshold = 1.2;
    bloomPass.strength = 0.15;
    bloomPass.radius = 0.25;

    this.bokehPass = new BokehPass(this.scene, this.camera, {
      focus: 40.0,
      aperture: 0.00002,
      maxblur: 0.003
    });

    const chromaticPass = new ShaderPass(ChromaticAberrationShader);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(renderScene);
    this.composer.addPass(bloomPass);
    this.composer.addPass(this.bokehPass);
    this.composer.addPass(chromaticPass);
  }

  private createParticles() {
    const sphereGeo = new THREE.SphereGeometry(0.5, 32, 32);
    const boxGeo = new THREE.BoxGeometry(0.55, 0.55, 0.55);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.5, 0), new THREE.Vector3(0, 0.3, 0),
      new THREE.Vector3(0.1, 0.5, 0), new THREE.Vector3(0.3, 0.4, 0)
    ]);
    const candyGeo = new THREE.TubeGeometry(curve, 16, 0.08, 8, false);

    const goldMat = new THREE.MeshStandardMaterial({
      color: CONFIG.colors.champagneGold,
      metalness: 1.0, roughness: 0.1,
      envMapIntensity: 2.0,
      emissive: 0x443300, emissiveIntensity: 0.3
    });

    const greenMat = new THREE.MeshStandardMaterial({
      color: CONFIG.colors.deepGreen,
      metalness: 0.2, roughness: 0.8,
      emissive: 0x002200, emissiveIntensity: 0.2
    });

    const redMat = new THREE.MeshPhysicalMaterial({
      color: CONFIG.colors.accentRed,
      metalness: 0.3, roughness: 0.2, clearcoat: 1.0,
      emissive: 0x330000
    });

    const candyMat = new THREE.MeshStandardMaterial({ map: this.caneTexture, roughness: 0.4 });

    for (let i = 0; i < CONFIG.particles.count; i++) {
      const rand = Math.random();
      let mesh: THREE.Mesh;
      let type: ParticleData['type'];

      if (rand < 0.40) {
        mesh = new THREE.Mesh(boxGeo, greenMat);
        type = 'BOX';
      } else if (rand < 0.70) {
        mesh = new THREE.Mesh(boxGeo, goldMat);
        type = 'GOLD_BOX';
      } else if (rand < 0.92) {
        mesh = new THREE.Mesh(sphereGeo, goldMat);
        type = 'GOLD_SPHERE';
      } else if (rand < 0.97) {
        mesh = new THREE.Mesh(sphereGeo, redMat);
        type = 'RED';
      } else {
        mesh = new THREE.Mesh(candyGeo, candyMat);
        type = 'CANE';
      }

      const s = 0.4 + Math.random() * 0.5;
      mesh.scale.set(s, s, s);
      mesh.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);

      this.mainGroup.add(mesh);
      this.addParticleData(mesh, type, false);
    }

    const starGeo = new THREE.OctahedronGeometry(1.2, 0);
    const starMat = new THREE.MeshStandardMaterial({
      color: 0xffdd88, emissive: 0xffaa00, emissiveIntensity: 1.0,
      metalness: 1.0, roughness: 0
    });
    const star = new THREE.Mesh(starGeo, starMat);
    star.position.set(0, CONFIG.particles.treeHeight / 2 + 1.2, 0);
    this.mainGroup.add(star);
  }

  private createDust() {
    const geo = new THREE.TetrahedronGeometry(0.08, 0);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffeebb, transparent: true, opacity: 0.8 });

    for (let i = 0; i < CONFIG.particles.dustCount; i++) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.scale.setScalar(0.5 + Math.random());
      this.mainGroup.add(mesh);
      this.addParticleData(mesh, 'DUST', true);
    }
  }

  private createSnowflakes() {
    const shape = new THREE.Shape();
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const x = Math.cos(angle) * 0.15;
      const y = Math.sin(angle) * 0.15;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();

    const geo = new THREE.ShapeGeometry(shape);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide
    });

    for (let i = 0; i < 200; i++) {
      const mesh = new THREE.Mesh(geo, mat.clone());
      mesh.scale.setScalar(0.3 + Math.random() * 0.5);

      const radius = 30 + Math.random() * 20;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      mesh.position.set(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.sin(phi) * Math.sin(theta) + 20,
        radius * Math.cos(phi)
      );

      this.scene.add(mesh);
      
      const pData = this.addParticleData(mesh, 'SNOWFLAKE', true);
      pData.userData = {
        fallSpeed: 0.5 + Math.random() * 1.0,
        swaySpeed: 0.2 + Math.random() * 0.3,
        swayAmount: 1 + Math.random() * 2,
        initialX: mesh.position.x
      };
    }
  }

  private addParticleData(mesh: THREE.Mesh | THREE.Group, type: ParticleData['type'], isDust: boolean): ParticleData {
    const pData: ParticleData = {
      mesh,
      type,
      isDust,
      posTree: new THREE.Vector3(),
      posScatter: new THREE.Vector3(),
      baseScale: mesh.scale.x,
      spinSpeed: new THREE.Vector3(),
    };

    // Calculate Tree Position
    const h = CONFIG.particles.treeHeight;
    const halfH = h / 2;
    let t = Math.random();
    t = Math.pow(t, 0.8);
    const y = (t * h) - halfH;
    let rMax = CONFIG.particles.treeRadius * (1.0 - t);
    if (rMax < 0.5) rMax = 0.5;
    const angle = t * 50 * Math.PI + Math.random() * Math.PI;
    const r = rMax * (0.8 + Math.random() * 0.4);
    pData.posTree.set(Math.cos(angle) * r, y, Math.sin(angle) * r);

    // Calculate Scatter Position
    let rScatter = isDust ? (12 + Math.random() * 20) : (8 + Math.random() * 12);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    pData.posScatter.set(
      rScatter * Math.sin(phi) * Math.cos(theta),
      rScatter * Math.sin(phi) * Math.sin(theta),
      rScatter * Math.cos(phi)
    );

    // Spin speed
    const speedMult = (type === 'PHOTO') ? 0.3 : 2.0;
    pData.spinSpeed.set(
      (Math.random() - 0.5) * speedMult,
      (Math.random() - 0.5) * speedMult,
      (Math.random() - 0.5) * speedMult
    );

    this.particleSystem.push(pData);
    return pData;
  }

  private createDefaultPhotos() {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.fillStyle = '#050505'; ctx.fillRect(0, 0, 512, 512);
        ctx.strokeStyle = '#eebb66'; ctx.lineWidth = 15; ctx.strokeRect(20, 20, 472, 472);
        ctx.font = '500 60px Times New Roman'; ctx.fillStyle = '#eebb66';
        ctx.textAlign = 'center';
        ctx.fillText("JOYEUX", 256, 230);
        ctx.fillText("NOEL", 256, 300);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.defaultPhotoParticle = this.addPhotoToScene(tex);
  }

  public addPhotoToScene(texture: THREE.Texture): ParticleData {
    if (texture.image) {
        // Cast to any to access width/height without TS error on unknown type
        const img = texture.image as any;
        const imgWidth = img.width;
        const imgHeight = img.height;
        const imgAspect = (imgWidth && imgHeight) ? imgWidth / imgHeight : 1;

        if (imgAspect > 1) {
            texture.repeat.set(1 / imgAspect, 1);
            texture.offset.set((1 - 1 / imgAspect) / 2, 0);
        } else if (imgAspect < 1) {
            texture.repeat.set(1, imgAspect);
            texture.offset.set(0, (1 - imgAspect) / 2);
        } else {
            texture.repeat.set(1, 1);
            texture.offset.set(0, 0);
        }
    }

    const frameGeo = new THREE.BoxGeometry(1.4, 1.4, 0.05);
    const frameMat = new THREE.MeshStandardMaterial({
        color: CONFIG.colors.champagneGold,
        metalness: 1.0,
        roughness: 0.1,
        emissive: 0x000000,
        emissiveIntensity: 0
    });
    const frame = new THREE.Mesh(frameGeo, frameMat);

    const photoGeo = new THREE.PlaneGeometry(1.2, 1.2);
    const photoMat = new THREE.MeshBasicMaterial({
        map: texture,
        toneMapped: false 
    });
    const photo = new THREE.Mesh(photoGeo, photoMat);
    photo.position.z = 0.04;

    const group = new THREE.Group();
    group.add(frame);
    group.add(photo);

    const s = 0.8;
    group.scale.set(s, s, s);

    this.photoMeshGroup.add(group);
    return this.addParticleData(group, 'PHOTO', false);
  }

  // Load photo from a URL (e.g., Firebase Storage URL)
  public loadPhotoFromUrl(url: string) {
    this.removeDefaultPhoto();
    new THREE.TextureLoader().load(url, (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        this.addPhotoToScene(texture);
    });
  }

  private removeDefaultPhoto() {
    if (this.defaultPhotoParticle) {
        this.photoMeshGroup.remove(this.defaultPhotoParticle.mesh);
        const index = this.particleSystem.indexOf(this.defaultPhotoParticle);
        if (index > -1) this.particleSystem.splice(index, 1);
        this.defaultPhotoParticle = null;
    }
  }

  // Keep this for backward compatibility if needed, but App.tsx now uses loadPhotoFromUrl
  public uploadPhotos(files: FileList) {
    this.removeDefaultPhoto();

    Array.from(files).forEach(f => {
        const reader = new FileReader();
        reader.onload = (ev) => {
            if (ev.target?.result) {
                new THREE.TextureLoader().load(ev.target.result as string, (t) => {
                    t.colorSpace = THREE.SRGBColorSpace;
                    this.addPhotoToScene(t);
                });
            }
        }
        reader.readAsDataURL(f);
    });
  }

  public setMode(mode: AppMode) {
    this.appState.mode = mode;
    if (mode === 'FOCUS') {
      const photos = this.particleSystem.filter(p => p.type === 'PHOTO');
      if (photos.length) {
        this.appState.focusTarget = photos[Math.floor(Math.random() * photos.length)].mesh;
      }
    } else {
      this.appState.focusTarget = null;
    }
  }

  public resize(width: number, height: number) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);
  }

  private startLoop() {
    const loop = () => {
      this.animationFrameId = requestAnimationFrame(loop);
      this.tick();
    };
    loop();
  }

  public stop() {
      if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
      this.renderer.dispose();
  }

  private tick() {
    const dt = this.clock.getDelta();
    const hand = this.handStateRef.current;
    const mode = this.appState.mode;

    // Rotation Logic
    if (mode === 'SCATTER' && hand.detected) {
        const targetRotY = hand.x * Math.PI * 0.9;
        const targetRotX = hand.y * Math.PI * 0.25;
        this.appState.rotation.y += (targetRotY - this.appState.rotation.y) * 3.0 * dt;
        this.appState.rotation.x += (targetRotX - this.appState.rotation.x) * 3.0 * dt;
        
        if (Math.abs(hand.velocityX) > 2) {
            this.appState.rotation.velocity += hand.velocityX * 0.15 * dt;
        }
    } else if (mode === 'SCATTER') {
        this.appState.rotation.y += this.appState.rotation.velocity * dt;
        this.appState.rotation.velocity *= 0.95; 
    } else if (mode === 'TREE') {
        this.appState.rotation.y += 0.3 * dt;
        this.appState.rotation.x += (0 - this.appState.rotation.x) * 2.0 * dt;
        this.appState.rotation.velocity = 0;
    } else if (mode === 'GALLERY') {
        this.appState.rotation.y += 0.5 * dt;
        this.appState.rotation.x += (0 - this.appState.rotation.x) * 2.0 * dt;
        this.appState.rotation.velocity = 0;
    } else {
        this.appState.rotation.y += 0.1 * dt;
        this.appState.rotation.velocity *= 0.9;
    }

    this.mainGroup.rotation.y = this.appState.rotation.y;
    this.mainGroup.rotation.x = this.appState.rotation.x;

    // DoF logic
    if (this.bokehPass) {
        const uniforms = this.bokehPass.uniforms as any;
        if (mode === 'FOCUS') {
            uniforms.focus.value = THREE.MathUtils.lerp(uniforms.focus.value, 35.0, dt * 2);
            uniforms.aperture.value = THREE.MathUtils.lerp(uniforms.aperture.value, 0.00001, dt * 2);
            uniforms.maxblur.value = THREE.MathUtils.lerp(uniforms.maxblur.value, 0.002, dt * 2);
        } else if (mode === 'GALLERY') {
            uniforms.focus.value = THREE.MathUtils.lerp(uniforms.focus.value, 20.0, dt * 2);
            uniforms.aperture.value = THREE.MathUtils.lerp(uniforms.aperture.value, 0.000005, dt * 2);
            uniforms.maxblur.value = THREE.MathUtils.lerp(uniforms.maxblur.value, 0.001, dt * 2);
        } else {
            uniforms.focus.value = THREE.MathUtils.lerp(uniforms.focus.value, 40.0, dt * 2);
            uniforms.aperture.value = THREE.MathUtils.lerp(uniforms.aperture.value, 0.00002, dt * 2);
            uniforms.maxblur.value = THREE.MathUtils.lerp(uniforms.maxblur.value, 0.003, dt * 2);
        }
    }

    // Particle Updates
    this.particleSystem.forEach(p => this.updateParticle(p, dt, mode, this.appState.focusTarget));
    
    this.composer.render();
  }

  private updateParticle(p: ParticleData, dt: number, mode: AppMode, focusTarget: THREE.Object3D | null) {
      if (p.type === 'SNOWFLAKE' && p.userData) {
          const mesh = p.mesh;
          mesh.position.y -= p.userData.fallSpeed * dt;
          mesh.position.x = p.userData.initialX + Math.sin(this.clock.elapsedTime * p.userData.swaySpeed) * p.userData.swayAmount;
          mesh.rotation.z += dt * 0.5;
          if (mesh.position.y < -20) mesh.position.y = 40 + Math.random() * 10;
          return;
      }

      let target = p.posTree;

      if (mode === 'GALLERY') {
          if (p.type === 'PHOTO') {
              const photos = this.particleSystem.filter(pt => pt.type === 'PHOTO');
              const index = photos.indexOf(p);
              const total = photos.length;
              const angle = (index / total - 0.5) * Math.PI * 1.2;
              const radius = 15;
              target = new THREE.Vector3(
                  Math.sin(angle) * radius,
                  2 + Math.sin(index * 0.5) * 2,
                  Math.cos(angle) * radius - 10
              );
          } else {
              target = p.posScatter;
          }
      } else if (mode === 'SCATTER') {
          target = p.posScatter;
      } else if (mode === 'FOCUS') {
          if (p.mesh === focusTarget) {
              const desiredWorldPos = new THREE.Vector3(0, 2, 35);
              const invMatrix = new THREE.Matrix4().copy(this.mainGroup.matrixWorld).invert();
              target = desiredWorldPos.applyMatrix4(invMatrix);
          } else {
              target = p.posScatter;
          }
      }

      const lerpSpeed = (mode === 'FOCUS' && p.mesh === focusTarget) ? 5.0 : 2.0;
      p.mesh.position.lerp(target, lerpSpeed * dt);

      if (mode === 'SCATTER') {
          p.mesh.rotation.x += p.spinSpeed.x * dt;
          p.mesh.rotation.y += p.spinSpeed.y * dt;
          p.mesh.rotation.z += p.spinSpeed.z * dt;
      } else if (mode === 'TREE') {
          p.mesh.rotation.x = THREE.MathUtils.lerp(p.mesh.rotation.x, 0, dt);
          p.mesh.rotation.z = THREE.MathUtils.lerp(p.mesh.rotation.z, 0, dt);
          p.mesh.rotation.y += 0.5 * dt;
      } else if (mode === 'GALLERY' && p.type === 'PHOTO') {
          p.mesh.lookAt(this.camera.position);
      }

      if (mode === 'FOCUS' && p.mesh === focusTarget) {
          p.mesh.lookAt(this.camera.position);
      }

      let s = p.baseScale;
      if (p.isDust) {
          s = p.baseScale * (0.8 + 0.4 * Math.sin(this.clock.elapsedTime * 4 + p.mesh.id));
          if (mode === 'TREE') s = 0;
      } else if (mode === 'GALLERY' && p.type === 'PHOTO') {
          s = p.baseScale * 3.0;
      } else if (mode === 'SCATTER' && p.type === 'PHOTO') {
          s = p.baseScale * 2.5;
      } else if (mode === 'FOCUS') {
          s = (p.mesh === focusTarget) ? 4.5 : p.baseScale * 0.8;
      }
      p.mesh.scale.lerp(new THREE.Vector3(s, s, s), 4 * dt);
  }
}