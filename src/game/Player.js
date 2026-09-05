import * as THREE from 'three';

const damp = (current, target, lambda, delta) => THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * delta));
const dampAngle = (current, target, lambda, delta) => {
  const difference = THREE.MathUtils.euclideanModulo(target - current + Math.PI, Math.PI * 2) - Math.PI;
  return current + difference * (1 - Math.exp(-lambda * delta));
};

function makeMembrane(side, material) {
  const geometry = new THREE.BufferGeometry();
  const points = [
    new THREE.Vector3(side * .08, 1.12, -.2),
    new THREE.Vector3(side * 1.2, .91, .02),
    new THREE.Vector3(side * .72, .38, .42),
    new THREE.Vector3(side * .14, .52, .24),
  ];
  const positions = new Float32Array(points.flatMap((point) => [point.x, point.y, point.z]));
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 2;
  return mesh;
}

export class Player {
  constructor(scene, spawn, callbacks = {}) {
    this.scene = scene;
    this.callbacks = callbacks;
    this.position = spawn.clone();
    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3(0, 0, -1);
    this.desiredDirection = new THREE.Vector3();
    this.height = 1.55;
    this.radius = .46;
    this.health = 3;
    this.stamina = 100;
    this.grounded = true;
    this.gliding = false;
    this.climbing = false;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.spinTimer = 0;
    this.spinCooldown = 0;
    this.throwCooldown = 0;
    this.smallAcorns = 18;
    this.maxSmallAcorns = 36;
    this.invulnerableTimer = 0;
    this.glideStartTimer = 0;
    this.airTime = 0;
    this.checkpoint = spawn.clone();
    this.wasGliding = false;
    this.modelTime = 0;
    this.lastThermal = null;

    this.group = new THREE.Group();
    this.group.position.copy(this.position);
    this.group.castShadow = true;
    this.buildModel();
    scene.add(this.group);
  }

