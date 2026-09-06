import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { World } from './World.js';
import { Player } from './Player.js';
import { EnemySystem } from './Enemies.js';
import { InputController } from './Input.js';
import { HUD } from './HUD.js';
import { Soundscape } from './Sound.js';

const dampVector = (current, target, lambda, delta) => current.lerp(target, 1 - Math.exp(-lambda * delta));

export class CanopyGlideGame {
  constructor() {
    this.container = document.querySelector('#webgl-container');
    this.hud = new HUD();
    this.sound = new Soundscape();
    this.input = new InputController();
    this.running = false;
    this.victory = false;
    this.bossDefeated = false;
    this.seeds = 0;
    this.elapsedGameplay = 0;
    this.objectiveTick = 0;
    this.didTeachGlide = false;
    this.didTeachThermal = false;
    this.didTeachDash = false;
    this.didTeachSpin = false;
    this.cameraYaw = 0;
    this.cameraPitch = .22;
    this.isTouchDevice = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    this.cameraTarget = new THREE.Vector3();
    this.desiredCamera = new THREE.Vector3();
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = 30;

    this.scene = new THREE.Scene();
    try {
      this.setupRenderer();
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : String(error);
      const fallback = document.querySelector('#webgl-fallback');
      fallback.hidden = false;
      document.querySelector('#webgl-fallback-message').textContent = 'La tablet sí puede tener WebGL, pero la escena no ha podido iniciarse.';
      document.querySelector('#webgl-fallback-detail').textContent = `Diagnóstico: ${message}`;
      return;
    }
    this.setupScene();
    this.setupUi();
    this.animate();
  }

