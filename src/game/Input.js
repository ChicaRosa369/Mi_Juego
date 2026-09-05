import * as THREE from 'three';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export class InputController {
  constructor() {
    this.keys = new Set();
    this.move = new THREE.Vector2();
    this.joystick = new THREE.Vector2();
    this.lookDelta = new THREE.Vector2();
    this.jumpHeld = false;
    this.jumpPressed = false;
    this.dashPressed = false;
    this.actionPressed = false;
    this.pausePressed = false;
    this.joyPointer = null;
    this.lookPointer = null;
    this.lastLook = new THREE.Vector2();

    this.joystickZone = document.querySelector('#joystick-zone');
    this.joystickBase = document.querySelector('#joystick-base');
    this.joystickStick = document.querySelector('#joystick-stick');
    this.lookZone = document.querySelector('#look-zone');
    this.jumpButton = document.querySelector('#jump-button');
    this.dashButton = document.querySelector('#dash-button');
    this.actionButton = document.querySelector('#action-button');

    this.bindKeyboard();
    this.bindTouch();
  }

  bindKeyboard() {
    const movementKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyF', 'KeyE', 'KeyP']);
    window.addEventListener('keydown', (event) => {
      if (movementKeys.has(event.code)) event.preventDefault();
      if (event.repeat) {
        this.keys.add(event.code);
        return;
      }
      this.keys.add(event.code);
      if (event.code === 'Space') {
        this.jumpPressed = true;
        this.jumpHeld = true;
      }
      if (event.code === 'KeyF') this.dashPressed = true;
      if (event.code === 'KeyE') this.actionPressed = true;
      if (event.code === 'KeyP') this.pausePressed = true;
    }, { passive: false });

    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
      if (event.code === 'Space') this.jumpHeld = false;
    });
    window.addEventListener('blur', () => this.resetHeld());
  }

  bindTouch() {
    const stop = (event) => event.stopPropagation();

    this.joystickZone.addEventListener('pointerdown', (event) => {
      stop(event);
      event.preventDefault();
      this.joyPointer = event.pointerId;
      this.joystickZone.setPointerCapture?.(event.pointerId);
      this.updateJoystick(event.clientX, event.clientY);
    });
    this.joystickZone.addEventListener('pointermove', (event) => {
      if (event.pointerId !== this.joyPointer) return;
      event.preventDefault();
      this.updateJoystick(event.clientX, event.clientY);
    });
    const clearJoy = (event) => {
      if (event.pointerId !== this.joyPointer) return;
      this.joyPointer = null;
      this.joystick.set(0, 0);
      this.joystickStick.style.transform = 'translate(0px, 0px)';
    };
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((type) => this.joystickZone.addEventListener(type, clearJoy));

    this.lookZone.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      event.preventDefault();
      this.lookPointer = event.pointerId;
      this.lastLook.set(event.clientX, event.clientY);
      this.lookZone.setPointerCapture?.(event.pointerId);
    });
    this.lookZone.addEventListener('pointermove', (event) => {
      if (event.pointerId !== this.lookPointer) return;
      event.preventDefault();
      this.lookDelta.x += event.clientX - this.lastLook.x;
      this.lookDelta.y += event.clientY - this.lastLook.y;
      this.lastLook.set(event.clientX, event.clientY);
    });
    const clearLook = (event) => {
      if (event.pointerId !== this.lookPointer) return;
      this.lookPointer = null;
    };
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((type) => this.lookZone.addEventListener(type, clearLook));

    const buttonDown = (button, callback) => {
      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        button.setPointerCapture?.(event.pointerId);
        button.classList.add('active');
        callback();
      });
    };
    const buttonRelease = (button, callback = () => {}) => {
      const release = (event) => {
        button.classList.remove('active');
        callback(event);
      };
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((type) => button.addEventListener(type, release));
    };

    buttonDown(this.jumpButton, () => {
      this.jumpPressed = true;
      this.jumpHeld = true;
    });
    buttonRelease(this.jumpButton, () => { this.jumpHeld = false; });
    buttonDown(this.dashButton, () => { this.dashPressed = true; });
    buttonRelease(this.dashButton);
    buttonDown(this.actionButton, () => { this.actionPressed = true; });
    buttonRelease(this.actionButton);
  }

  bindDesktopLook(element) {
    element.addEventListener('pointerdown', (event) => {
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      this.lookPointer = event.pointerId;
      this.lastLook.set(event.clientX, event.clientY);
      element.setPointerCapture?.(event.pointerId);
    });
    element.addEventListener('pointermove', (event) => {
      if (event.pointerId !== this.lookPointer || event.pointerType !== 'mouse') return;
      this.lookDelta.x += event.clientX - this.lastLook.x;
      this.lookDelta.y += event.clientY - this.lastLook.y;
      this.lastLook.set(event.clientX, event.clientY);
    });
    const release = (event) => {
      if (event.pointerId === this.lookPointer) this.lookPointer = null;
    };
    element.addEventListener('pointerup', release);
    element.addEventListener('pointercancel', release);
  }

  updateJoystick(clientX, clientY) {
    const rect = this.joystickBase.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const maxRadius = rect.width * .32;
    let deltaX = clientX - centerX;
    let deltaY = clientY - centerY;
    const length = Math.hypot(deltaX, deltaY);
    if (length > maxRadius) {
      deltaX = (deltaX / length) * maxRadius;
      deltaY = (deltaY / length) * maxRadius;
    }
    this.joystick.set(deltaX / maxRadius, -deltaY / maxRadius);
    this.joystickStick.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
  }

  update() {
    const keyboardX = (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) - (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0);
    const keyboardY = (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) - (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0);
    this.move.set(keyboardX + this.joystick.x, keyboardY + this.joystick.y);
    if (this.move.lengthSq() > 1) this.move.normalize();
  }

  consumeLook() {
    const result = this.lookDelta.clone();
    this.lookDelta.set(0, 0);
    return result;
  }

  consumeJumpPressed() {
    const result = this.jumpPressed;
    this.jumpPressed = false;
    return result;
  }

  consumeDashPressed() {
    const result = this.dashPressed;
    this.dashPressed = false;
    return result;
  }

  consumeActionPressed() {
    const result = this.actionPressed;
    this.actionPressed = false;
    return result;
  }

  consumePausePressed() {
    const result = this.pausePressed;
    this.pausePressed = false;
    return result;
  }

  resetHeld() {
    this.keys.clear();
    this.move.set(0, 0);
    this.joystick.set(0, 0);
    this.jumpHeld = false;
    this.joyPointer = null;
    this.lookPointer = null;
    if (this.joystickStick) this.joystickStick.style.transform = 'translate(0px, 0px)';
  }

  dispose() {
    this.resetHeld();
  }
}

export { clamp };