  buildModel() {
    const fur = new THREE.MeshStandardMaterial({ color: '#a8643c', roughness: .87, flatShading: true });
    const furLight = new THREE.MeshStandardMaterial({ color: '#cd8650', roughness: .83, flatShading: true });
    const belly = new THREE.MeshStandardMaterial({ color: '#fff0d3', roughness: .92, flatShading: true });
    const ear = new THREE.MeshStandardMaterial({ color: '#f6ad93', roughness: .78, flatShading: true });
    const eye = new THREE.MeshStandardMaterial({ color: '#1e1919', roughness: .25, metalness: .15 });
    const membraneMaterial = new THREE.MeshStandardMaterial({ color: '#d78f65', transparent: true, opacity: .73, side: THREE.DoubleSide, roughness: .82, flatShading: true, depthWrite: false });

    this.visual = new THREE.Group();
    this.visual.position.y = .02;
    this.group.add(this.visual);

    const shadow = new THREE.Mesh(new THREE.CircleGeometry(.67, 16), new THREE.MeshBasicMaterial({ color: '#173124', transparent: true, opacity: .25, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = .035;
    this.group.add(shadow);
    this.shadow = shadow;

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(.39, .65, 4, 7), fur);
    body.position.set(0, .89, .08);
    body.rotation.x = -.22;
    body.castShadow = true;
    this.visual.add(body);
    this.body = body;

    const chest = new THREE.Mesh(new THREE.SphereGeometry(.325, 7, 6), belly);
    chest.scale.set(.85, 1.16, .5);
    chest.position.set(0, .91, -.31);
    chest.castShadow = true;
    this.visual.add(chest);

    const head = new THREE.Mesh(new THREE.SphereGeometry(.45, 8, 7), furLight);
    head.position.set(0, 1.51, -.29);
    head.scale.set(1, .94, .94);
    head.castShadow = true;
    this.visual.add(head);
    this.head = head;

    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(.255, 7, 5), belly);
    muzzle.position.set(0, 1.4, -.65);
    muzzle.scale.set(1.15, .72, .63);
    muzzle.castShadow = true;
    this.visual.add(muzzle);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(.08, 6, 5), eye);
    nose.position.set(0, 1.46, -.82);
    this.visual.add(nose);

    [-1, 1].forEach((side) => {
      const earShape = new THREE.Mesh(new THREE.ConeGeometry(.18, .38, 5), furLight);
      earShape.position.set(side * .28, 1.87, -.26);
      earShape.rotation.z = side * -.18;
      earShape.castShadow = true;
      this.visual.add(earShape);
      const innerEar = new THREE.Mesh(new THREE.CircleGeometry(.09, 5), ear);
      innerEar.position.set(side * .29, 1.86, -.41);
      this.visual.add(innerEar);

      const eyeMesh = new THREE.Mesh(new THREE.SphereGeometry(.075, 6, 5), eye);
      eyeMesh.position.set(side * .23, 1.59, -.67);
      this.visual.add(eyeMesh);

      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(.12, .42, 3, 5), furLight);
      arm.position.set(side * .42, 1.03, -.12);
      arm.rotation.z = side * .7;
      arm.rotation.x = .28;
      arm.castShadow = true;
      this.visual.add(arm);
      if (side === -1) this.leftArm = arm;
      else this.rightArm = arm;

      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(.15, .35, 3, 5), fur);
      leg.position.set(side * .28, .44, .21);
      leg.rotation.z = side * .18;
      leg.rotation.x = -.34;
      leg.castShadow = true;
      this.visual.add(leg);
      if (side === -1) this.leftLeg = leg;
      else this.rightLeg = leg;
    });

    this.membranes = [makeMembrane(-1, membraneMaterial), makeMembrane(1, membraneMaterial.clone())];
    this.membranes.forEach((membrane) => {
      membrane.scale.x = .18;
      this.visual.add(membrane);
    });

    this.tail = new THREE.Group();
    this.tail.position.set(0, .72, .45);
    this.visual.add(this.tail);
    const tailSegments = [
      { y: .08, z: .28, scale: .38 }, { y: .28, z: .62, scale: .45 }, { y: .54, z: .94, scale: .39 }, { y: .79, z: 1.16, scale: .25 },
    ];
    tailSegments.forEach((segment, index) => {
      const tailPiece = new THREE.Mesh(new THREE.DodecahedronGeometry(segment.scale, 0), index === 3 ? furLight : fur);
      tailPiece.position.set(0, segment.y, segment.z);
      tailPiece.scale.set(1.05, .86, 1.48);
      tailPiece.castShadow = true;
      this.tail.add(tailPiece);
    });

    const scarf = new THREE.Mesh(new THREE.TorusGeometry(.35, .075, 5, 10), new THREE.MeshStandardMaterial({ color: '#5ab7a0', roughness: .7, flatShading: true }));
    scarf.position.set(0, 1.29, -.28);
    scarf.rotation.x = Math.PI / 2;
    this.visual.add(scarf);

    // Aro luminoso del ataque giratorio: aparece solo durante el giro.
    this.spinAura = new THREE.Group();
    this.spinAura.position.y = .93;
    const auraMaterial = new THREE.MeshBasicMaterial({ color: '#bdf5a0', transparent: true, opacity: .78, depthWrite: false, blending: THREE.AdditiveBlending });
    const auraOuter = new THREE.Mesh(new THREE.TorusGeometry(1.08, .055, 5, 18), auraMaterial);
    auraOuter.rotation.x = Math.PI / 2;
    const auraInner = new THREE.Mesh(new THREE.TorusGeometry(.68, .04, 5, 14), auraMaterial.clone());
    auraInner.rotation.x = Math.PI / 2;
    auraInner.rotation.z = .65;
    this.spinAura.add(auraOuter, auraInner);
    this.spinAura.visible = false;
    this.group.add(this.spinAura);
  }

  setCheckpoint(position) {
    this.checkpoint.copy(position);
  }

  getForward() {
    return this.direction.clone();
  }

  getDashActive() {
    return this.dashTimer > 0;
  }

  getSpinActive() {
    return this.spinTimer > 0;
  }

  addSmallAcorns(amount) {
    this.smallAcorns = Math.min(this.maxSmallAcorns, this.smallAcorns + amount);
    return this.smallAcorns;
  }

  spin() {
    if (this.spinCooldown > 0 || this.dashTimer > 0 || this.climbing) return false;
    this.spinTimer = .48;
    this.spinCooldown = .72;
    this.gliding = false;
    this.callbacks.onEvent?.('spin');
    return true;
  }

  throwAcorn(direction = this.direction) {
    if (this.throwCooldown > 0) return false;
    if (this.smallAcorns <= 0) {
      this.callbacks.onEmptyAmmo?.();
      return false;
    }
    this.smallAcorns -= 1;
    this.throwCooldown = .22;
    const throwDirection = direction.clone().setY(0);
    if (throwDirection.lengthSq() < .001) throwDirection.copy(this.direction);
    throwDirection.normalize();
    const origin = this.position.clone().add(new THREE.Vector3(0, 1.08, 0)).addScaledVector(throwDirection, .66);
    this.callbacks.onThrow?.(origin, throwDirection);
    this.callbacks.onEvent?.('throw');
    return true;
  }

  jump() {
    this.velocity.y = 10.2;
    this.grounded = false;
    this.climbing = false;
    this.airTime = 0;
    this.callbacks.onEvent?.('jump');
  }

  dash() {
    if (this.grounded || this.dashCooldown > 0 || this.climbing) return false;
    const horizontalSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    const forward = horizontalSpeed > 2 ? new THREE.Vector3(this.velocity.x, 0, this.velocity.z).normalize() : this.direction.clone();
    this.velocity.x = forward.x * 12.5;
    this.velocity.z = forward.z * 12.5;
    this.velocity.y = -17.5;
    this.dashTimer = .48;
    this.dashCooldown = .6;
    this.gliding = false;
    this.callbacks.onEvent?.('dash');
    return true;
  }

  bounce() {
    this.velocity.y = 9.4;
    this.dashTimer = 0;
    this.gliding = false;
    this.airTime = 0;
  }

  damage(amount = 1, from = null) {
    if (this.invulnerableTimer > 0) return false;
    const previous = this.health;
    this.health = Math.max(0, this.health - amount);
    this.invulnerableTimer = 1.25;
    this.gliding = false;
    if (from) {
      const knockback = this.position.clone().sub(from).setY(0);
      if (knockback.lengthSq() > .01) knockback.normalize();
      this.velocity.addScaledVector(knockback, 7.5);
      this.velocity.y = 5.3;
    }
    this.callbacks.onDamage?.(this.health, previous);
    this.callbacks.onEvent?.('hurt');
    if (this.health <= 0) this.respawn(true);
    return true;
  }

  respawn(restoreHealth = false) {
    this.position.copy(this.checkpoint);
    this.velocity.set(0, 0, 0);
    this.grounded = false;
    this.gliding = false;
    this.climbing = false;
    this.dashTimer = 0;
    this.spinTimer = 0;
    this.stamina = 100;
    this.invulnerableTimer = 1.6;
    if (restoreHealth) this.health = 3;
    this.callbacks.onRespawn?.();
  }

  update(delta, input, cameraYaw, world) {
    this.modelTime += delta;
    this.invulnerableTimer = Math.max(0, this.invulnerableTimer - delta);
    this.dashTimer = Math.max(0, this.dashTimer - delta);
    this.dashCooldown = Math.max(0, this.dashCooldown - delta);
    this.spinTimer = Math.max(0, this.spinTimer - delta);
    this.spinCooldown = Math.max(0, this.spinCooldown - delta);
    this.throwCooldown = Math.max(0, this.throwCooldown - delta);
    this.airTime = this.grounded ? 0 : this.airTime + delta;

    const cameraForward = new THREE.Vector3(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
    const cameraRight = new THREE.Vector3(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));
    this.desiredDirection.set(0, 0, 0)
      .addScaledVector(cameraForward, input.move.y)
      .addScaledVector(cameraRight, input.move.x);
    if (this.desiredDirection.lengthSq() > .001) this.desiredDirection.normalize();

    if (input.consumeJumpPressed() && this.grounded) this.jump();
    if (input.consumeDashPressed()) this.dash();
    if (input.consumeSpinPressed()) this.spin();
    if (input.consumeThrowPressed()) this.throwAcorn(this.desiredDirection.lengthSq() > .01 ? this.desiredDirection : cameraForward);

    const climbable = world.getClimbable(this.position);
    const tryingToClimb = climbable && this.desiredDirection.lengthSq() > .03 && this.dashTimer <= 0 && (input.jumpHeld || !this.grounded || input.move.y > .15) && this.position.y < climbable.top - .25;
    this.climbing = Boolean(tryingToClimb && !this.gliding);

    let thermal = null;
    const canGlide = !this.grounded && !this.climbing && this.dashTimer <= 0 && this.spinTimer <= 0 && input.jumpHeld && this.stamina > .1 && this.velocity.y < 4.2;
    if (canGlide) {
      thermal = world.getThermal(this.position);
      if (!this.gliding) this.callbacks.onEvent?.('glide');
      this.gliding = true;
      this.stamina = Math.max(0, this.stamina - delta * (thermal ? 7 : 10));
      const glideDirection = this.desiredDirection.lengthSq() > .01 ? this.desiredDirection : this.direction;
      const glideSpeed = thermal ? 11.5 : 9.5;
      this.velocity.x = damp(this.velocity.x, glideDirection.x * glideSpeed, 1.6, delta);
      this.velocity.z = damp(this.velocity.z, glideDirection.z * glideSpeed, 1.6, delta);
      this.velocity.y = damp(this.velocity.y, thermal ? 2.1 : -1.85, thermal ? 1.4 : 2.8, delta);
      if (thermal) {
        this.velocity.y = Math.min(10.2, this.velocity.y + thermal.strength * delta);
        if (this.lastThermal !== thermal) this.callbacks.onThermal?.();
      }
    } else {
      this.gliding = false;
      thermal = null;
    }
    this.lastThermal = thermal;

    if (this.climbing) {
      this.stamina = Math.min(100, this.stamina + delta * 8);
      this.velocity.y = damp(this.velocity.y, input.jumpHeld ? 6.1 : 3.8, 7, delta);
      this.velocity.x = damp(this.velocity.x, this.desiredDirection.x * 2.9, 8, delta);
      this.velocity.z = damp(this.velocity.z, this.desiredDirection.z * 2.9, 8, delta);
    } else if (this.dashTimer > 0) {
      this.velocity.y = damp(this.velocity.y, -19.5, 12, delta);
      this.velocity.x *= 1 - Math.min(.72 * delta, .16);
      this.velocity.z *= 1 - Math.min(.72 * delta, .16);
    } else {
      if (!this.gliding) this.velocity.y -= 26 * delta;
      const isMoving = this.desiredDirection.lengthSq() > .01;
      const speed = this.grounded ? 7.2 : 4.7;
      const response = this.grounded ? 16 : 3.4;
      if (isMoving) {
        this.velocity.x = damp(this.velocity.x, this.desiredDirection.x * speed, response, delta);
        this.velocity.z = damp(this.velocity.z, this.desiredDirection.z * speed, response, delta);
      } else {
        this.velocity.x = damp(this.velocity.x, 0, this.grounded ? 15 : .55, delta);
        this.velocity.z = damp(this.velocity.z, 0, this.grounded ? 15 : .55, delta);
      }
      if (this.grounded) this.stamina = Math.min(100, this.stamina + delta * 19);
    }

    if (this.desiredDirection.lengthSq() > .01 && this.dashTimer <= 0) {
      const targetAngle = Math.atan2(-this.desiredDirection.x, -this.desiredDirection.z);
      this.group.rotation.y = dampAngle(this.group.rotation.y, targetAngle, this.gliding ? 4 : 11, delta);
      this.direction.set(-Math.sin(this.group.rotation.y), 0, -Math.cos(this.group.rotation.y));
    }

    const previousY = this.position.y;
    this.position.addScaledVector(this.velocity, delta);
    world.constrainPosition(this.position, this.radius);
    const landingHeight = world.getLandingHeight(this.position.x, this.position.z, previousY);
    const wasGrounded = this.grounded;
    if (this.position.y <= landingHeight && this.velocity.y <= 0) {
      this.position.y = landingHeight;
      this.velocity.y = 0;
      this.grounded = true;
      this.gliding = false;
      this.climbing = false;
      if (!wasGrounded && previousY - landingHeight > 10.5) {
        this.damage(1);
      }
    } else {
      this.grounded = false;
    }

    if (this.position.y < -9) this.respawn();
    this.group.position.copy(this.position);
    this.animateModel(delta);
  }

  animateModel(delta) {
    const moving = Math.min(1, Math.hypot(this.velocity.x, this.velocity.z) / 7);
    const bob = this.grounded ? Math.sin(this.modelTime * 12) * .045 * moving : 0;
    this.visual.position.y = .02 + bob;
    if (this.spinTimer > 0) {
      this.visual.rotation.y += delta * 33;
      this.spinAura.visible = true;
      this.spinAura.rotation.y += delta * 20;
      this.spinAura.rotation.z += delta * 9;
      const pulse = 1 + Math.sin(this.spinTimer * 26) * .14;
      this.spinAura.scale.setScalar(pulse);
    } else {
      this.visual.rotation.y = dampAngle(this.visual.rotation.y, 0, 18, delta);
      this.spinAura.visible = false;
    }
    this.body.rotation.x = -.22 + (this.gliding ? .24 : 0) + (this.dashTimer > 0 ? .45 : 0);
    this.head.rotation.x = this.gliding ? -.08 : Math.sin(this.modelTime * 3) * .025;
    const stride = Math.sin(this.modelTime * 12) * moving;
    this.leftLeg.rotation.x = -.34 + stride * .48;
    this.rightLeg.rotation.x = -.34 - stride * .48;
    this.leftArm.rotation.x = .28 - stride * .36 + (this.gliding ? -.35 : 0);
    this.rightArm.rotation.x = .28 + stride * .36 + (this.gliding ? -.35 : 0);
    const membraneScale = this.gliding ? 1 : .18;
    this.membranes.forEach((membrane, index) => {
      membrane.scale.x = damp(membrane.scale.x, membraneScale, this.gliding ? 10 : 15, delta);
      membrane.material.opacity = damp(membrane.material.opacity, this.gliding ? .78 : .2, 8, delta);
      membrane.rotation.z = (index ? -1 : 1) * (this.gliding ? .05 : .16);
    });
    this.tail.rotation.x = this.gliding ? -.22 : .16 + Math.sin(this.modelTime * 5) * .13;
    this.tail.rotation.y = Math.sin(this.modelTime * 4) * .11;
    this.shadow.scale.setScalar(this.grounded ? .98 : Math.max(.36, 1 - Math.min(8, this.position.y) * .055));
    this.shadow.material.opacity = this.grounded ? .26 : .12;
    this.visual.visible = Math.floor(this.invulnerableTimer * 12) % 2 === 0 || this.invulnerableTimer <= 0;
  }
}