  setupRenderer() {
    let stage = 'crear el contexto WebGL';
    try {
    // Algunos navegadores de tablet rechazan los atributos avanzados de contexto
    // aunque sí soporten WebGL. Pedimos primero un contexto estándar, como get.webgl.org.
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2')
      || canvas.getContext('webgl')
      || canvas.getContext('experimental-webgl');
    if (!context) throw new Error('No se pudo crear un contexto WebGL.');
    stage = 'crear el renderizador';
    this.renderer = new THREE.WebGLRenderer({ canvas, context, antialias: false, alpha: false, powerPreference: 'default' });
    stage = 'configurar la escena';
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.isTouchDevice ? 1.3 : 1.75));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // Reduce los blancos quemados al mirar hacia el sol, especialmente en pantallas de tablet.
    this.renderer.toneMappingExposure = 1.06;
    this.container.append(this.renderer.domElement);
    this.input.bindDesktopLook(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(59, window.innerWidth / window.innerHeight, .1, 320);
    this.camera.position.set(0, 6.8, 33);

    stage = 'configurar los efectos visuales';
    this.composer = new EffectComposer(this.renderer);
    const renderPass = new RenderPass(this.scene, this.camera);
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), .28, .52, .72);
    this.composer.addPass(renderPass);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());

    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.input.resetHeld();
    });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`${stage}: ${detail}`);
    }
  }

  setupScene() {
    // Una ligera mayor visibilidad y brillo conservan el estilo cartoon sin cargar la tablet.
    this.scene.fog = new THREE.FogExp2('#396c53', .0138);

    const hemisphere = new THREE.HemisphereLight('#c6f4cf', '#143b2d', 1.95);
    this.scene.add(hemisphere);
    const sun = new THREE.DirectionalLight('#ffe5a6', 3.55);
    sun.position.set(-46, 72, 24);
    sun.castShadow = true;
    sun.shadow.mapSize.set(this.isTouchDevice ? 1024 : 2048, this.isTouchDevice ? 1024 : 2048);
    sun.shadow.camera.left = -75;
    sun.shadow.camera.right = 75;
    sun.shadow.camera.top = 75;
    sun.shadow.camera.bottom = -75;
    sun.shadow.camera.near = 5;
    sun.shadow.camera.far = 170;
    sun.shadow.bias = -.0002;
    this.scene.add(sun);
    const rim = new THREE.DirectionalLight('#78cbae', .92);
    rim.position.set(55, 32, -55);
    this.scene.add(rim);

    this.world = new World(this.scene);
    const spawn = new THREE.Vector3(0, this.world.terrainHeight(0, 23), 23);
    this.player = new Player(this.scene, spawn, {
      onEvent: (event) => this.handlePlayerEvent(event),
      onDamage: (health, previous) => {
        this.hud.setHealth(health, previous);
        this.hud.toast(health > 0 ? '¡Cuidado! Los mapaches te han alcanzado.' : 'El dosel te sostiene de nuevo.', 'danger');
      },
      onRespawn: () => {
        this.hud.setHealth(this.player.health);
        this.hud.setStamina(this.player.stamina);
        this.hud.toast('Has vuelto al último refugio.', '');
      },
      onThermal: () => {
        if (!this.didTeachThermal) {
          this.didTeachThermal = true;
          this.hud.toast('Corriente térmica: mantén PLANEAR para ganar altura.', '');
        }
      },
      onThrow: (origin, direction) => {
        this.enemies?.throwAcorn(origin, direction);
      },
      onEmptyAmmo: () => this.hud.toast('No quedan bellotas pequeñas. Busca racimos marrones por el dosel.', 'danger'),
    });

    this.enemies = new EnemySystem(this.scene, this.world, {
      onEnemyDown: (type) => {
        this.sound.enemyDown();
        this.hud.toast(type === 'heavy' ? '¡Escudo roto! Mapache pesado derrotado.' : 'Vigía mapache derrotado.');
      },
      onEnemyHurt: (type, health) => {
        if (type === 'heavy' && health > 0) this.hud.toast('El escudo del pesado se ha agrietado: un golpe más.', 'seed');
      },
      onLookoutShot: () => {},
      onBossAwake: () => {
        this.hud.toast('¡EL REY MAPACHE ACTIVA EL MOTOR DE CHATARRA!', 'danger');
      },
      onBossHit: (health, maxHealth) => {
        this.sound.bossHit();
        this.hud.setBoss(true, health, maxHealth);
        this.hud.toast(health > 0 ? '¡Impacto directo sobre el motor!' : 'El motor se ha detenido.', health > 0 ? 'seed' : '');
      },
      onBossDown: () => this.defeatBoss(),
    });

    this.cameraTarget.copy(this.player.position).add(new THREE.Vector3(0, 1.15, 0));
    this.updateCamera(.016, true);
  }

  setupUi() {
    document.querySelector('#start-button').addEventListener('click', () => this.start());
    document.querySelector('#restart-button').addEventListener('click', () => window.location.reload());
    window.addEventListener('keydown', (event) => {
      if (event.code === 'Escape') this.hud.closeHelp();
    });
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.sound.unlock();
    this.hud.begin();
    this.hud.setHealth(this.player.health);
    this.hud.setSeeds(0);
    this.hud.setAmmo(this.player.smallAcorns);
    this.hud.setStamina(this.player.stamina);
    this.hud.setObjective('Sigue el brillo dorado hasta la Bellota Solar del Alba.');
    this.hud.toast('Expedición iniciada. Las corrientes turquesas levantan el vuelo.', '');
  }

  handlePlayerEvent(event) {
    if (event === 'jump') this.sound.jump();
    if (event === 'glide') {
      this.sound.glide();
      if (!this.didTeachGlide) {
        this.didTeachGlide = true;
        this.hud.toast('Patagios desplegados. Conserva resistencia para seguir planeando.', '');
      }
    }
    if (event === 'dash') {
      this.sound.dash();
      if (!this.didTeachDash) {
        this.didTeachDash = true;
        this.hud.toast('Ataque en picado: úsalo desde el aire contra escudos y motores.', '');
      }
    }
    if (event === 'spin') {
      this.sound.spin();
      if (!this.didTeachSpin) {
        this.didTeachSpin = true;
        this.hud.toast('Giro de bellota: despeja a los mapaches cercanos.', '');
      }
    }
    if (event === 'throw') this.sound.throw();
    if (event === 'hurt') this.sound.hit();
  }

  defeatBoss() {
    if (this.bossDefeated) return;
    this.bossDefeated = true;
    this.hud.setBoss(false);
    this.hud.toast('El Rey Mapache ha caído. Regresa al Altar del Gran Árbol.', 'seed');
    this.sound.enemyDown();
  }

  collectWorldItems() {
    const { seeds, fruits, ammoPacks } = this.world.collectAt(this.player.position);
    for (const seed of seeds) {
      this.seeds += 1;
      this.player.setCheckpoint(seed.checkpoint);
      this.world.updateAltarSeeds(this.seeds);
      this.hud.setSeeds(this.seeds);
      this.hud.toast(`${seed.title} recuperada · ${this.seeds}/3`, 'seed');
      this.sound.collect();
    }
    if (seeds.length > 0 && this.seeds === 3) {
      this.hud.toast('Las tres bellotas resuenan. ¡La fortaleza del Rey está abierta!', 'seed');
    }
    for (const pack of ammoPacks) {
      this.player.addSmallAcorns(pack.amount);
      this.hud.setAmmo(this.player.smallAcorns);
      this.hud.toast(`Racimo de bellotas pequeñas · +${pack.amount}`, 'seed');
      this.sound.collect();
    }
    for (const fruit of fruits) {
      this.player.stamina = Math.min(100, this.player.stamina + 34);
      this.hud.toast('Fruto del dosel · + resistencia');
      this.sound.fruit();
    }
  }

  updateObjective() {
    if (this.bossDefeated) {
      this.hud.setObjective('Lleva las tres Bellotas al Altar Central para devolver la luz.');
      return;
    }
    if (this.seeds === 0) this.hud.setObjective('Sigue el brillo dorado hasta la Bellota Solar del Alba.');
    else if (this.seeds === 1) this.hud.setObjective('Encuentra la Bellota de Brasa en el Dosel Medio.');
    else if (this.seeds === 2) this.hud.setObjective('Atravesa los vientos de la Copa Alta por la última Bellota.');
    else if (this.enemies.boss.active) this.hud.setObjective('Daña el motor del Rey con ataques en picado.');
    else this.hud.setObjective('Planea hacia la Fortaleza de Chatarra, al norte del Gran Árbol.');
  }

  updateCamera(delta, snap = false) {
    const look = this.input.consumeLook();
    this.cameraYaw -= look.x * .007;
    // Controles de cámara naturales: arrastrar hacia arriba eleva la vista.
    this.cameraPitch = THREE.MathUtils.clamp(this.cameraPitch + look.y * .005, -.08, .62);

    const targetHeight = this.player.gliding ? 1.5 : 1.15;
    const target = this.player.position.clone().add(new THREE.Vector3(0, targetHeight, 0));
    dampVector(this.cameraTarget, target, snap ? 100 : 8.5, delta);
    const distance = this.player.gliding ? 13.6 : this.player.climbing ? 10.3 : 11.1;
    const horizontal = Math.cos(this.cameraPitch) * distance;
    this.desiredCamera.set(
      this.cameraTarget.x + Math.sin(this.cameraYaw) * horizontal,
      this.cameraTarget.y + 2.2 + Math.sin(this.cameraPitch) * distance,
      this.cameraTarget.z + Math.cos(this.cameraYaw) * horizontal,
    );

    const direction = this.desiredCamera.clone().sub(this.cameraTarget);
    const desiredLength = direction.length();
    direction.normalize();
    this.raycaster.set(this.cameraTarget, direction);
    this.raycaster.far = desiredLength;
    const collisions = this.raycaster.intersectObjects(this.world.occluders, false);
    if (collisions.length && collisions[0].distance > 1.5) {
      this.desiredCamera.copy(this.cameraTarget).addScaledVector(direction, Math.max(2.7, collisions[0].distance - .55));
    }
    if (snap) this.camera.position.copy(this.desiredCamera);
    else dampVector(this.camera.position, this.desiredCamera, this.player.gliding ? 4.3 : 7.3, delta);
    this.camera.lookAt(this.cameraTarget);
  }

  update(delta, elapsed) {
    this.world.update(delta, elapsed);
    if (!this.running || this.victory) {
      this.updateCamera(delta);
      return;
    }
    if (this.hud.helpModal.classList.contains('open')) {
      this.input.resetHeld();
      this.updateCamera(delta);
      return;
    }
    if (this.input.consumePausePressed()) this.hud.openHelp();
    this.input.update();
    this.elapsedGameplay += delta;
    this.player.update(delta, this.input, this.cameraYaw, this.world);
    this.collectWorldItems();
    this.enemies.update(delta, this.player, this.seeds);

    const bossVisible = this.enemies.boss.active && this.enemies.boss.alive;
    this.hud.setBoss(bossVisible, this.enemies.boss.health, this.enemies.boss.maxHealth);
    const atAltar = this.bossDefeated && this.world.isAtAltar(this.player.position);
    this.hud.setInteraction(atAltar, 'ACTIVAR ALTAR');
    const action = this.input.consumeActionPressed();
    if (atAltar && action) this.finishAdventure();

    this.hud.setStamina(this.player.stamina);
    this.hud.setAmmo(this.player.smallAcorns);
    this.hud.setZone(this.player.position.y);
    this.objectiveTick -= delta;
    if (this.objectiveTick <= 0) {
      this.objectiveTick = .4;
      this.updateObjective();
    }
    this.updateCamera(delta);
  }

  finishAdventure() {
    if (this.victory) return;
    this.victory = true;
    this.world.awakenAltar();
    this.sound.victory();
    this.hud.setInteraction(false);
    this.hud.showVictory({ seeds: this.seeds, seconds: this.elapsedGameplay, enemies: this.enemies.defeated });
  }

  resize() {
    if (!this.renderer || !this.camera) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.isTouchDevice ? 1.3 : 1.75));
    this.renderer.setSize(width, height);
    this.composer?.setSize(width, height);
  }

  animate() {
    if (!this.renderer) return;
    this.frame = requestAnimationFrame(() => this.animate());
    const delta = Math.min(.05, this.clock?.getDelta?.() ?? .016);
    if (!this.clock) this.clock = new THREE.Clock();
    const elapsed = this.clock.getElapsedTime();
    this.update(delta, elapsed);
    this.composer.render();
  }
}
