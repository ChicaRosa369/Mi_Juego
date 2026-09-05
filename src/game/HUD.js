export class HUD {
  constructor() {
    this.root = document.querySelector('#hud');
    this.hearts = [...document.querySelectorAll('.heart')];
    this.seedCount = document.querySelector('#seed-count');
    this.seedPips = [...document.querySelectorAll('#seed-pips i')];
    this.staminaFill = document.querySelector('#stamina-fill');
    this.staminaNumber = document.querySelector('#stamina-number');
    this.objectiveText = document.querySelector('#objective-text');
    this.zoneLabel = document.querySelector('#zone-label');
    this.altitudeLabel = document.querySelector('#altitude-label');
    this.bossPanel = document.querySelector('#boss-panel');
    this.bossFill = document.querySelector('#boss-fill');
    this.bossValue = document.querySelector('#boss-value');
    this.notifications = document.querySelector('#notification-stack');
    this.interaction = document.querySelector('#interaction-prompt');
    this.interactionText = document.querySelector('#interaction-text');
    this.startScreen = document.querySelector('#start-screen');
    this.helpModal = document.querySelector('#help-modal');
    this.victoryScreen = document.querySelector('#victory-screen');
    this.finalSeeds = document.querySelector('#final-seeds');
    this.finalTime = document.querySelector('#final-time');
    this.finalEnemies = document.querySelector('#final-enemies');
    this.lastObjective = '';
    this.toastTimeouts = [];

    document.querySelector('#help-button').addEventListener('click', () => this.openHelp());
    document.querySelector('#close-help').addEventListener('click', () => this.closeHelp());
    document.querySelector('#help-play').addEventListener('click', () => this.closeHelp());
  }

  begin() {
    this.startScreen.classList.add('hidden');
    this.root.classList.add('visible');
  }

  setHealth(health, previous = health) {
    this.hearts.forEach((heart, index) => {
      const isActive = index < health;
      heart.classList.toggle('active', isActive);
      if (index === health && previous > health) {
        heart.classList.remove('hurt');
        void heart.offsetWidth;
        heart.classList.add('hurt');
      }
    });
  }

  setSeeds(count) {
    this.seedCount.innerHTML = `${count} <em>/</em> 3`;
    this.seedPips.forEach((pip, index) => pip.classList.toggle('active', index < count));
  }

  setStamina(value) {
    const rounded = Math.max(0, Math.round(value));
    this.staminaFill.style.width = `${rounded}%`;
    this.staminaNumber.textContent = `${rounded}`;
    this.staminaFill.classList.toggle('low', rounded < 28);
  }

  setObjective(text) {
    if (text === this.lastObjective) return;
    this.lastObjective = text;
    this.objectiveText.textContent = text;
  }

  setZone(y) {
    let zone = 'SUELO DEL BOSQUE';
    if (y > 28) zone = 'COPA ALTA · VIENTOS ABIERTOS';
    else if (y > 10) zone = 'DOSEL MEDIO · RAMAS VIVAS';
    this.zoneLabel.textContent = zone;
    this.altitudeLabel.textContent = `${Math.max(0, Math.round(y * 2.2))} m`;
  }

  setBoss(visible, health = 3, maxHealth = 3) {
    this.bossPanel.classList.toggle('show', visible);
    const amount = Math.max(0, health);
    this.bossFill.style.width = `${(amount / maxHealth) * 100}%`;
    this.bossValue.textContent = String(amount).padStart(2, '0');
  }

  setInteraction(show, text = 'ACTIVAR ALTAR') {
    this.interaction.classList.toggle('show', show);
    this.interactionText.textContent = text;
  }

  toast(message, kind = '') {
    const toast = document.createElement('div');
    toast.className = `notification ${kind}`;
    toast.textContent = message;
    this.notifications.append(toast);
    const remove = window.setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-8px)';
      window.setTimeout(() => toast.remove(), 250);
    }, 2700);
    this.toastTimeouts.push(remove);
  }

  openHelp() {
    this.helpModal.classList.add('open');
    this.helpModal.setAttribute('aria-hidden', 'false');
  }

  closeHelp() {
    this.helpModal.classList.remove('open');
    this.helpModal.setAttribute('aria-hidden', 'true');
  }

  showVictory({ seeds, seconds, enemies }) {
    this.finalSeeds.textContent = String(seeds);
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
    this.finalTime.textContent = `${mins}:${secs}`;
    this.finalEnemies.textContent = String(enemies);
    this.victoryScreen.classList.add('show');
    this.victoryScreen.setAttribute('aria-hidden', 'false');
  }

  hideVictory() {
    this.victoryScreen.classList.remove('show');
    this.victoryScreen.setAttribute('aria-hidden', 'true');
  }
}
