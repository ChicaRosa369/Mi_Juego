import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function seeded(index) {
  const value = Math.sin(index * 127.1 + 311.7) * 43758.5453123;
  return value - Math.floor(value);
}

function makeGlowTexture(inner = 'rgba(255, 242, 160, 1)', outer = 'rgba(255, 198, 63, 0)') {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(64, 64, 1, 64, 64, 64);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(.2, inner);
  gradient.addColorStop(1, outer);
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function cylinderBetween(start, end, radiusTop, radiusBottom, material, radialSegments = 8) {
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, length, radialSegments, 1, false);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(start).add(end).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(UP, direction.normalize());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.time = 0;
    this.platforms = [];
    this.climbables = [];
    this.thermals = [];
    this.collectibles = [];
    this.fruits = [];
    this.animated = [];
    this.occluders = [];
    this.altar = null;
    this.altarSlots = [];
    this.altarBeam = null;
    this.godRays = [];
    this.fireflies = null;
    this.waterMaterials = [];
    this.glowTexture = makeGlowTexture();
    this.mistTexture = makeGlowTexture('rgba(224, 255, 192, .27)', 'rgba(224,255,192,0)');

    this.materials = {
      bark: new THREE.MeshStandardMaterial({ color: '#6b3d24', roughness: .9, flatShading: true }),
      barkLight: new THREE.MeshStandardMaterial({ color: '#a85e30', roughness: .88, flatShading: true }),
      wood: new THREE.MeshStandardMaterial({ color: '#8c4e2d', roughness: .82, flatShading: true }),
      moss: new THREE.MeshStandardMaterial({ color: '#6fae3e', roughness: .92, flatShading: true }),
      mossLight: new THREE.MeshStandardMaterial({ color: '#9acd57', roughness: .88, flatShading: true }),
      leaf: new THREE.MeshStandardMaterial({ color: '#3e8748', roughness: .9, flatShading: true }),
      leafLight: new THREE.MeshStandardMaterial({ color: '#82bb52', roughness: .85, flatShading: true }),
      leafDark: new THREE.MeshStandardMaterial({ color: '#215d3d', roughness: .93, flatShading: true }),
      stone: new THREE.MeshStandardMaterial({ color: '#496452', roughness: .94, flatShading: true }),
      stoneLight: new THREE.MeshStandardMaterial({ color: '#789172', roughness: .94, flatShading: true }),
      vine: new THREE.MeshStandardMaterial({ color: '#376c36', roughness: .9, flatShading: true }),
      gold: new THREE.MeshStandardMaterial({ color: '#f5ae36', emissive: '#d9781b', emissiveIntensity: 1.25, roughness: .35, metalness: .1, flatShading: true }),
      goldSoft: new THREE.MeshStandardMaterial({ color: '#ffdf76', emissive: '#f5a930', emissiveIntensity: 1.5, roughness: .28, flatShading: true }),
    };

    this.build();
  }

  terrainHeight(x, z) {
    const rolling = Math.sin(x * .085) * .42 + Math.cos(z * .115) * .36 + Math.sin((x + z) * .055) * .32;
    const clearing = Math.exp(-((x * x) + ((z - 15) * (z - 15))) / 500) * -.32;
    return rolling + clearing;
  }

  build() {
    this.createSky();
    this.createTerrain();
    this.createWater();
    this.createForest();
    this.createPlatforms();
    this.createThermals();
    this.createCollectibles();
    this.createAltar();
    this.createFortress();
    this.createAmbientLife();
    this.createGodRays();
  }

  createSky() {
    const skyGeometry = new THREE.SphereGeometry(280, 32, 16);
    const skyMaterial = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color('#3d9d9d') },
        horizonColor: { value: new THREE.Color('#b6dc88') },
        bottomColor: { value: new THREE.Color('#143f39') },
      },
      vertexShader: `varying vec3 vWorld; void main() { vWorld = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 topColor; uniform vec3 horizonColor; uniform vec3 bottomColor; varying vec3 vWorld; void main() { float h = normalize(vWorld).y * .5 + .5; vec3 color = mix(bottomColor, horizonColor, smoothstep(.18, .55, h)); color = mix(color, topColor, smoothstep(.52, 1.0, h)); gl_FragColor = vec4(color, 1.0); }`,
    });
    this.scene.add(new THREE.Mesh(skyGeometry, skyMaterial));

    const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTexture, color: '#fff1a0', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    sun.position.set(-76, 77, -112);
    sun.scale.set(38, 38, 1);
    this.scene.add(sun);

    for (let index = 0; index < 11; index += 1) {
      const cloud = new THREE.Group();
      const cloudMaterial = new THREE.MeshBasicMaterial({ color: index % 2 ? '#d7edb5' : '#e8f1c0', transparent: true, opacity: .2, depthWrite: false });
      for (let puff = 0; puff < 4; puff += 1) {
        const geometry = new THREE.DodecahedronGeometry(3 + seeded(index * 9 + puff) * 3, 0);
        const mesh = new THREE.Mesh(geometry, cloudMaterial);
        mesh.position.set((puff - 1.5) * 4, seeded(index + puff) * 2, seeded(index + puff + 5) * 3);
        mesh.scale.y = .42;
        cloud.add(mesh);
      }
      cloud.position.set((seeded(index + 50) - .5) * 190, 36 + seeded(index + 90) * 42, -70 - seeded(index + 120) * 120);
      cloud.scale.setScalar(.7 + seeded(index + 160) * 1.2);
      this.scene.add(cloud);
      this.animated.push({ type: 'cloud', object: cloud, speed: .18 + seeded(index + 190) * .18 });
    }
  }

  createTerrain() {
    const geometry = new THREE.PlaneGeometry(220, 220, 70, 70);
    geometry.rotateX(-Math.PI / 2);
    const positions = geometry.attributes.position;
    for (let index = 0; index < positions.count; index += 1) {
      const x = positions.getX(index);
      const z = positions.getZ(index);
      positions.setY(index, this.terrainHeight(x, z));
    }
    geometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({ color: '#254b35', roughness: 1, flatShading: true });
    const terrain = new THREE.Mesh(geometry, material);
    terrain.receiveShadow = true;
    this.scene.add(terrain);

    const clearingGeometry = new THREE.CircleGeometry(18, 24);
    const clearing = new THREE.Mesh(clearingGeometry, new THREE.MeshStandardMaterial({ color: '#4f8040', roughness: 1, flatShading: true }));
    clearing.rotation.x = -Math.PI / 2;
    clearing.position.set(0, this.terrainHeight(0, 15) + .025, 15);
    clearing.receiveShadow = true;
    this.scene.add(clearing);

    const rockGeometry = new THREE.DodecahedronGeometry(1, 0);
    for (let index = 0; index < 95; index += 1) {
      const x = (seeded(index * 8) - .5) * 185;
      const z = (seeded(index * 8 + 1) - .5) * 185;
      if (Math.hypot(x, z - 15) < 19) continue;
      const rock = new THREE.Mesh(rockGeometry, index % 3 ? this.materials.stone : this.materials.stoneLight);
      const scale = .18 + seeded(index * 8 + 2) * .85;
      rock.scale.set(scale * 1.1, scale * (.55 + seeded(index) * .55), scale);
      rock.position.set(x, this.terrainHeight(x, z) + rock.scale.y * .45, z);
      rock.rotation.set(seeded(index) * 3, seeded(index + 30) * 3, seeded(index + 70) * 3);
      rock.castShadow = true;
      rock.receiveShadow = true;
      this.scene.add(rock);
    }
  }

  createWater() {
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `uniform float uTime; varying float vWave; varying vec2 vUv; void main() { vUv = uv; vec3 transformed = position; float wave = sin(position.x * .35 + uTime * 1.7) * .13 + cos(position.y * .21 + uTime * 1.25) * .1; transformed.z += wave; vWave = wave; gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0); }`,
      fragmentShader: `varying float vWave; varying vec2 vUv; void main() { vec3 water = mix(vec3(.04,.31,.34), vec3(.12,.65,.57), vUv.y + vWave); float shimmer = smoothstep(.86, 1.0, sin((vUv.x + vUv.y) * 54.0) * .5 + .5); gl_FragColor = vec4(water + shimmer * vec3(.12,.18,.08), .78); }`,
    });
    const river = new THREE.Mesh(new THREE.PlaneGeometry(18, 216, 10, 64), material);
    river.rotation.x = -Math.PI / 2;
    river.position.set(-39, -.55, 0);
    this.scene.add(river);
    this.waterMaterials.push(material);

    const stream = new THREE.Mesh(new THREE.PlaneGeometry(7, 96, 6, 30), material.clone());
    stream.rotation.x = -Math.PI / 2;
    stream.rotation.z = -.36;
    stream.position.set(35, -.28, 13);
    this.scene.add(stream);
    this.waterMaterials.push(stream.material);

    for (let index = 0; index < 24; index += 1) {
      const lily = new THREE.Mesh(new THREE.CircleGeometry(.65 + seeded(index) * .5, 7), new THREE.MeshStandardMaterial({ color: index % 4 ? '#5f9d42' : '#a6c653', roughness: .85, flatShading: true }));
      lily.rotation.x = -Math.PI / 2;
      lily.position.set(-41 + (seeded(index + 10) - .5) * 12, -.39, (seeded(index + 30) - .5) * 174);
      this.scene.add(lily);
    }
  }

  createForest() {
    this.addTree(-4, -6, 4.7, { giant: true, canopy: 2.3 });
    const heroTrees = [
      [-31, 5, 3.1], [28, 11, 3.6], [-18, -26, 3.3], [23, -29, 3.9], [-30, -58, 4.4], [31, -60, 4.5],
      [4, -45, 3.4], [-3, -82, 4.4], [45, -22, 2.9], [-47, -14, 3.2], [47, 42, 3.0], [-47, 43, 3.7],
    ];
    heroTrees.forEach(([x, z, scale], index) => this.addTree(x, z, scale, { canopy: 1.5 + (index % 3) * .22 }));

    for (let index = 0; index < 48; index += 1) {
      const x = (seeded(index * 17 + 1) - .5) * 184;
      const z = (seeded(index * 17 + 2) - .5) * 188;
      if (Math.hypot(x + 4, z + 6) < 25 || Math.hypot(x, z - 15) < 22 || Math.abs(x + 39) < 13) continue;
      this.addTree(x, z, .65 + seeded(index * 17 + 3) * 1.15, { canopy: .65 + seeded(index * 17 + 4) * .8, detail: false });
    }

    const leafGeometry = new THREE.DodecahedronGeometry(1, 0);
    const leafMaterials = [this.materials.leaf, this.materials.leafLight, this.materials.leafDark];
    for (let index = 0; index < 250; index += 1) {
      const x = (seeded(index * 4 + 40) - .5) * 197;
      const z = (seeded(index * 4 + 41) - .5) * 198;
      if (Math.hypot(x, z - 15) < 15) continue;
      const bush = new THREE.Mesh(leafGeometry, leafMaterials[index % leafMaterials.length]);
      const scale = .3 + seeded(index * 4 + 42) * .95;
      bush.scale.set(scale * (1.2 + seeded(index) * .5), scale * .7, scale);
      bush.position.set(x, this.terrainHeight(x, z) + scale * .36, z);
      bush.rotation.set(seeded(index + 10) * 2, seeded(index + 50) * 4, 0);
      bush.castShadow = true;
      this.scene.add(bush);
    }
  }

  addTree(x, z, scale, options = {}) {
    const base = this.terrainHeight(x, z);
    const group = new THREE.Group();
    const height = scale * (options.giant ? 10.5 : 7.8);
    const radius = scale * (options.giant ? 1.18 : .65);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(radius * .6, radius, height, options.giant ? 10 : 7, 5), options.giant ? this.materials.barkLight : this.materials.bark);
    trunk.position.y = base + height / 2;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    group.add(trunk);
    this.occluders.push(trunk);

    const rootGeometry = new THREE.ConeGeometry(radius * .65, height * .18, 5);
    for (let root = 0; root < 5; root += 1) {
      const mesh = new THREE.Mesh(rootGeometry, this.materials.bark);
      const angle = root / 5 * Math.PI * 2 + .25;
      mesh.position.set(Math.cos(angle) * radius * .74, base + height * .055, Math.sin(angle) * radius * .74);
      mesh.rotation.set(Math.PI / 2, 0, -angle);
      mesh.scale.set(1, 1.6, 1);
      mesh.castShadow = true;
      group.add(mesh);
    }

    const canopyY = base + height * .84;
    const canopyCount = options.giant ? 15 : options.detail === false ? 5 : 8;
    const canopyGeometry = new THREE.DodecahedronGeometry(scale * (options.giant ? 1.58 : 1.1) * (options.canopy || 1), 0);
    for (let leaf = 0; leaf < canopyCount; leaf += 1) {
      const angle = (leaf / canopyCount) * Math.PI * 2 + seeded(x * leaf + z) * .5;
      const layer = leaf % 3;
      const mesh = new THREE.Mesh(canopyGeometry, leaf % 4 === 0 ? this.materials.leafLight : leaf % 3 === 0 ? this.materials.leafDark : this.materials.leaf);
      const spread = scale * (.6 + seeded(leaf + x) * .72) * (options.giant ? 1.45 : 1);
      mesh.position.set(Math.cos(angle) * spread, canopyY + layer * scale * .85 + seeded(leaf + z) * scale, Math.sin(angle) * spread);
      mesh.scale.set(1.1 + seeded(leaf) * .65, .62 + seeded(leaf + 90) * .42, 1.1 + seeded(leaf + 30) * .55);
      mesh.rotation.set(seeded(leaf + x) * .6, seeded(leaf + z) * 2, seeded(leaf + 120) * .5);
      mesh.castShadow = true;
      group.add(mesh);
    }

    if (options.giant) {
      const branchEnds = [new THREE.Vector3(12, height * .58, 2), new THREE.Vector3(-10, height * .72, -5), new THREE.Vector3(7, height * .82, -10)];
      branchEnds.forEach((end, index) => {
        const start = new THREE.Vector3(0, height * (.56 + index * .08), 0);
        const branch = cylinderBetween(start, end, radius * .23, radius * .42, this.materials.barkLight, 8);
        group.add(branch);
        const leaf = new THREE.Mesh(new THREE.DodecahedronGeometry(scale * 1.6, 0), this.materials.leafLight);
        leaf.position.copy(end).add(new THREE.Vector3(0, 1.2, 0));
        leaf.scale.set(1.65, .55, 1.15);
        leaf.castShadow = true;
        group.add(leaf);
      });
    }

    group.position.set(x, 0, z);
    this.scene.add(group);
    this.climbables.push({ x, z, radius: radius + .18, base, top: base + height * .83 });
    return group;
  }

  addPlatform({ x, z, top, width, depth, style = 'moss', name = '', floating = false }) {
    const group = new THREE.Group();
    const baseHeight = floating ? 1.35 : .85;
    const base = new THREE.Mesh(new THREE.BoxGeometry(width, baseHeight, depth), style === 'wood' ? this.materials.wood : this.materials.bark);
    base.position.y = top - baseHeight / 2;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);
    const turf = new THREE.Mesh(new THREE.BoxGeometry(width * .98, .18, depth * .98), style === 'wood' ? this.materials.mossLight : this.materials.moss);
    turf.position.y = top - .05;
    turf.castShadow = true;
    turf.receiveShadow = true;
    group.add(turf);

    const rockGeometry = new THREE.DodecahedronGeometry(.55, 0);
    for (let index = 0; index < 7; index += 1) {
      const decoration = new THREE.Mesh(index % 3 ? rockGeometry : new THREE.ConeGeometry(.35, 1.0, 5), index % 3 ? this.materials.stoneLight : this.materials.leafLight);
      decoration.position.set((seeded(index + x) - .5) * width * .78, top + (index % 3 ? .18 : .43), (seeded(index + z + 99) - .5) * depth * .78);
      decoration.scale.setScalar(.6 + seeded(index + x + z) * .6);
      decoration.rotation.y = seeded(index + z) * Math.PI;
      decoration.castShadow = true;
      group.add(decoration);
    }
    group.position.set(x, 0, z);
    this.scene.add(group);
    this.platforms.push({ x, z, top, width, depth, name });
    this.occluders.push(base);
    return group;
  }

  createPlatforms() {
    this.addPlatform({ x: 10, z: 12, top: 7.2, width: 15, depth: 10, name: 'Nido del Alba', floating: true });
    this.addPlatform({ x: -15, z: -8, top: 17.5, width: 15, depth: 11, name: 'Puente de Lianas', floating: true });
    this.addPlatform({ x: 11, z: -34, top: 28.8, width: 16, depth: 11, name: 'Copa del Viento', floating: true });
    this.addPlatform({ x: 0, z: -62, top: 39.5, width: 31, depth: 25, style: 'wood', name: 'Fortaleza de Chatarra', floating: true });

    this.addPlatform({ x: 24, z: 2, top: 5.8, width: 6, depth: 6, style: 'wood', name: 'Torre Vigía', floating: true });
    this.addPlatform({ x: -28, z: -20, top: 13.8, width: 6, depth: 6, style: 'wood', name: 'Torre Vigía', floating: true });

    const bridgePoints = [
      [new THREE.Vector3(3, 5.8, 12), new THREE.Vector3(9, 7.0, 12)],
      [new THREE.Vector3(5, 8.2, 6), new THREE.Vector3(-10, 16.8, -4)],
      [new THREE.Vector3(-8, 18.0, -11), new THREE.Vector3(4, 27.8, -29)],
      [new THREE.Vector3(11, 29.0, -38), new THREE.Vector3(3, 38.6, -52)],
    ];
    bridgePoints.forEach(([a, b], index) => {
      const log = cylinderBetween(a, b, .45, .62, this.materials.barkLight, 8);
      this.scene.add(log);
      for (let knot = 0; knot < 5; knot += 1) {
        const t = (knot + 1) / 6;
        const p = a.clone().lerp(b, t);
        const vine = new THREE.Mesh(new THREE.TorusGeometry(.42, .07, 5, 9), this.materials.vine);
        vine.position.copy(p);
        vine.rotation.x = Math.PI / 2;
        this.scene.add(vine);
      }
      this.animated.push({ type: 'bridge', object: log, phase: index });
    });

    // Lianas verticales que señalan las rutas de escalada.
    [[4, 7, 10], [-10, 10, -4], [5, 18, -27], [0, 30, -52]].forEach(([x, y, z], index) => {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(x, y - 7, z), new THREE.Vector3(x + (index % 2 ? .7 : -.7), y - 3.5, z + .4), new THREE.Vector3(x, y + 1, z),
      ]);
      const vine = new THREE.Mesh(new THREE.TubeGeometry(curve, 18, .10, 5, false), this.materials.vine);
      vine.castShadow = true;
      this.scene.add(vine);
    });
  }

  createThermals() {
    const thermalData = [
      { x: 2, z: 11, bottom: .1, top: 13, radius: 4.4, strength: 19 },
      { x: -7, z: -5, bottom: 1, top: 25, radius: 4.8, strength: 21 },
      { x: 4, z: -27, bottom: 8, top: 36, radius: 5.0, strength: 23 },
      { x: 1, z: -51, bottom: 17, top: 47, radius: 5.1, strength: 25 },
    ];
    thermalData.forEach((data, index) => this.addThermal(data, index));
  }

  addThermal(data, index) {
    const group = new THREE.Group();
    const height = data.top - data.bottom;
    const beamMaterial = new THREE.MeshBasicMaterial({ color: '#91f4ce', transparent: true, opacity: .075, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(data.radius * .38, data.radius, height, 16, 1, true), beamMaterial);
    beam.position.y = data.bottom + height / 2;
    group.add(beam);
    const ringMaterial = new THREE.MeshBasicMaterial({ color: '#b4ffe0', transparent: true, opacity: .72, depthWrite: false, blending: THREE.AdditiveBlending });
    for (let ringIndex = 0; ringIndex < 4; ringIndex += 1) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(data.radius * (.35 + ringIndex * .14), .055, 5, 18), ringMaterial.clone());
      ring.position.y = data.bottom + 1 + ringIndex * (height / 4.2);
      ring.rotation.x = Math.PI / 2;
      group.add(ring);
      this.animated.push({ type: 'thermalRing', object: ring, baseY: ring.position.y, bottom: data.bottom, top: data.top, index: ringIndex, phase: index * 2 + ringIndex });
    }
    for (let arrow = 0; arrow < 3; arrow += 1) {
      const marker = new THREE.Mesh(new THREE.ConeGeometry(.3, .85, 4), this.materials.mossLight);
      marker.position.set(Math.cos(arrow * 2.1) * data.radius * .2, data.bottom + 1.2 + arrow * 1.3, Math.sin(arrow * 2.1) * data.radius * .2);
      group.add(marker);
    }
    group.position.set(data.x, 0, data.z);
    this.scene.add(group);
    this.thermals.push({ ...data, group });
  }

  createCollectibles() {
    const seeds = [
      { id: 'dawn', title: 'Bellota Solar del Alba', x: 10, y: 9.3, z: 12, checkpoint: new THREE.Vector3(10, 8.5, 15) },
      { id: 'ember', title: 'Bellota Solar de Brasa', x: -15, y: 19.6, z: -8, checkpoint: new THREE.Vector3(-15, 18.6, -4) },
      { id: 'sky', title: 'Bellota Solar del Cielo', x: 11, y: 30.9, z: -34, checkpoint: new THREE.Vector3(11, 29.9, -29) },
    ];
    seeds.forEach((seed, index) => this.addSolarSeed(seed, index));

    const fruitData = [
      [4, 1.2, 18], [13, 8.8, 8], [17, 8.5, 14], [-9, 18.8, -3], [-20, 18.8, -10], [-14, 19, -14], [5, 30, -30], [15, 30, -36], [2, 40.8, -54], [-9, 40.8, -61], [12, 40.8, -65],
    ];
    fruitData.forEach(([x, y, z], index) => this.addFruit(x, y, z, index));
  }

  addSolarSeed(data, index) {
    const group = new THREE.Group();
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTexture, color: '#ffd665', transparent: true, opacity: .75, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.set(5.2, 5.2, 1);
    group.add(halo);
    const beacon = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTexture, color: '#ffe58c', transparent: true, opacity: .27, depthWrite: false, blending: THREE.AdditiveBlending }));
    beacon.position.y = 5.2;
    beacon.scale.set(3.4, 14, 1);
    group.add(beacon);
    const acorn = new THREE.Mesh(new THREE.SphereGeometry(.64, 8, 6), this.materials.gold);
    acorn.scale.y = 1.25;
    acorn.position.y = -.05;
    acorn.castShadow = true;
    group.add(acorn);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(.68, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), this.materials.goldSoft);
    cap.position.y = .42;
    cap.castShadow = true;
    group.add(cap);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(.07, .1, .42, 5), this.materials.mossLight);
    stem.position.y = 1.0;
    stem.rotation.z = .28;
    group.add(stem);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.12, .06, 5, 20), new THREE.MeshBasicMaterial({ color: '#ffe999', transparent: true, opacity: .92, blending: THREE.AdditiveBlending, depthWrite: false }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -.3;
    group.add(ring);
    const light = new THREE.PointLight('#ffca54', 1.8, 10, 2);
    light.position.y = 1;
    group.add(light);
    group.position.set(data.x, data.y, data.z);
    this.scene.add(group);
    this.collectibles.push({ ...data, group, collected: false, baseY: data.y, phase: index * 2.1, light });
  }

  addFruit(x, y, z, index) {
    const group = new THREE.Group();
    const fruit = new THREE.Mesh(new THREE.SphereGeometry(.34, 7, 6), new THREE.MeshStandardMaterial({ color: index % 2 ? '#ee704f' : '#ffbd4a', emissive: index % 2 ? '#722418' : '#754014', emissiveIntensity: .35, flatShading: true, roughness: .7 }));
    fruit.scale.y = 1.16;
    fruit.castShadow = true;
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(.18, .45, 4), this.materials.leafLight);
    leaf.position.y = .38;
    leaf.rotation.z = .45;
    group.add(fruit, leaf);
    group.position.set(x, y, z);
    this.scene.add(group);
    this.fruits.push({ group, position: group.position, collected: false, baseY: y, phase: index * .8 });
  }

  createAltar() {
    const y = this.terrainHeight(0, 15) + .18;
    const group = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(4.9, 5.7, .8, 9), this.materials.stone);
    base.position.y = y + .35;
    base.receiveShadow = true;
    base.castShadow = true;
    group.add(base);
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(4.35, 4.65, .22, 9), this.materials.stoneLight);
    plate.position.y = y + .83;
    plate.receiveShadow = true;
    group.add(plate);
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(.8, 1), new THREE.MeshStandardMaterial({ color: '#547a55', emissive: '#1d5e47', emissiveIntensity: .45, flatShading: true, roughness: .55 }));
    core.position.y = y + 1.55;
    core.castShadow = true;
    group.add(core);
    for (let slot = 0; slot < 3; slot += 1) {
      const angle = slot / 3 * Math.PI * 2 + .3;
      const socket = new THREE.Mesh(new THREE.TorusGeometry(.62, .12, 6, 14), new THREE.MeshStandardMaterial({ color: '#385f50', emissive: '#143a30', emissiveIntensity: .5, flatShading: true }));
      socket.position.set(Math.cos(angle) * 2.15, y + 1.14, Math.sin(angle) * 2.15);
      socket.rotation.x = Math.PI / 2;
      group.add(socket);
      this.altarSlots.push(socket);
    }
    const beamMaterial = new THREE.SpriteMaterial({ map: this.glowTexture, color: '#ffe47a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    const beam = new THREE.Sprite(beamMaterial);
    beam.position.set(0, y + 16, 0);
    beam.scale.set(14, 36, 1);
    group.add(beam);
    this.altarBeam = beam;
    group.position.set(0, 0, 15);
    this.scene.add(group);
    this.altar = { group, position: new THREE.Vector3(0, y + 1, 15), core, activated: false };
  }

  createFortress() {
    const group = new THREE.Group();
    const deckY = 40.05;
    const junkMaterials = [this.materials.wood, this.materials.barkLight, this.materials.stone];
    for (let index = 0; index < 18; index += 1) {
      const junk = new THREE.Mesh(index % 3 ? new THREE.BoxGeometry(1.2, 1.2, .8) : new THREE.CylinderGeometry(.5, .65, 1.8, 7), junkMaterials[index % junkMaterials.length]);
      const angle = index / 18 * Math.PI * 2;
      const radius = 10.5 + (index % 3) * 1.2;
      junk.position.set(Math.cos(angle) * radius, deckY + .7 + (index % 2) * .5, Math.sin(angle) * radius);
      junk.rotation.set(index * .3, index * .7, index * .2);
      junk.castShadow = true;
      group.add(junk);
    }
    for (const x of [-11, 11]) {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.45, 8, 6), this.materials.wood);
      tower.position.set(x, deckY + 3.8, -2);
      tower.castShadow = true;
      group.add(tower);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.2), new THREE.MeshBasicMaterial({ color: '#d44f3e', side: THREE.DoubleSide }));
      flag.position.set(x + .7, deckY + 7.1, -2);
      flag.rotation.y = Math.PI / 2;
      group.add(flag);
      this.animated.push({ type: 'flag', object: flag, phase: x });
    }
    const gate = new THREE.Mesh(new THREE.BoxGeometry(6.4, 4.4, .7), new THREE.MeshStandardMaterial({ color: '#403a39', roughness: .8, metalness: .35, flatShading: true }));
    gate.position.set(0, deckY + 2, -10.5);
    gate.castShadow = true;
    group.add(gate);
    group.position.set(0, 0, -62);
    this.scene.add(group);
  }

  createAmbientLife() {
    const count = 130;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const color = new THREE.Color();
    for (let index = 0; index < count; index += 1) {
      const x = (seeded(index * 7) - .5) * 108;
      const y = 1.2 + seeded(index * 7 + 1) * 32;
      const z = (seeded(index * 7 + 2) - .5) * 118;
      positions.set([x, y, z], index * 3);
      color.set(index % 3 ? '#d9ff9a' : '#f6d66b');
      colors.set([color.r, color.g, color.b], index * 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({ size: .18, vertexColors: true, transparent: true, opacity: .72, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
    this.fireflies = new THREE.Points(geometry, material);
    this.scene.add(this.fireflies);

    const butterflyMaterial = new THREE.MeshBasicMaterial({ color: '#ffc55d', side: THREE.DoubleSide, transparent: true, opacity: .9 });
    for (let index = 0; index < 9; index += 1) {
      const butterfly = new THREE.Group();
      const wingA = new THREE.Mesh(new THREE.CircleGeometry(.28, 5), butterflyMaterial);
      const wingB = wingA.clone();
      wingA.position.x = -.2;
      wingB.position.x = .2;
      wingA.rotation.y = .55;
      wingB.rotation.y = -.55;
      butterfly.add(wingA, wingB);
      butterfly.position.set(-8 + seeded(index) * 30, 3 + seeded(index + 19) * 10, 2 + seeded(index + 38) * 23);
      this.scene.add(butterfly);
      this.animated.push({ type: 'butterfly', object: butterfly, phase: index * .7, origin: butterfly.position.clone() });
    }
  }

  createGodRays() {
    const rayMaterial = new THREE.MeshBasicMaterial({ color: '#fff1a2', transparent: true, opacity: .08, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    for (let index = 0; index < 3; index += 1) {
      const ray = new THREE.Mesh(new THREE.PlaneGeometry(16 + index * 7, 110), rayMaterial.clone());
      ray.position.set(-22 + index * 21, 37 + index * 7, -13 - index * 16);
      ray.rotation.set(.72, -.42 + index * .22, .16);
      this.scene.add(ray);
      this.godRays.push(ray);
    }

    const mistMaterial = new THREE.SpriteMaterial({ map: this.mistTexture, transparent: true, opacity: .4, depthWrite: false, color: '#d7ffb5' });
    for (let index = 0; index < 13; index += 1) {
      const mist = new THREE.Sprite(mistMaterial.clone());
      mist.position.set((seeded(index + 230) - .5) * 92, 7 + seeded(index + 270) * 28, -5 + (seeded(index + 310) - .5) * 108);
      const size = 12 + seeded(index + 330) * 18;
      mist.scale.set(size * 1.9, size, 1);
      this.scene.add(mist);
      this.animated.push({ type: 'mist', object: mist, phase: index, origin: mist.position.clone() });
    }
  }

  getLandingHeight(x, z, previousY) {
    let height = this.terrainHeight(x, z);
    for (const platform of this.platforms) {
      if (Math.abs(x - platform.x) <= platform.width / 2 + .28 && Math.abs(z - platform.z) <= platform.depth / 2 + .28 && previousY >= platform.top - .7) {
        height = Math.max(height, platform.top);
      }
    }
    return height;
  }

  constrainPosition(position, radius = .45) {
    position.x = clamp(position.x, -102, 102);
    position.z = clamp(position.z, -103, 103);
    for (const tree of this.climbables) {
      const dx = position.x - tree.x;
      const dz = position.z - tree.z;
      const distance = Math.hypot(dx, dz);
      const protectedRadius = tree.radius + radius;
      if (distance < protectedRadius && distance > .001 && position.y < tree.top + 1.3) {
        position.x = tree.x + dx / distance * protectedRadius;
        position.z = tree.z + dz / distance * protectedRadius;
      }
    }
  }

  getClimbable(position) {
    let selected = null;
    let nearest = Infinity;
    for (const tree of this.climbables) {
      if (position.y > tree.top + .5) continue;
      const distance = Math.hypot(position.x - tree.x, position.z - tree.z);
      if (distance < tree.radius + .85 && distance < nearest) {
        selected = tree;
        nearest = distance;
      }
    }
    return selected;
  }

  getThermal(position) {
    for (const thermal of this.thermals) {
      const distance = Math.hypot(position.x - thermal.x, position.z - thermal.z);
      if (distance < thermal.radius && position.y > thermal.bottom - 1 && position.y < thermal.top + 2) return thermal;
    }
    return null;
  }

  collectAt(position) {
    const seeds = [];
    const fruits = [];
    for (const seed of this.collectibles) {
      if (!seed.collected && position.distanceTo(seed.group.position) < 2.05) {
        seed.collected = true;
        seed.group.visible = false;
        seeds.push(seed);
      }
    }
    for (const fruit of this.fruits) {
      if (!fruit.collected && position.distanceTo(fruit.position) < 1.5) {
        fruit.collected = true;
        fruit.group.visible = false;
        fruits.push(fruit);
      }
    }
    return { seeds, fruits };
  }

  updateAltarSeeds(amount) {
    this.altarSlots.forEach((slot, index) => {
      const active = index < amount;
      slot.material.color.set(active ? '#ffcf59' : '#385f50');
      slot.material.emissive.set(active ? '#e47f1d' : '#143a30');
      slot.material.emissiveIntensity = active ? 1.75 : .5;
    });
    if (amount === 3) {
      this.altar.core.material.color.set('#ffdb63');
      this.altar.core.material.emissive.set('#f3a229');
      this.altar.core.material.emissiveIntensity = 1.25;
    }
  }

  awakenAltar() {
    if (this.altar.activated) return;
    this.altar.activated = true;
    this.altarBeam.material.opacity = .95;
    this.altar.core.material.emissiveIntensity = 3.5;
    this.godRays.forEach((ray) => { ray.material.opacity = .19; });
  }

  isAtAltar(position) {
    return position.distanceTo(this.altar.position) < 4.7;
  }

  update(delta, elapsed) {
    this.time = elapsed;
    for (const material of this.waterMaterials) material.uniforms.uTime.value = elapsed;
    for (const ray of this.godRays) ray.material.opacity = (this.altar?.activated ? .15 : .07) + Math.sin(elapsed * .45 + ray.position.x) * .018;
    if (this.fireflies) {
      this.fireflies.rotation.y = elapsed * .011;
      this.fireflies.position.y = Math.sin(elapsed * .31) * .35;
    }
    for (const seed of this.collectibles) {
      if (!seed.collected) {
        seed.group.rotation.y += delta * 1.2;
        seed.group.position.y = seed.baseY + Math.sin(elapsed * 2 + seed.phase) * .28;
        seed.light.intensity = 1.45 + Math.sin(elapsed * 4 + seed.phase) * .45;
      }
    }
    for (const fruit of this.fruits) {
      if (!fruit.collected) {
        fruit.group.rotation.y += delta * 1.8;
        fruit.group.position.y = fruit.baseY + Math.sin(elapsed * 2.5 + fruit.phase) * .12;
      }
    }
    for (const item of this.animated) {
      if (item.type === 'cloud') item.object.position.x += item.speed * delta;
      if (item.type === 'cloud' && item.object.position.x > 115) item.object.position.x = -115;
      if (item.type === 'thermalRing') {
        const normalized = (elapsed * .22 + item.phase * .17) % 1;
        item.object.position.y = item.bottom + normalized * (item.top - item.bottom);
        item.object.rotation.z += delta * .8;
        item.object.material.opacity = .7 * (1 - normalized);
      }
      if (item.type === 'flag') item.object.rotation.z = Math.sin(elapsed * 2.4 + item.phase) * .15;
      if (item.type === 'bridge') item.object.rotation.z += Math.sin(elapsed * .45 + item.phase) * delta * .0004;
      if (item.type === 'butterfly') {
        item.object.position.x = item.origin.x + Math.sin(elapsed * 1.3 + item.phase) * 1.8;
        item.object.position.y = item.origin.y + Math.sin(elapsed * 2.1 + item.phase) * .45;
        item.object.rotation.z = Math.sin(elapsed * 8 + item.phase) * .32;
      }
      if (item.type === 'mist') {
        item.object.position.x = item.origin.x + Math.sin(elapsed * .09 + item.phase) * 5;
        item.object.material.opacity = .24 + Math.sin(elapsed * .35 + item.phase) * .11;
      }
    }
    if (this.altar?.activated) this.altarBeam.scale.set(1 + Math.sin(elapsed * 2) * .05, 1 + Math.sin(elapsed * 1.4) * .08, 1);
  }
}
