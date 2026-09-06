import * as THREE from 'three';

const dampAngle = (current, target, lambda, delta) => {
  const difference = THREE.MathUtils.euclideanModulo(target - current + Math.PI, Math.PI * 2) - Math.PI;
  return current + difference * (1 - Math.exp(-lambda * delta));
};

function horizontalDistance(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function createBurstMaterial(color) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending });
}

export class EnemySystem {
  constructor(scene, world, callbacks = {}) {
    this.scene = scene;
    this.world = world;
    this.callbacks = callbacks;
    this.enemies = [];
    this.projectiles = [];
    this.friendlyProjectiles = [];
    this.effects = [];
    this.defeated = 0;
    this.time = 0;
    this.boss = null;
    this.raccoonMaterials = {
      fur: new THREE.MeshStandardMaterial({ color: '#687076', roughness: .86, flatShading: true }),
      furLight: new THREE.MeshStandardMaterial({ color: '#a9a69b', roughness: .88, flatShading: true }),
      mask: new THREE.MeshStandardMaterial({ color: '#222b34', roughness: .76, flatShading: true }),
      muzzle: new THREE.MeshStandardMaterial({ color: '#d5cab7', roughness: .91, flatShading: true }),
      wood: new THREE.MeshStandardMaterial({ color: '#a56732', roughness: .9, flatShading: true }),
      metal: new THREE.MeshStandardMaterial({ color: '#637376', roughness: .48, metalness: .55, flatShading: true }),
      red: new THREE.MeshStandardMaterial({ color: '#c95042', emissive: '#5d1b18', emissiveIntensity: .35, roughness: .7, flatShading: true }),
      eye: new THREE.MeshStandardMaterial({ color: '#ffcf5d', emissive: '#d67a18', emissiveIntensity: 1.4, roughness: .25 }),
    };
    this.buildEncounters();
  }

  buildEncounters() {
    // Encuentros anclados a plataformas concretas: cada mapache tiene suelo y zona de patrulla.
    const lookoutPlan = [
      ['perch', -1.35, .8], ['lookoutTower', -1.15, .9], ['windNest', 1.45, 1.0], ['hawk', 1.45, 1.0],
      ['knot', -1.5, 1.0], ['lookoutCrown', 1.4, 1.0], ['air', 1.45, 1.0], ['skyTower', -1.1, .8],
    ];
    lookoutPlan.forEach(([platformId, offsetX, offsetZ]) => this.addEnemy('lookout', platformId, offsetX, offsetZ));
    const heavyPlan = [
      ['emerald', -1.2, -.8], ['amber', -1.25, -1.1], ['windCrown', 1.8, .8],
      ['mistCrest', 1.4, .65], ['thunder', 1.45, 1.0], ['antechamber', 1.8, .9],
    ];
    heavyPlan.forEach(([platformId, offsetX, offsetZ]) => this.addEnemy('heavy', platformId, offsetX, offsetZ));
    this.createBoss();
  }

  buildRaccoon(type) {
    const root = new THREE.Group();
    const visual = new THREE.Group();
    root.add(visual);
    const scale = type === 'heavy' ? 1.22 : .95;
    visual.scale.setScalar(scale);

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(.42, .58, 3, 7), this.raccoonMaterials.fur);
    body.position.set(0, .78, .07);
    body.castShadow = true;
    visual.add(body);
    const belly = new THREE.Mesh(new THREE.SphereGeometry(.32, 7, 6), this.raccoonMaterials.furLight);
    belly.position.set(0, .76, -.3);
    belly.scale.set(.9, 1.08, .5);
    visual.add(belly);

