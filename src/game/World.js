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
    this.platformById = new Map();
    this.walkways = [];
    this.climbables = [];
    this.climbingVines = [];
    this.thermals = [];
    this.collectibles = [];
    this.fruits = [];
    this.ammoPacks = [];
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
    // Las plataformas se colocan antes que los árboles para reservarles un corredor limpio.
    this.createPlatforms();
    this.createForest();
    this.createClimbingVines();
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

    const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTexture, color: '#fff1a0', transparent: true, opacity: .62, depthWrite: false, blending: THREE.AdditiveBlending }));
    sun.position.set(-76, 77, -112);
    sun.scale.set(32, 32, 1);
    this.scene.add(sun);

    for (let index = 0; index < 13; index += 1) {
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

    // Rocas de paisaje colocadas a mano: dejan la zona del altar y el corredor de juego despejados.
    const rockData = [
      [-23, 28, .72, .1], [-34, 18, .58, .8], [23, 25, .64, .4], [36, 14, .83, 1.1],
      [-29, 2, .76, .6], [31, -4, .51, 1.6], [-34, -18, .88, .2], [34, -20, .69, .9],
      [-39, -37, .83, 1.8], [38, -34, .61, .4], [-31, -49, .92, 1.2], [42, -53, .75, .6],
      [-36, -67, .68, 1.9], [35, -70, .88, .3], [-41, -87, .73, .8], [38, -90, .56, 1.4],
      [-37, -105, .95, .2], [39, -106, .76, 1.1], [-58, 38, .64, .5], [58, 35, .78, 1.7],
      [-61, -12, .82, .3], [61, -17, .68, 1.2], [-61, -63, .74, .7], [62, -70, .9, 1.5],
    ];
    const rockGeometry = new THREE.DodecahedronGeometry(1, 0);
    rockData.forEach(([x, z, scale, rotation], index) => {
      const rock = new THREE.Mesh(rockGeometry, index % 3 ? this.materials.stone : this.materials.stoneLight);
      rock.scale.set(scale * 1.1, scale * (index % 2 ? .72 : .95), scale);
      rock.position.set(x, this.terrainHeight(x, z) + rock.scale.y * .45, z);
      rock.rotation.set(index % 2 ? .15 : .35, rotation, index % 3 ? .22 : -.18);
      rock.castShadow = true;
      rock.receiveShadow = true;
      this.scene.add(rock);
    });
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

    // Nenúfares distribuidos por grupos definidos, evitando la sensación de objetos al azar.
    const lilyPads = [
      [-43, 34, .78], [-39, 30, .62], [-35, 27, .84], [-42, 18, .7], [-36, 13, .92],
      [-44, 2, .76], [-37, -7, .65], [-42, -20, .88], [-36, -29, .72], [-43, -40, .95],
      [-37, -50, .68], [-42, -63, .84], [-35, -71, .7], [-43, -82, .91], [-37, -94, .74],
      [-42, -104, .88],
    ];
    lilyPads.forEach(([x, z, scale], index) => {
      const lily = new THREE.Mesh(new THREE.CircleGeometry(scale, 7), new THREE.MeshStandardMaterial({ color: index % 4 ? '#5f9d42' : '#a6c653', roughness: .85, flatShading: true }));
      lily.rotation.x = -Math.PI / 2;
      lily.position.set(x, -.39, z);
      this.scene.add(lily);
    });
  }

  createForest() {
    // Bosque diseñado a mano: los árboles enmarcan el recorrido, no lo atraviesan.
    const forestPlan = [
      { x: -48, z: 8, scale: 4.1, giant: true, canopy: 1.75 },
      { x: -34, z: 30, scale: 3.2, canopy: 1.35 }, { x: 31, z: 25, scale: 3.1, canopy: 1.3 },
      { x: 45, z: 16, scale: 3.0, canopy: 1.2 }, { x: -47, z: -3, scale: 3.25, canopy: 1.35 },
      { x: 38, z: -11, scale: 3.0, canopy: 1.2 }, { x: -48, z: -33, scale: 3.35, canopy: 1.35 },
      { x: 37, z: -28, scale: 3.15, canopy: 1.25 }, { x: -42, z: -48, scale: 3.5, canopy: 1.3 },
      { x: 53, z: -39, scale: 3.4, canopy: 1.3 }, { x: -40, z: -63, scale: 3.55, canopy: 1.35 },
      { x: 48, z: -67, scale: 3.45, canopy: 1.3 }, { x: -40, z: -83, scale: 3.55, canopy: 1.35 },
      { x: 40, z: -83, scale: 3.55, canopy: 1.35 }, { x: -40, z: -105, scale: 3.7, canopy: 1.35 },
      { x: 40, z: -106, scale: 3.7, canopy: 1.35 }, { x: -58, z: 38, scale: 2.7, canopy: 1.05, detail: false },
      { x: 58, z: 35, scale: 2.8, canopy: 1.05, detail: false }, { x: -61, z: -12, scale: 2.9, canopy: 1.1, detail: false },
      { x: 61, z: -17, scale: 2.8, canopy: 1.1, detail: false }, { x: -61, z: -63, scale: 2.9, canopy: 1.1, detail: false },
      { x: 62, z: -70, scale: 3.0, canopy: 1.1, detail: false },
    ];
    forestPlan.forEach((tree) => this.addTree(tree.x, tree.z, tree.scale, tree));

    // El sotobosque también está agrupado a propósito, siempre fuera del corredor jugable.
    const undergrowth = [
      [-27, 24, .8], [-30, 19, .6], [24, 20, .7], [35, 8, .55], [-30, 0, .72], [30, -4, .6],
      [-31, -23, .82], [29, -22, .7], [-34, -41, .76], [36, -39, .64], [-31, -57, .86], [34, -57, .74],
      [-34, -72, .7], [40, -58, .82], [-31, -90, .85], [32, -92, .72], [-33, -106, .78], [32, -105, .72],
    ];
    const leafGeometry = new THREE.DodecahedronGeometry(1, 0);
    undergrowth.forEach(([x, z, scale], index) => {
      const bush = new THREE.Mesh(leafGeometry, [this.materials.leaf, this.materials.leafLight, this.materials.leafDark][index % 3]);
      bush.scale.set(scale * (index % 2 ? 1.35 : 1.12), scale * .68, scale);
      bush.position.set(x, this.terrainHeight(x, z) + scale * .34, z);
      bush.rotation.set(index % 2 ? .14 : .28, index * .45, 0);
      bush.castShadow = true;
      this.scene.add(bush);
    });
  }

  addTree(x, z, scale, options = {}) {
    const base = this.terrainHeight(x, z);
    const group = new THREE.Group();
    const height = scale * (options.giant ? 10.5 : 7.8);
    const radius = scale * (options.giant ? 1.18 : .65);
    const canopyFactor = options.canopy || 1;
    const canopyGeometryRadius = scale * (options.giant ? 1.58 : 1.1) * canopyFactor;
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
    const canopyGeometry = new THREE.DodecahedronGeometry(canopyGeometryRadius, 0);
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
    // Estos límites conservadores se usan en la validación del plano para que la copa no invada plataformas altas.
    const maximumSpread = scale * (options.giant ? 1.914 : 1.32);
    const canopyRadius = canopyGeometryRadius * 1.75 + maximumSpread;
    const branchFoliageBottom = options.giant ? base + height * .58 + 1.2 - scale * .9 : Infinity;
    const canopyBottom = Math.min(canopyY - canopyGeometryRadius * 1.04, branchFoliageBottom);
    const canopyTop = canopyY + scale * 2.7 + canopyGeometryRadius * 1.04;
    this.climbables.push({ x, z, radius: radius + .18, base, top: base + height * .83, solid: true, canopyRadius, canopyBottom, canopyTop });
    return group;
  }

  addPlatform({ id, x, z, top, width, depth, style = 'moss', name = '', floating = false, decorate = true }) {
    const group = new THREE.Group();
    const baseHeight = floating ? 1.7 : .95;
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

    // Detalles en bordes concretos: el centro se reserva para aterrizar y recoger objetos.
    if (decorate) {
      const edgeDetails = style === 'wood'
        ? [[-.34, -.3, 'leaf'], [.34, .3, 'rock']]
        : [[-.36, -.31, 'rock'], [.34, .31, 'leaf'], [-.34, .31, 'leaf']];
      edgeDetails.forEach(([horizontal, depthOffset, type], index) => {
        const geometry = type === 'rock' ? new THREE.DodecahedronGeometry(.48, 0) : new THREE.ConeGeometry(.28, .82, 5);
        const decoration = new THREE.Mesh(geometry, type === 'rock' ? this.materials.stoneLight : this.materials.leafLight);
        decoration.position.set(horizontal * width, top + (type === 'rock' ? .2 : .4), depthOffset * depth);
        decoration.scale.setScalar(index === 1 ? .82 : .66);
        decoration.rotation.y = index * 1.7;
        decoration.castShadow = true;
        group.add(decoration);
      });
    }
    group.position.set(x, 0, z);
    this.scene.add(group);
    const platform = { id, x, z, top, width, depth, name, baseHeight, landingDepth: floating ? 2.35 : 1.15 };
    this.platforms.push(platform);
    this.platformById.set(id, platform);
    this.occluders.push(base);
    return platform;
  }

  getPlatform(id) {
    const platform = this.platformById.get(id);
    if (!platform) throw new Error(`Plataforma desconocida: ${id}`);
    return platform;
  }

  getPlatformPoint(id, offsetX = 0, offsetZ = 0, height = 0) {
    const platform = this.getPlatform(id);
    return new THREE.Vector3(platform.x + offsetX, platform.top + height, platform.z + offsetZ);
  }

  getPlatformEdge(platform, target) {
    const direction = new THREE.Vector3(target.x - platform.x, 0, target.z - platform.z);
    const length = direction.length();
    if (length < .001) return new THREE.Vector3(platform.x, platform.top, platform.z);
    direction.multiplyScalar(1 / length);
    const inset = .28;
    const xDistance = Math.abs(direction.x) > .001 ? (platform.width / 2 - inset) / Math.abs(direction.x) : Infinity;
    const zDistance = Math.abs(direction.z) > .001 ? (platform.depth / 2 - inset) / Math.abs(direction.z) : Infinity;
    const distance = Math.min(xDistance, zDistance);
    return new THREE.Vector3(platform.x + direction.x * distance, platform.top, platform.z + direction.z * distance);
  }

  addRouteBridge(fromId, toId, index) {
    const from = this.getPlatform(fromId);
    const to = this.getPlatform(toId);
    const start = this.getPlatformEdge(from, to);
    const end = this.getPlatformEdge(to, from);
    if (start.distanceTo(end) < .25) return;

    // El tronco visual y su superficie de colisión comparten exactamente el mismo tramo.
    const visualStart = start.clone();
    const visualEnd = end.clone();
    // El lomo del tronco queda a ras de la altura física de la pasarela.
    visualStart.y -= .38;
    visualEnd.y -= .38;
    const log = cylinderBetween(visualStart, visualEnd, .38, .46, this.materials.barkLight, 8);
    this.scene.add(log);
    this.walkways.push({ fromId, toId, start, end, radius: .78, landingDepth: 1.85, name: `${from.name} → ${to.name}` });

    for (let knot = 0; knot < 3; knot += 1) {
      const t = (knot + 1) / 4;
      const point = visualStart.clone().lerp(visualEnd, t);
      const vine = new THREE.Mesh(new THREE.TorusGeometry(.34, .055, 5, 9), this.materials.vine);
      vine.position.copy(point);
      vine.rotation.x = Math.PI / 2;
      this.scene.add(vine);
    }
    this.animated.push({ type: 'bridge', object: log, phase: index });
  }

  createPlatforms() {
    // Ruta principal diseñada a mano. Cada rectángulo deja una separación real al siguiente.
    const mainRoute = [
      { id: 'roots', x: -11, z: 23, top: 2.7, width: 8, depth: 6, name: 'Raíces del Arroyo' },
      { id: 'moss', x: -1, z: 25, top: 4.4, width: 8, depth: 6, name: 'Mirador de Musgo' },
      { id: 'dawn', x: 12, z: 12, top: 6.1, width: 9, depth: 7, name: 'Nido del Alba' },
      { id: 'perch', x: 21, z: 6, top: 8.1, width: 7, depth: 6, style: 'wood', name: 'Percha del Vigía' },
      { id: 'emerald', x: 12, z: 1, top: 10.0, width: 8, depth: 6, name: 'Balcón Esmeralda' },
      { id: 'hummingbird', x: 2, z: -3, top: 12.0, width: 8, depth: 6, name: 'Paso del Colibrí' },
      { id: 'vineBridge', x: -8, z: -8, top: 14.1, width: 9, depth: 7, name: 'Puente de Lianas' },
      { id: 'windNest', x: -18, z: -12, top: 16.2, width: 8, depth: 6, name: 'Nido del Viento' },
      { id: 'amber', x: -22, z: -20, top: 18.2, width: 8, depth: 7, name: 'Rama de Ámbar' },
      { id: 'fern', x: -13, z: -25, top: 20.3, width: 8, depth: 6, name: 'Terraza de Helechos' },
      { id: 'breeze', x: -3, z: -29, top: 22.4, width: 8, depth: 6, name: 'Isla de los Vientos' },
      { id: 'windCrown', x: 7, z: -34, top: 24.7, width: 10, depth: 7, name: 'Copa del Viento' },
      { id: 'hawk', x: 18, z: -38, top: 27.0, width: 8, depth: 6, name: 'Rama del Halcón' },
      { id: 'knot', x: 24, z: -46, top: 29.4, width: 8, depth: 6, name: 'Nudo de Lianas' },
      { id: 'mistCrest', x: 15, z: -52, top: 32.0, width: 9, depth: 7, name: 'Cresta de Niebla' },
      { id: 'cloudStep', x: 5, z: -56, top: 34.7, width: 8, depth: 6, style: 'wood', name: 'Paso de Nube' },
      { id: 'mistStep', x: -5, z: -61, top: 37.4, width: 8, depth: 6, name: 'Escalón de Bruma' },
      { id: 'lookoutCrown', x: -14, z: -67, top: 40.1, width: 8, depth: 6, name: 'Atalaya de la Copa' },
      { id: 'thunder', x: -7, z: -73.5, top: 42.8, width: 8, depth: 6, name: 'Rama del Trueno' },
      { id: 'air', x: 3, z: -78, top: 45.4, width: 8, depth: 6, name: 'Rama del Aire' },
      { id: 'antechamber', x: 12, z: -83, top: 48.0, width: 9, depth: 7, style: 'wood', name: 'Antesala de la Fortaleza' },
      { id: 'finalBridge', x: 1, z: -89, top: 49.5, width: 9, depth: 6, style: 'wood', name: 'Puente Final' },
      { id: 'fortress', x: 0, z: -101, top: 50.7, width: 31, depth: 16, style: 'wood', name: 'Fortaleza de Chatarra', decorate: false },
    ];
    const sidePlatforms = [
      { id: 'lookoutTower', x: 30, z: 7, top: 8.6, width: 6, depth: 6, style: 'wood', name: 'Torre del Vigía' },
      { id: 'hiddenNest', x: -32, z: -18, top: 19.0, width: 7, depth: 6, style: 'wood', name: 'Nido Escondido' },
      { id: 'skyTower', x: 34, z: -46, top: 30.3, width: 6, depth: 6, style: 'wood', name: 'Torre de la Copa' },
    ];
    [...mainRoute, ...sidePlatforms].forEach((platform) => this.addPlatform({ ...platform, floating: true }));
    this.mainRouteIds = mainRoute.map((platform) => platform.id);
    for (let index = 0; index < this.mainRouteIds.length - 1; index += 1) {
      this.addRouteBridge(this.mainRouteIds[index], this.mainRouteIds[index + 1], index);
    }
    // Tres desvíos opcionales, también unidos por troncos físicos y no por saltos ambiguos.
    [['perch', 'lookoutTower'], ['amber', 'hiddenNest'], ['knot', 'skyTower']].forEach(([fromId, toId], index) => {
      this.addRouteBridge(fromId, toId, this.mainRouteIds.length + index);
    });
  }

  createClimbingVines() {
    // Lianas reales y separadas de las plataformas: se pueden usar para la escalada automática.
    const vineData = [
      { x: 4, z: 10, bottom: .2, top: 10.4 }, { x: -12, z: -16, bottom: 8.5, top: 21.0 },
      { x: 3, z: -22, bottom: 15.5, top: 29.2 }, { x: 23, z: -55, bottom: 24.0, top: 37.5 },
      { x: -21, z: -70, bottom: 33.0, top: 45.3 }, { x: -4, z: -84, bottom: 41.5, top: 52.0 },
    ];
    vineData.forEach((data, index) => {
      const bend = index % 2 ? .48 : -.48;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(data.x, data.bottom, data.z),
        new THREE.Vector3(data.x + bend, (data.bottom + data.top) * .5, data.z + .24),
        new THREE.Vector3(data.x, data.top, data.z),
      ]);
      const vine = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, .13, 5, false), this.materials.vine);
      vine.castShadow = true;
      this.scene.add(vine);
      const anchor = new THREE.Mesh(new THREE.DodecahedronGeometry(.62, 0), this.materials.leafLight);
      anchor.position.set(data.x, data.top + .18, data.z);
      anchor.scale.set(1.2, .52, 1.0);
      anchor.castShadow = true;
      this.scene.add(anchor);
      const climbable = { ...data, radius: .36, group: vine, name: `Liana ${index + 1}` };
      this.climbables.push(climbable);
      this.climbingVines.push(climbable);
    });
  }

  createThermals() {
    // Las térmicas quedan al lado de las plataformas de salida, nunca atravesándolas.
    const thermalData = [
      { id: 'brisa-baja', x: 26, z: -1, bottom: .2, top: 13, radius: 3.2, strength: 20 },
      { id: 'ambar', x: -17, z: -3, bottom: 5, top: 25, radius: 3.5, strength: 22 },
      { id: 'copa', x: 11, z: -25, bottom: 12, top: 35, radius: 4.0, strength: 23 },
      { id: 'nubes', x: 32, z: -55, bottom: 21, top: 44, radius: 3.8, strength: 25 },
      { id: 'cumbre', x: -6, z: -80, bottom: 35, top: 58, radius: 2.8, strength: 27 },
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
    // Todos los objetos se anclan a IDs de plataforma: cambiar la ruta no los deja suspendidos.
    const seedPlan = [
      { id: 'dawn', title: 'Bellota Solar del Alba', platform: 'dawn', offsetX: -1.0, offsetZ: .25, checkpointOffsetZ: -1.25 },
      { id: 'ember', title: 'Bellota Solar de Brasa', platform: 'amber', offsetX: .95, offsetZ: .45, checkpointOffsetZ: -1.3 },
      { id: 'sky', title: 'Bellota Solar del Cielo', platform: 'windCrown', offsetX: -1.15, offsetZ: .15, checkpointOffsetZ: 1.3 },
    ];
    seedPlan.forEach((seed, index) => {
      const position = this.getPlatformPoint(seed.platform, seed.offsetX, seed.offsetZ, 1.15);
      const checkpoint = this.getPlatformPoint(seed.platform, 0, seed.checkpointOffsetZ, .3);
      this.addSolarSeed({ ...seed, x: position.x, y: position.y, z: position.z, checkpoint }, index);
    });

    const fruitPlan = [
      ['roots', 1.05, .35], ['moss', -.95, -.45], ['dawn', 1.25, -1.05], ['perch', 1.2, -.7],
      ['emerald', 1.15, -.95], ['hummingbird', -.9, .55], ['vineBridge', 1.2, .75], ['windNest', -1.3, .65],
      ['amber', -1.1, 1.15], ['fern', .95, -.55], ['breeze', -1.0, .5], ['windCrown', 1.6, -1.1],
      ['hawk', -1.35, .6], ['knot', 1.25, .75], ['mistCrest', -1.35, .95], ['cloudStep', .95, -.5],
      ['mistStep', -1.0, .55], ['lookoutCrown', .85, -1.0], ['thunder', -1.3, .55], ['air', .9, -1.0],
      ['antechamber', -1.4, .95], ['finalBridge', .95, -.55], ['hiddenNest', -1.05, .55], ['skyTower', 1.05, -.65],
    ];
    fruitPlan.forEach(([platformId, offsetX, offsetZ], index) => {
      const position = this.getPlatformPoint(platformId, offsetX, offsetZ, .82);
      this.addFruit(position.x, position.y, position.z, index, platformId);
    });

    // Racimos de bellotas pequeñas: munición de los ataques a distancia, no objetivos principales.
    const ammoPlan = [
      ['roots', -1.25, .7], ['moss', 1.2, .75], ['dawn', 1.35, 1.0], ['lookoutTower', 1.0, -.8],
      ['emerald', 1.25, 1.0], ['hummingbird', 1.15, -.75], ['vineBridge', -1.25, -.85], ['windNest', .25, -1.05],
      ['hiddenNest', 1.1, -.7], ['fern', -1.15, .65], ['breeze', 1.05, -.65], ['windCrown', .1, 1.45],
      ['hawk', 1.0, -1.0], ['knot', -.4, -1.0], ['mistCrest', .45, -1.3], ['cloudStep', -1.1, .65],
      ['mistStep', 1.0, -.65], ['lookoutCrown', -1.3, .85], ['thunder', .75, -1.1], ['air', -1.25, .85],
      ['antechamber', 1.2, -.9], ['finalBridge', -1.2, .55],
    ];
    ammoPlan.forEach(([platformId, offsetX, offsetZ], index) => {
      const position = this.getPlatformPoint(platformId, offsetX, offsetZ, .56);
      this.addAmmoPack(position.x, position.y, position.z, index, 5, platformId);
    });
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

  addFruit(x, y, z, index, platformId = null) {
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
    this.fruits.push({ group, position: group.position, platformId, collected: false, baseY: y, phase: index * .8 });
  }

  addAmmoPack(x, y, z, index, amount = 5, platformId = null) {
    const group = new THREE.Group();
    const shellMaterial = new THREE.MeshStandardMaterial({ color: '#9b592d', roughness: .86, flatShading: true });
    const capMaterial = new THREE.MeshStandardMaterial({ color: '#d59647', roughness: .8, flatShading: true });
    for (let acornIndex = 0; acornIndex < 3; acornIndex += 1) {
      const acorn = new THREE.Group();
      const nut = new THREE.Mesh(new THREE.SphereGeometry(.22, 6, 5), shellMaterial);
      nut.scale.y = 1.22;
      nut.castShadow = true;
      const cap = new THREE.Mesh(new THREE.SphereGeometry(.235, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2), capMaterial);
      cap.position.y = .15;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(.028, .045, .14, 4), this.materials.leafLight);
      stem.position.y = .33;
      acorn.add(nut, cap, stem);
      acorn.position.set((acornIndex - 1) * .34, Math.abs(acornIndex - 1) * .05, (acornIndex % 2) * .23);
      acorn.rotation.set(0, index * .7 + acornIndex, (acornIndex - 1) * .28);
      group.add(acorn);
    }
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTexture, color: '#ffbf59', transparent: true, opacity: .22, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.set(2.1, 2.1, 1);
    group.add(halo);
    group.position.set(x, y, z);
    this.scene.add(group);
    this.ammoPacks.push({ group, position: group.position, platformId, amount, collected: false, baseY: y, phase: index * .61 });
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
    const fortress = this.getPlatform('fortress');
    const group = new THREE.Group();
    const deckY = fortress.top;
    const junkMaterials = [this.materials.wood, this.materials.barkLight, this.materials.stone];
    // Restos de la fortaleza ordenados en su perímetro; el centro queda como arena del jefe.
    const junkPlan = [
      [-12.8, 5.5, .7, 'crate'], [-9.8, 5.5, 1.05, 'drum'], [12.8, 5.5, .7, 'crate'], [9.8, 5.5, 1.05, 'drum'],
      [-13.2, 1.8, .8, 'drum'], [13.2, 1.8, .8, 'crate'], [-12.5, -4.8, .8, 'crate'], [12.5, -4.8, .85, 'drum'],
      [-7.2, -6.1, .7, 'crate'], [7.2, -6.1, .75, 'crate'], [-14.0, -1.8, .65, 'drum'], [14.0, -1.8, .65, 'drum'],
    ];
    junkPlan.forEach(([x, z, scale, type], index) => {
      const junk = new THREE.Mesh(type === 'drum' ? new THREE.CylinderGeometry(.5, .65, 1.8, 7) : new THREE.BoxGeometry(1.2, 1.2, .8), junkMaterials[index % junkMaterials.length]);
      const objectHeight = (type === 'drum' ? 1.8 : 1.2) * scale;
      junk.position.set(x, deckY + objectHeight / 2, z);
      junk.scale.setScalar(scale);
      junk.rotation.set(index % 2 ? .16 : -.12, index * .7, index % 3 ? .08 : -.14);
      junk.castShadow = true;
      group.add(junk);
    });
    for (const x of [-11, 11]) {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.45, 8, 6), this.materials.wood);
      tower.position.set(x, deckY + 4, 4.1);
      tower.castShadow = true;
      group.add(tower);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.2), new THREE.MeshBasicMaterial({ color: '#d44f3e', side: THREE.DoubleSide }));
      flag.position.set(x + .7, deckY + 7.3, 4.1);
      flag.rotation.y = Math.PI / 2;
      group.add(flag);
      this.animated.push({ type: 'flag', object: flag, phase: x });
    }
    // Portal abierto al norte, en el lado por el que se llega desde el último puente.
    const gateMaterial = new THREE.MeshStandardMaterial({ color: '#403a39', roughness: .8, metalness: .35, flatShading: true });
    for (const x of [-3.15, 3.15]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(.62, 4.4, .7), gateMaterial);
      post.position.set(x, deckY + 2.2, 7.25);
      post.castShadow = true;
      group.add(post);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(6.9, .65, .78), gateMaterial);
    lintel.position.set(0, deckY + 4.08, 7.25);
    lintel.castShadow = true;
    group.add(lintel);
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.4), new THREE.MeshBasicMaterial({ color: '#c95042', side: THREE.DoubleSide }));
    banner.position.set(0, deckY + 5.3, 7.62);
    group.add(banner);
    group.position.set(fortress.x, 0, fortress.z);
    this.scene.add(group);
  }

  createAmbientLife() {
    // Detalle ambiental moderado: unas luciérnagas extra ayudan a leer la ruta nocturna sin geometría pesada.
    const count = 150;
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
    for (let index = 0; index < 16; index += 1) {
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
      // Margen mínimo de borde; los huecos se cubren con pasarelas físicas a la misma altura visible.
      const isOverPlatform = Math.abs(x - platform.x) <= platform.width / 2 + .1
        && Math.abs(z - platform.z) <= platform.depth / 2 + .1;
      // Toda la base y un margen de aterrizaje cuentan para evitar atravesar escalones altos.
      const canCatchPlayer = previousY >= platform.top - platform.landingDepth;
      if (isOverPlatform && canCatchPlayer) height = Math.max(height, platform.top);
    }
    // Los troncos entre plataformas son pasarelas físicas, no decoración engañosa.
    for (const walkway of this.walkways) {
      const dx = walkway.end.x - walkway.start.x;
      const dz = walkway.end.z - walkway.start.z;
      const lengthSq = dx * dx + dz * dz;
      if (lengthSq < .001) continue;
      const progress = clamp(((x - walkway.start.x) * dx + (z - walkway.start.z) * dz) / lengthSq, 0, 1);
      const closestX = walkway.start.x + dx * progress;
      const closestZ = walkway.start.z + dz * progress;
      const distance = Math.hypot(x - closestX, z - closestZ);
      const walkwayY = THREE.MathUtils.lerp(walkway.start.y, walkway.end.y, progress);
      if (distance <= walkway.radius && previousY >= walkwayY - walkway.landingDepth) {
        height = Math.max(height, walkwayY);
      }
    }
    return height;
  }

  constrainPosition(position, radius = .45) {
    position.x = clamp(position.x, -102, 102);
    // La fortaleza ocupa hasta z=-109; el límite conserva su arena dentro del terreno visible.
    position.z = clamp(position.z, -110, 103);
    for (const tree of this.climbables) {
      if (!tree.solid) continue;
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
    const ammoPacks = [];
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
    for (const pack of this.ammoPacks) {
      if (!pack.collected && position.distanceTo(pack.position) < 1.65) {
        pack.collected = true;
        pack.group.visible = false;
        ammoPacks.push(pack);
      }
    }
    return { seeds, fruits, ammoPacks };
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
    for (const pack of this.ammoPacks) {
      if (!pack.collected) {
        pack.group.rotation.y += delta * 1.45;
        pack.group.position.y = pack.baseY + Math.sin(elapsed * 2.2 + pack.phase) * .1;
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