    const head = new THREE.Mesh(new THREE.SphereGeometry(.45, 8, 6), this.raccoonMaterials.furLight);
    head.position.set(0, 1.4, -.25);
    head.castShadow = true;
    visual.add(head);
    const mask = new THREE.Mesh(new THREE.BoxGeometry(.72, .23, .12), this.raccoonMaterials.mask);
    mask.position.set(0, 1.44, -.61);
    mask.castShadow = true;
    visual.add(mask);
    [-1, 1].forEach((side) => {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(.16, .3, 5), this.raccoonMaterials.fur);
      ear.position.set(side * .28, 1.76, -.22);
      ear.rotation.z = side * -.15;
      ear.castShadow = true;
      visual.add(ear);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(.06, 6, 5), this.raccoonMaterials.eye);
      eye.position.set(side * .19, 1.46, -.69);
      visual.add(eye);
      const foot = new THREE.Mesh(new THREE.SphereGeometry(.18, 6, 5), this.raccoonMaterials.mask);
      foot.position.set(side * .22, .16, .12);
      foot.scale.set(1, .65, 1.25);
      visual.add(foot);
    });
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(.22, 6, 5), this.raccoonMaterials.muzzle);
    muzzle.position.set(0, 1.28, -.67);
    muzzle.scale.set(1.15, .7, .6);
    visual.add(muzzle);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(.07, 6, 5), this.raccoonMaterials.mask);
    nose.position.set(0, 1.34, -.84);
    visual.add(nose);

    const tail = new THREE.Group();
    tail.position.set(0, .68, .41);
    visual.add(tail);
    for (let index = 0; index < 4; index += 1) {
      const segment = new THREE.Mesh(new THREE.DodecahedronGeometry(.24 + (3 - index) * .025, 0), index % 2 ? this.raccoonMaterials.mask : this.raccoonMaterials.fur);
      segment.position.set(0, .06 + index * .11, .24 + index * .22);
      segment.scale.set(1.1, .85, 1.5);
      segment.castShadow = true;
      tail.add(segment);
    }

    const leftArm = new THREE.Mesh(new THREE.CapsuleGeometry(.1, .36, 3, 5), this.raccoonMaterials.fur);
    leftArm.position.set(-.43, .88, -.1);
    leftArm.rotation.z = .65;
    visual.add(leftArm);
    const rightArm = leftArm.clone();
    rightArm.position.x = .43;
    rightArm.rotation.z = -.65;
    visual.add(rightArm);

    let shield = null;
    if (type === 'heavy') {
      shield = new THREE.Group();
      const disk = new THREE.Mesh(new THREE.CylinderGeometry(.64, .64, .12, 8), this.raccoonMaterials.wood);
      disk.rotation.x = Math.PI / 2;
      disk.position.z = -.58;
      disk.castShadow = true;
      shield.add(disk);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(.57, .055, 5, 9), this.raccoonMaterials.mask);
      rim.rotation.x = Math.PI / 2;
      rim.position.z = -.66;
      shield.add(rim);
      shield.position.y = .9;
      visual.add(shield);
    } else {
      const sling = new THREE.Mesh(new THREE.TorusGeometry(.23, .035, 4, 7, Math.PI), this.raccoonMaterials.wood);
      sling.position.set(.28, .95, -.44);
      sling.rotation.z = Math.PI / 2;
      visual.add(sling);
    }

    const alert = new THREE.Sprite(new THREE.SpriteMaterial({ color: '#ffd463', transparent: true, opacity: 0, depthWrite: false }));
    alert.position.y = 2.35;
    alert.scale.set(.65, .65, 1);
    root.add(alert);
    return { root, visual, tail, leftArm, rightArm, shield, alert };
  }

  addEnemy(type, platformId, offsetX = 0, offsetZ = 0) {
    const platform = this.world.getPlatform(platformId);
    const position = this.world.getPlatformPoint(platformId, offsetX, offsetZ, .02);
    const model = this.buildRaccoon(type);
    model.root.position.copy(position);
    this.scene.add(model.root);
    const enemy = {
      type,
      position: model.root.position,
      home: position.clone(),
      platform,
      model,
      alive: true,
      health: type === 'heavy' ? 2 : 1,
      maxHealth: type === 'heavy' ? 2 : 1,
      cooldown: 1.2 + Math.random(),
      hitCooldown: 0,
      patrolPhase: Math.random() * Math.PI * 2,
      speed: type === 'heavy' ? 1.2 : 0,
      scale: type === 'heavy' ? 1.22 : .95,
    };
    this.enemies.push(enemy);
    return enemy;
  }

  createTower(position) {
    const tower = new THREE.Group();
    const material = this.raccoonMaterials.wood;
    for (const [x, z] of [[-.55, -.55], [.55, -.55], [-.55, .55], [.55, .55]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(.09, .13, 3.3, 5), material);
      leg.position.set(position.x + x, position.y - 1.65, position.z + z);
      leg.castShadow = true;
      tower.add(leg);
    }
    this.scene.add(tower);
  }

  createBoss() {
    const fortress = this.world.getPlatform('fortress');
    const root = new THREE.Group();
    const metal = this.raccoonMaterials.metal;
    const darkMetal = new THREE.MeshStandardMaterial({ color: '#32444b', roughness: .6, metalness: .62, flatShading: true });
    const red = this.raccoonMaterials.red;
    const coreMaterial = new THREE.MeshStandardMaterial({ color: '#ffbd48', emissive: '#e87c19', emissiveIntensity: 1.8, metalness: .15, roughness: .35, flatShading: true });

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(3.8, 2.3, 2.8), metal);
    chassis.position.y = 2.1;
    chassis.castShadow = true;
    root.add(chassis);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.35, 9, 6, 0, Math.PI * 2, 0, Math.PI / 2), darkMetal);
    dome.position.y = 3.25;
    dome.rotation.x = Math.PI;
    dome.castShadow = true;
    root.add(dome);
    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(.72, 8, 6), this.raccoonMaterials.furLight);
    cockpit.position.set(0, 3.05, -1.06);
    cockpit.scale.set(1.05, .7, .62);
    root.add(cockpit);
    const mask = new THREE.Mesh(new THREE.BoxGeometry(1.05, .25, .11), this.raccoonMaterials.mask);
    mask.position.set(0, 3.17, -1.54);
    root.add(mask);
    [-.3, .3].forEach((x) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(.09, 6, 5), this.raccoonMaterials.eye);
      eye.position.set(x, 3.18, -1.61);
      root.add(eye);
    });
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(.5, 1), coreMaterial);
    core.position.set(0, 1.95, -1.48);
    root.add(core);

    const wheels = [];
    [-1, 1].forEach((side) => {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(.7, .7, .5, 9), darkMetal);
      wheel.position.set(side * 1.75, .78, .24);
      wheel.rotation.z = Math.PI / 2;
      wheel.castShadow = true;
      root.add(wheel);
      wheels.push(wheel);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(.22, .32, 2.5, 6), metal);
      arm.position.set(side * 2.34, 2.45, -.1);
      arm.rotation.z = side * Math.PI / 2.7;
      arm.castShadow = true;
      root.add(arm);
      const claw = new THREE.Mesh(new THREE.ConeGeometry(.48, .78, 4), red);
      claw.position.set(side * 3.15, 1.52, -.15);
      claw.rotation.z = side * Math.PI / 2;
      claw.castShadow = true;
      root.add(claw);
    });
    for (let index = 0; index < 5; index += 1) {
      const scrap = new THREE.Mesh(index % 2 ? new THREE.BoxGeometry(.65, .45, .48) : new THREE.CylinderGeometry(.23, .31, .7, 6), index % 2 ? red : darkMetal);
      scrap.position.set(-1.5 + index * .72, 3.8 + (index % 2) * .28, .3 + (index % 3) * .2);
      scrap.rotation.set(index * .6, index * .4, index * .5);
      scrap.castShadow = true;
      root.add(scrap);
    }
    const crown = new THREE.Mesh(new THREE.ConeGeometry(.62, .8, 5), coreMaterial);
    crown.position.set(0, 4.36, -.06);
    crown.rotation.x = Math.PI;
    root.add(crown);

    const warning = new THREE.PointLight('#ff663f', 1.3, 10, 2);
    warning.position.set(0, 3.5, 1);
    root.add(warning);
    // El Rey ocupa el centro despejado de la plataforma de fortaleza, no una coordenada suelta.
    root.position.copy(this.world.getPlatformPoint('fortress', 0, -1.35, .02));
    this.scene.add(root);
    this.boss = {
      root,
      position: root.position,
      floorY: fortress.top + .02,
      core,
      wheels,
      warning,
      health: 3,
      maxHealth: 3,
      active: false,
      alive: true,
      cooldown: 1.2,
      hitCooldown: 0,
      collapse: 0,
    };
  }

  shoot(origin, target, type = 'stone') {
    const material = type === 'boss'
      ? new THREE.MeshStandardMaterial({ color: '#ff8d46', emissive: '#d84225', emissiveIntensity: 1.7, roughness: .35, flatShading: true })
      : new THREE.MeshStandardMaterial({ color: '#c18b55', roughness: .82, flatShading: true });
    const projectile = new THREE.Mesh(type === 'boss' ? new THREE.IcosahedronGeometry(.3, 1) : new THREE.DodecahedronGeometry(.19, 0), material);
    projectile.position.copy(origin);
    projectile.castShadow = true;
    this.scene.add(projectile);
    const direction = target.clone().add(new THREE.Vector3(0, .65, 0)).sub(origin).normalize();
    this.projectiles.push({ mesh: projectile, velocity: direction.multiplyScalar(type === 'boss' ? 16 : 13), life: 3.3, type });
  }

  kill(enemy, player = null, bounce = false) {
    enemy.alive = false;
    enemy.model.root.visible = false;
    this.defeated += 1;
    this.burst(enemy.position.clone().add(new THREE.Vector3(0, .9, 0)), enemy.type === 'heavy' ? '#ffb451' : '#b6f17d', 10);
    if (bounce && player) player.bounce();
    this.callbacks.onEnemyDown?.(enemy.type, this.defeated);
  }

  damageEnemy(enemy, player = null, attack = 'spin') {
    if (!enemy.alive || enemy.hitCooldown > 0) return false;
    enemy.hitCooldown = attack === 'dash' ? .55 : .38;
    enemy.health -= attack === 'dash' ? 2 : 1;
    this.burst(enemy.position.clone().add(new THREE.Vector3(0, .9, 0)), attack === 'acorn' ? '#ffd16b' : '#b8f59f', 6);
    if (enemy.health <= 0) {
      this.kill(enemy, player, attack === 'dash');
    } else {
      if (enemy.model.shield) enemy.model.shield.rotation.z += .7;
      this.callbacks.onEnemyHurt?.(enemy.type, enemy.health, enemy.maxHealth, attack);
    }
    return true;
  }

  throwAcorn(origin, direction) {
    const mesh = new THREE.Mesh(
      new THREE.DodecahedronGeometry(.19, 0),
      new THREE.MeshStandardMaterial({ color: '#bc6b31', roughness: .76, flatShading: true }),
    );
    mesh.position.copy(origin);
    mesh.castShadow = true;
    this.scene.add(mesh);
    const velocity = direction.clone().normalize().multiplyScalar(20);
    velocity.y += 1.2;
    this.friendlyProjectiles.push({ mesh, velocity, life: 1.65 });
  }

  damageBoss(player) {
    const boss = this.boss;
    if (!boss.alive || boss.hitCooldown > 0) return;
    boss.health -= 1;
    boss.hitCooldown = 1.05;
    boss.core.scale.setScalar(1.8);
    boss.warning.intensity = 3.4;
    player.bounce();
    this.burst(boss.position.clone().add(new THREE.Vector3(0, 2.2, 0)), '#ffca5c', 16);
    this.callbacks.onBossHit?.(boss.health, boss.maxHealth);
    if (boss.health <= 0) {
      boss.alive = false;
      boss.active = false;
      boss.collapse = 2.8;
      this.burst(boss.position.clone().add(new THREE.Vector3(0, 2.3, 0)), '#ffe18a', 30);
      this.callbacks.onBossDown?.();
    }
  }

  burst(position, color, count = 8) {
    const geometry = new THREE.TetrahedronGeometry(.11, 0);
    const material = createBurstMaterial(color);
    for (let index = 0; index < count; index += 1) {
      const mesh = new THREE.Mesh(geometry, material.clone());
      mesh.position.copy(position);
      const direction = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 1.6, Math.random() * 2 - 1).normalize();
      this.scene.add(mesh);
      this.effects.push({ mesh, velocity: direction.multiplyScalar(2.5 + Math.random() * 4), life: .5 + Math.random() * .4, maxLife: .9 });
    }
  }

  update(delta, player, solarSeeds) {
    this.time += delta;
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      // Los vigías y pesados permanecen sobre la plataforma que los aloja.
      enemy.position.y = enemy.platform.top + .02;
      const distance = horizontalDistance(enemy.position, player.position);
      const verticalDistance = Math.abs(enemy.position.y - player.position.y);
      enemy.cooldown -= delta;
      enemy.hitCooldown = Math.max(0, enemy.hitCooldown - delta);
      const model = enemy.model;

      if (distance < 2.05 && verticalDistance < 2.1 && player.getDashActive() && player.velocity.y < -3.5 && enemy.hitCooldown <= 0) {
        this.damageEnemy(enemy, player, 'dash');
        continue;
      }
      if (distance < 2.85 && verticalDistance < 2.15 && player.getSpinActive()) {
        if (enemy.hitCooldown <= 0) this.damageEnemy(enemy, player, 'spin');
        // El aura también bloquea el contacto mientras el enemigo se recupera del golpe.
        continue;
      }
      if (distance < (enemy.type === 'heavy' ? 1.65 : 1.15) && verticalDistance < 1.6) player.damage(1, enemy.position);

      if (enemy.type === 'lookout') {
        const aware = distance < 23 && verticalDistance < 15;
        model.alert.material.opacity += ((aware ? .92 : 0) - model.alert.material.opacity) * Math.min(1, delta * 5);
        model.alert.position.y = 2.35 + Math.sin(this.time * 4) * .1;
        if (aware) {
          const angle = Math.atan2(player.position.x - enemy.position.x, player.position.z - enemy.position.z);
          model.root.rotation.y = dampAngle(model.root.rotation.y, angle, 5, delta);
          if (enemy.cooldown <= 0) {
            this.shoot(enemy.position.clone().add(new THREE.Vector3(0, 1.25, 0)), player.position, 'stone');
            enemy.cooldown = 2.0 + Math.random() * .6;
            this.callbacks.onLookoutShot?.();
          }
        } else {
          model.root.rotation.y += delta * .23;
        }
      } else {
        const patrol = enemy.platform;
        const playerOnPatrol = Math.abs(player.position.x - patrol.x) <= patrol.width / 2 + .4
          && Math.abs(player.position.z - patrol.z) <= patrol.depth / 2 + .4;
        const inRange = playerOnPatrol && distance < 11 && verticalDistance < 3.2;
        const target = inRange ? player.position : enemy.home;
        const direction = target.clone().sub(enemy.position).setY(0);
        if (direction.lengthSq() > .4) {
          direction.normalize();
          const amount = (inRange ? enemy.speed : enemy.speed * .35) * delta;
          enemy.position.addScaledVector(direction, amount);
          // Nunca persiguen a través de un hueco: quedan dentro de su plataforma.
          enemy.position.x = THREE.MathUtils.clamp(enemy.position.x, patrol.x - patrol.width / 2 + .62, patrol.x + patrol.width / 2 - .62);
          enemy.position.z = THREE.MathUtils.clamp(enemy.position.z, patrol.z - patrol.depth / 2 + .62, patrol.z + patrol.depth / 2 - .62);
          const angle = Math.atan2(direction.x, direction.z);
          model.root.rotation.y = dampAngle(model.root.rotation.y, angle, 7, delta);
        }
        model.shield.rotation.z = Math.sin(this.time * 3 + enemy.patrolPhase) * .06;
      }
      model.visual.position.y = Math.sin(this.time * 4 + enemy.patrolPhase) * .035;
      model.tail.rotation.y = Math.sin(this.time * 5 + enemy.patrolPhase) * .16;
      model.leftArm.rotation.x = Math.sin(this.time * 4 + enemy.patrolPhase) * .25;
      model.rightArm.rotation.x = -Math.sin(this.time * 4 + enemy.patrolPhase) * .25;
    }

    this.updateBoss(delta, player, solarSeeds);
    this.updateProjectiles(delta, player);
    this.updateFriendlyProjectiles(delta);
    this.updateEffects(delta);
  }

  updateBoss(delta, player, solarSeeds) {
    const boss = this.boss;
    if (!boss) return;
    boss.hitCooldown = Math.max(0, boss.hitCooldown - delta);
    boss.core.scale.lerp(new THREE.Vector3(1, 1, 1), Math.min(1, delta * 5));
    boss.warning.intensity += ((boss.active ? 1.55 : .7) - boss.warning.intensity) * Math.min(1, delta * 3);
    const distance = horizontalDistance(boss.position, player.position);
    const verticalDistance = Math.abs(boss.position.y - player.position.y);

    if (boss.alive) {
      if (solarSeeds >= 3 && distance < 33) {
        if (!boss.active) this.callbacks.onBossAwake?.();
        boss.active = true;
      }
      if (boss.active) {
        const targetAngle = Math.atan2(player.position.x - boss.position.x, player.position.z - boss.position.z);
        boss.root.rotation.y = dampAngle(boss.root.rotation.y, targetAngle, 3, delta);
        boss.cooldown -= delta;
        boss.wheels.forEach((wheel) => { wheel.rotation.x += delta * 3.2; });
        if (boss.cooldown <= 0 && distance < 27) {
          this.shoot(boss.position.clone().add(new THREE.Vector3(0, 2.5, 0)), player.position, 'boss');
          boss.cooldown = 1.3;
        }
        if (distance < 3.05 && verticalDistance < 3.3 && player.getDashActive() && player.velocity.y < -2.8 && boss.hitCooldown <= 0) this.damageBoss(player);
        else if (distance < 2.5 && verticalDistance < 2.5) player.damage(1, boss.position);
      }
      boss.core.rotation.y += delta * 3.5;
    } else if (boss.collapse > 0) {
      boss.collapse -= delta;
      boss.root.rotation.z += delta * .52;
      boss.root.position.y = Math.max(boss.floorY, boss.root.position.y - delta * 2.7);
    }
  }

  updateFriendlyProjectiles(delta) {
    for (let index = this.friendlyProjectiles.length - 1; index >= 0; index -= 1) {
      const projectile = this.friendlyProjectiles[index];
      projectile.life -= delta;
      projectile.velocity.y -= 3.8 * delta;
      projectile.mesh.position.addScaledVector(projectile.velocity, delta);
      projectile.mesh.rotation.x += delta * 15;
      projectile.mesh.rotation.z += delta * 11;
      let hit = false;
      for (const enemy of this.enemies) {
        if (!enemy.alive) continue;
        const target = enemy.position.clone().add(new THREE.Vector3(0, .85, 0));
        if (projectile.mesh.position.distanceTo(target) < 1.08) {
          this.damageEnemy(enemy, null, 'acorn');
          hit = true;
          break;
        }
      }
      if (hit || projectile.life <= 0 || projectile.mesh.position.y < -2) {
        this.scene.remove(projectile.mesh);
        projectile.mesh.geometry.dispose();
        projectile.mesh.material.dispose();
        this.friendlyProjectiles.splice(index, 1);
      }
    }
  }

  updateProjectiles(delta, player) {
    for (let index = this.projectiles.length - 1; index >= 0; index -= 1) {
      const projectile = this.projectiles[index];
      projectile.life -= delta;
      projectile.velocity.y -= (projectile.type === 'boss' ? 3.2 : 4.5) * delta;
      projectile.mesh.position.addScaledVector(projectile.velocity, delta);
      projectile.mesh.rotation.x += delta * 9;
      projectile.mesh.rotation.z += delta * 7;
      if (projectile.mesh.position.distanceTo(player.position.clone().add(new THREE.Vector3(0, .8, 0))) < (projectile.type === 'boss' ? .88 : .68)) {
        player.damage(1, projectile.mesh.position);
        this.burst(projectile.mesh.position, projectile.type === 'boss' ? '#ff9361' : '#d9bd88', 5);
        projectile.life = 0;
      }
      if (projectile.life <= 0 || projectile.mesh.position.y < -2) {
        this.scene.remove(projectile.mesh);
        projectile.mesh.geometry.dispose();
        projectile.mesh.material.dispose();
        this.projectiles.splice(index, 1);
      }
    }
  }

  updateEffects(delta) {
    for (let index = this.effects.length - 1; index >= 0; index -= 1) {
      const effect = this.effects[index];
      effect.life -= delta;
      effect.velocity.y -= 8 * delta;
      effect.mesh.position.addScaledVector(effect.velocity, delta);
      effect.mesh.rotation.x += delta * 9;
      effect.mesh.rotation.y += delta * 7;
      effect.mesh.material.opacity = Math.max(0, effect.life / effect.maxLife);
      effect.mesh.scale.setScalar(Math.max(.1, effect.life / effect.maxLife));
      if (effect.life <= 0) {
        this.scene.remove(effect.mesh);
        effect.mesh.material.dispose();
        this.effects.splice(index, 1);
      }
    }
  }

  reset() {
    for (const projectile of this.projectiles) this.scene.remove(projectile.mesh);
    for (const projectile of this.friendlyProjectiles) this.scene.remove(projectile.mesh);
    this.projectiles = [];
    this.friendlyProjectiles = [];
  }
}
