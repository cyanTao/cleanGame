// ===== 战斗场景：刷怪 / Boss / 道具 / 计分 / HUD =====
import Phaser from 'phaser';
import {
  SCENE, VIEW, PLAYER, ENEMY, DIFFICULTY, INSANE, POWERUP, FONT, COLORS
} from '../config.js';
import { Player } from '../entities/Player.js';
import { Enemy } from '../entities/Enemy.js';
import { Bullet } from '../entities/Bullet.js';
import { Powerup } from '../entities/Powerup.js';
import { InputSystem } from '../systems/InputSystem.js';
import { sfx } from '../systems/SoundFX.js';
import { createButton } from '../systems/ui.js';
import {
  weaponSpread, fireIntervalFor, difficultyAt, bossHpFor, spawnWeights,
  pickWeighted, pickPowerup, formatScore, formatTime, loadBest, saveBest,
  loadLives, loadMode
} from '../systems/gameLogic.js';

export class BattleScene extends Phaser.Scene {
  constructor() {
    super(SCENE.BATTLE);
  }

  create() {
    this.paused = false;
    this.over = false;
    this.elapsed = 0;
    this.score = 0;
    this.kills = 0;
    this.mode = loadMode();
    this.insane = this.mode === 'insane';
    this.diffConfig = this.insane ? INSANE : DIFFICULTY;
    this.fireIntervalMul = this.insane ? INSANE.fireIntervalMul : 1;
    this.bossAttackMs = this.insane ? INSANE.bossAttackMs : 820;
    this.lives = loadLives();
    this.bombs = PLAYER.startBombs;
    this.weaponLevel = PLAYER.startWeapon;
    this.spawnAcc = 0;
    this.fireAcc = 0;
    this.nextBossAt = this.diffConfig.bossEvery * 1000;
    this.bossIndex = 0;
    this.boss = null;
    this.bossPattern = 0;
    this.speedMul = 1;
    this.best = loadBest();
    this.hudLives = -1;
    this.hudWeapon = -1;
    this.hudBombs = -1;
    this.lastSecond = -1;
    this.pauseUI = [];

    this.physics.world.setBounds(0, 0, VIEW.width, VIEW.height);
    this.cameras.main.setBackgroundColor('#04050d');

    this.createBackground();
    this.createGroups();

    this.player = new Player(this, VIEW.width / 2, VIEW.height - 160);
    this.player.reveal(VIEW.width / 2, VIEW.height - 160, this.time.now, 1600);

    this.physics.add.overlap(this.playerBullets, this.enemies, this.onPlayerBulletHitsEnemy, undefined, this);
    this.physics.add.overlap(this.player, this.enemyBullets, this.onPlayerHit, undefined, this);
    this.physics.add.overlap(this.player, this.enemies, this.onPlayerRamsEnemy, undefined, this);
    this.physics.add.overlap(this.player, this.powerups, this.onCollectPowerup, undefined, this);

    this.createHud();
    this.createInput();
    this.showHint();

    this.showBanner('WAVE 01', '#63f2ff', this.insane ? '变态模式 · 准备迎敌' : '准备迎敌');
    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  // ---------- 场景搭建 ----------

  createBackground() {
    this.add.image(0, 0, 'bg_space').setOrigin(0).setDepth(0);
    this.starsFar = this.add.tileSprite(0, 0, VIEW.width, VIEW.height, 'stars_far')
      .setOrigin(0).setDepth(1).setAlpha(0.7);
    this.starsNear = this.add.tileSprite(0, 0, VIEW.width, VIEW.height, 'stars_near')
      .setOrigin(0).setDepth(2).setAlpha(0.95);
    this.add.image(0, 0, 'vignette').setOrigin(0).setDepth(3);
  }

  createGroups() {
    this.playerBullets = this.physics.add.group({
      classType: Bullet, maxSize: 170, runChildUpdate: true
    });
    this.enemyBullets = this.physics.add.group({
      classType: Bullet, maxSize: 320, runChildUpdate: true
    });
    this.enemies = this.physics.add.group({
      classType: Enemy, maxSize: this.diffConfig.maxEnemies, runChildUpdate: true
    });
    this.powerups = this.physics.add.group({
      classType: Powerup, maxSize: 12, runChildUpdate: true
    });
  }

  createInput() {
    this.inputSystem = new InputSystem(this);
    this.inputSystem.addBlockCircle(VIEW.width - 70, VIEW.height - 110, 60);
    this.inputSystem.addBlockRect(VIEW.width - 150, 4, 150, 52);
  }

  // ---------- HUD ----------

  createHud() {
    const bar = this.add.graphics().setDepth(100);
    bar.fillStyle(0x040814, 0.66);
    bar.fillRect(0, 0, VIEW.width, 92);
    bar.lineStyle(1, 0x3d7bff, 0.35);
    bar.lineBetween(0, 92, VIEW.width, 92);

    this.add.text(20, 12, 'SCORE', {
      fontFamily: FONT, fontSize: '11px', color: '#7f8db4'
    }).setDepth(101);

    this.scoreText = this.add.text(20, 24, '000000', {
      fontFamily: FONT, fontSize: '30px', fontStyle: 'bold', color: '#eafcff'
    }).setDepth(101);

    this.bestText = this.add.text(20, 62, 'BEST 000000', {
      fontFamily: FONT, fontSize: '12px', color: '#8fa3c8'
    }).setDepth(101);

    this.waveText = this.add.text(VIEW.width / 2, 14, 'WAVE 01', {
      fontFamily: FONT, fontSize: '12px', color: '#8fa3c8'
    }).setOrigin(0.5, 0).setDepth(101);

    this.timeText = this.add.text(VIEW.width / 2, 28, '00:00', {
      fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: '#cfe2ff'
    }).setOrigin(0.5, 0).setDepth(101);

    this.pauseBtn = this.add.text(VIEW.width - 30, 30, 'II', {
      fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: '#cfe2ff',
      backgroundColor: 'rgba(12, 20, 44, 0.85)', padding: { x: 10, y: 6 }
    }).setOrigin(0.5).setDepth(110).setInteractive({ useHandCursor: true });
    this.pauseBtn.on('pointerdown', () => this.togglePause());

    this.muteBtn = this.add.text(VIEW.width - 96, 30, this.muteLabel(), {
      fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: '#cfe2ff',
      backgroundColor: 'rgba(12, 20, 44, 0.85)', padding: { x: 8, y: 7 }
    }).setOrigin(0.5).setDepth(110).setInteractive({ useHandCursor: true });
    this.muteBtn.on('pointerdown', () => this.toggleMute());

    this.livesGroup = this.add.group();
    this.add.text(20, VIEW.height - 66, 'PWR', {
      fontFamily: FONT, fontSize: '11px', color: '#7f8db4'
    }).setDepth(104);
    this.weaponPips = this.add.graphics().setDepth(104);

    // 激光剩余时间提示
    this.laserText = this.add.text(20, VIEW.height - 90, '', {
      fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: '#c084ff'
    }).setDepth(104);

    // Boss 血条
    this.bossBar = this.add.graphics().setDepth(102).setVisible(false);
    this.bossLabel = this.add.text(VIEW.width / 2, 96, 'BOSS', {
      fontFamily: FONT, fontSize: '10px', fontStyle: 'bold', color: '#ff8a8a'
    }).setOrigin(0.5, 0).setDepth(103).setVisible(false);

    // 炸弹按钮（鼠标与触屏均可点击）
    const bx = VIEW.width - 70;
    const by = VIEW.height - 110;
    this.bombBtn = this.add.image(bx, by, 'btn_bomb')
      .setDepth(106).setAlpha(0.95).setInteractive({ useHandCursor: true });
    this.bombBtn.on('pointerdown', () => this.dropBomb());
    this.add.text(bx, by - 14, 'BOMB', {
      fontFamily: FONT, fontSize: '11px', fontStyle: 'bold', color: '#ffd75e'
    }).setOrigin(0.5).setDepth(107);
    this.bombCountText = this.add.text(bx, by + 10, '×0', {
      fontFamily: FONT, fontSize: '20px', fontStyle: 'bold', color: '#ffd75e'
    }).setOrigin(0.5).setDepth(107);

    this.updateHud(true);
  }

  drawLives() {
    this.livesGroup.clear(true, true);
    for (let i = 0; i < this.lives; i++) {
      const icon = this.add.image(30 + i * 25, VIEW.height - 34, 'icon_life')
        .setScale(0.52).setDepth(104);
      this.livesGroup.add(icon);
    }
  }

  drawWeapon() {
    this.weaponPips.clear();
    for (let i = 0; i < PLAYER.maxWeapon; i++) {
      const on = i < this.weaponLevel;
      this.weaponPips.fillStyle(on ? 0x63f2ff : 0x233052, on ? 1 : 0.85);
      this.weaponPips.fillRect(56 + i * 14, VIEW.height - 65, 10, 6);
    }
  }

  updateHud(force = false) {
    this.scoreText.setText(formatScore(this.score));
    this.bestText.setText(`BEST ${formatScore(Math.max(this.best, this.score))}`);

    if (force || this.hudLives !== this.lives) {
      this.hudLives = this.lives;
      this.drawLives();
    }
    if (force || this.hudWeapon !== this.weaponLevel) {
      this.hudWeapon = this.weaponLevel;
      this.drawWeapon();
    }
    if (force || this.hudBombs !== this.bombs) {
      this.hudBombs = this.bombs;
      this.bombCountText.setText(`×${this.bombs}`);
      this.bombBtn.setAlpha(this.bombs > 0 ? 0.95 : 0.4);
    }
  }

  updateWaveHud() {
    const second = Math.floor(this.elapsed / 1000);
    if (second === this.lastSecond) return;
    this.lastSecond = second;
    this.timeText.setText(formatTime(this.elapsed));
    const wave = difficultyAt(this.elapsed / 1000, this.insane).wave;
    const label = `WAVE ${String(wave).padStart(2, '0')}`;
    this.waveText.setText(this.insane ? `${label} · 变态` : label);
  }

  updateLaserHud(time) {
    if (!this.laserText) return;
    if (this.player.alive && time < this.player.laserUntil) {
      const remain = ((this.player.laserUntil - time) / 1000).toFixed(1);
      const text = `激光 ${remain}s`;
      if (this.laserText.text !== text) this.laserText.setText(text);
    } else if (this.laserText.text !== '') {
      this.laserText.setText('');
    }
  }

  updateBossBar() {
    if (this.boss && this.boss.active) {
      this.bossBar.setVisible(true);
      this.bossLabel.setVisible(true);
      const pct = Phaser.Math.Clamp(this.boss.hp / this.boss.maxHp, 0, 1);
      this.bossBar.clear();
      this.bossBar.fillStyle(0x1c0a1e, 0.9);
      this.bossBar.fillRoundedRect(90, 112, 360, 10, 5);
      this.bossBar.fillStyle(0xff4d5e, 1);
      this.bossBar.fillRoundedRect(90, 112, 360 * pct, 10, 5);
      this.bossBar.lineStyle(1, 0xffcc66, 0.85);
      this.bossBar.strokeRoundedRect(90, 112, 360, 10, 5);
    } else if (this.bossBar.visible) {
      this.bossBar.setVisible(false);
      this.bossLabel.setVisible(false);
    }
  }

  showHint() {
    const line = this.game.device.input.touch
      ? '拖动屏幕移动战机 · 自动开火'
      : '方向键 / WASD 移动 · 自动开火';
    const hint = this.add.text(VIEW.width / 2, VIEW.height - 210, line, {
      fontFamily: FONT, fontSize: '15px', color: '#cfe2ff', stroke: '#050912', strokeThickness: 4
    }).setOrigin(0.5).setDepth(105).setAlpha(0.95);
    this.tweens.add({
      targets: hint, alpha: 0, y: hint.y - 26, delay: 2400, duration: 900,
      onComplete: () => hint.destroy()
    });
  }

  showBanner(title, color, sub = '') {
    const t = this.add.text(VIEW.width / 2, 430, title, {
      fontFamily: FONT, fontSize: '46px', fontStyle: 'bold', color,
      stroke: '#050912', strokeThickness: 8
    }).setOrigin(0.5).setDepth(150).setAlpha(0).setScale(0.82);

    let s = null;
    if (sub) {
      s = this.add.text(VIEW.width / 2, 478, sub, {
        fontFamily: FONT, fontSize: '16px', color: '#cfe2ff',
        stroke: '#050912', strokeThickness: 4
      }).setOrigin(0.5).setDepth(150).setAlpha(0);
    }

    this.tweens.add({
      targets: t, alpha: 1, scale: 1, duration: 220, ease: 'back.out'
    });
    if (s) this.tweens.add({ targets: s, alpha: 1, duration: 260 });

    this.time.delayedCall(1500, () => {
      this.tweens.add({
        targets: [t, s].filter(Boolean),
        alpha: 0, y: '-=24', duration: 500,
        onComplete: () => {
          t.destroy();
          if (s) s.destroy();
        }
      });
    });
  }

  muteLabel() {
    return sfx.muted ? '音效 关' : '音效 开';
  }

  toggleMute() {
    sfx.toggleMute();
    this.muteBtn.setText(this.muteLabel());
  }

  // ---------- 暂停 ----------

  togglePause() {
    if (this.over) return;
    this.paused = !this.paused;
    if (this.paused) {
      this.physics.pause();
      this.time.paused = true;
      this.tweens.pauseAll();
      this.anims.pauseAll();
      this.showPauseUI();
    } else {
      this.physics.resume();
      this.time.paused = false;
      this.tweens.resumeAll();
      this.anims.resumeAll();
      this.hidePauseUI();
    }
    sfx.play('ui');
  }

  showPauseUI() {
    const shade = this.add.rectangle(0, 0, VIEW.width, VIEW.height, 0x02030a, 0.8)
      .setOrigin(0).setDepth(200).setInteractive();
    const title = this.add.text(VIEW.width / 2, 350, '暂  停', {
      fontFamily: FONT, fontSize: '48px', fontStyle: 'bold', color: '#eafcff',
      stroke: '#07122e', strokeThickness: 8
    }).setOrigin(0.5).setDepth(201);
    const sub = this.add.text(VIEW.width / 2, 404, 'PAUSED', {
      fontFamily: FONT, fontSize: '15px', color: '#6ea8ff'
    }).setOrigin(0.5).setDepth(201);

    const resume = createButton(this, {
      x: VIEW.width / 2, y: 476, w: 240, h: 56, label: '继 续 游 戏', depth: 201,
      onClick: () => this.togglePause()
    });
    const restart = createButton(this, {
      x: VIEW.width / 2, y: 550, w: 240, h: 56, label: '重 新 开 始',
      color: COLORS.cyan, depth: 201, fontSize: 22,
      onClick: () => this.restartGame()
    });
    const quit = createButton(this, {
      x: VIEW.width / 2, y: 624, w: 240, h: 56, label: '返 回 标 题',
      color: COLORS.gold, depth: 201, fontSize: 22,
      onClick: () => this.returnToTitle()
    });

    this.pauseUI = [shade, title, sub, resume, restart, quit];
  }

  hidePauseUI() {
    this.pauseUI.forEach((obj) => obj.destroy());
    this.pauseUI = [];
  }

  restartGame() {
    this.physics.resume();
    this.time.paused = false;
    this.tweens.resumeAll();
    this.anims.resumeAll();
    sfx.play('start');
    this.scene.start(SCENE.BATTLE);
  }

  returnToTitle() {
    this.physics.resume();
    this.time.paused = false;
    this.tweens.resumeAll();
    this.anims.resumeAll();
    this.scene.start(SCENE.TITLE);
  }

  // ---------- 每帧 ----------

  update(time, delta) {
    if (this.inputSystem) {
      if (this.inputSystem.justPause()) this.togglePause();
      if (this.inputSystem.justMute()) this.toggleMute();
    }
    if (this.paused || this.over) return;

    const dt = delta / 1000;
    this.elapsed += delta;
    this.starsFar.tilePositionY -= 26 * dt;
    this.starsNear.tilePositionY -= 74 * dt;

    this.player.updateMovement(time, this.inputSystem);
    if (this.inputSystem.justBomb()) this.dropBomb();

    const diff = difficultyAt(this.elapsed / 1000, this.insane);
    this.speedMul = diff.speedMul;

    if (this.player.alive) {
      this.fireAcc += delta;
      if (this.fireAcc >= fireIntervalFor(this.weaponLevel)) {
        this.fireAcc = 0;
        this.shoot();
      }
    }

    this.spawnAcc += delta;
    const spawnInterval = diff.spawnInterval * (this.boss ? 1.7 : 1);
    if (this.spawnAcc >= spawnInterval) {
      this.spawnAcc = 0;
      this.spawnFormation(diff);
    }

    if (!this.boss && this.elapsed >= this.nextBossAt) {
      this.spawnBoss();
    }

    this.updateWaveHud();
    this.updateLaserHud(time);
    this.updateBossBar();
  }

  // ---------- 玩家射击 / 炸弹 ----------

  shoot() {
    if (this.player.hasLaser(this.time.now)) {
      this.shootLaser();
      return;
    }
    const spread = weaponSpread(this.weaponLevel);
    for (const shot of spread) {
      const x = this.player.x + shot.dx;
      const y = this.player.y - 30;
      const bullet = this.playerBullets.get(x, y);
      if (!bullet) continue;
      const rad = Phaser.Math.DegToRad(shot.angle);
      bullet.fire(
        x, y,
        Math.sin(rad) * PLAYER.bulletSpeed,
        -Math.cos(rad) * PLAYER.bulletSpeed,
        'bullet_player'
      );
    }
    sfx.play('shoot');
  }

  /** 激光弹：贯穿光束，弹道数随火力等级提升 */
  shootLaser() {
    const count = this.weaponLevel >= 5 ? 3 : this.weaponLevel >= 3 ? 2 : 1;
    const spacing = 30;
    const startX = this.player.x - ((count - 1) * spacing) / 2;
    const y = this.player.y - 130;
    for (let i = 0; i < count; i++) {
      const beam = this.playerBullets.get(startX + i * spacing, y);
      if (!beam) continue;
      beam.fire(startX + i * spacing, y, 0, -1250, 'laser_beam', 1, true);
    }
    sfx.play('laser');
  }

  dropBomb() {
    if (this.paused || this.over || !this.player.alive || this.bombs <= 0) return;
    this.bombs--;
    this.updateHud();
    sfx.play('bomb');
    this.cameras.main.flash(420, 220, 245, 255);
    this.cameras.main.shake(420, 0.016);
    this.shockwave(this.player.x, this.player.y);
    this.floatText(this.player.x, this.player.y - 70, 'BOMB!', '#ffd75e', 22);

    this.enemyBullets.getChildren().forEach((bullet) => {
      if (!bullet.active) return;
      this.spark(bullet.x, bullet.y, 0.45);
      bullet.disableBody(true, true);
    });

    this.enemies.getChildren().forEach((enemy) => {
      if (!enemy.active) return;
      if (enemy.enemyType === 'boss') enemy.hit(POWERUP.bombBossDamage);
      else enemy.hit(POWERUP.bombDamage);
    });

    this.player.invulnUntil = this.time.now + 900;
  }

  // ---------- 敌机 ----------

  spawnFormation(diff) {
    if (this.enemies.countActive(true) >= this.diffConfig.maxEnemies - 3) return;

    const roll = Math.random();
    const wave = diff.wave;

    if (roll < 0.42) {
      const type = pickWeighted(spawnWeights(wave));
      this.spawnEnemy(type, Phaser.Math.Between(50, VIEW.width - 50), -70, diff);
    } else if (roll < 0.72) {
      const cx = Phaser.Math.Between(110, VIEW.width - 110);
      for (let i = -1; i <= 1; i++) {
        this.spawnEnemy('scout', cx + i * 64, -70 - Math.abs(i) * 38, diff);
      }
    } else if (roll < 0.9) {
      const cx = Phaser.Math.Between(90, VIEW.width - 90);
      this.spawnEnemy('scout', cx - 34, -70, diff);
      this.spawnEnemy('scout', cx + 34, -104, diff);
      if (wave >= 3) this.spawnEnemy('striker', cx, -150, diff);
    } else {
      const type = wave >= 4 ? 'tank' : 'striker';
      this.spawnEnemy(type, Phaser.Math.Between(90, VIEW.width - 90), -90, diff);
    }
  }

  spawnEnemy(type, x, y, diff) {
    const enemy = this.enemies.get(x, y);
    if (!enemy) return null;
    enemy.spawn(type, x, y, { speedMul: diff.speedMul });
    return enemy;
  }

  spawnBoss() {
    const boss = this.enemies.get(VIEW.width / 2, -140);
    if (!boss) return;
    boss.spawn('boss', VIEW.width / 2, -140, { hp: bossHpFor(this.bossIndex, this.insane) });
    this.boss = boss;
    this.bossIndex++;
    this.showBanner('WARNING', '#ff5a5a', 'BOSS INCOMING');
    this.cameras.main.flash(260, 120, 10, 30);
    sfx.play('warning');
  }

  enemyAimedShot(enemy) {
    const p = this.player;
    if (!p.alive) return;
    const angle = Math.atan2(p.y - (enemy.y + 14), p.x - enemy.x);
    this.spawnEnemyBullet(
      enemy.x, enemy.y + 14, angle, 250 * this.speedMul, 'bullet_enemy', 0.9
    );
    sfx.play('enemyShoot');
  }

  enemyFanShot(enemy) {
    const p = this.player;
    if (!p.alive) return;
    const base = Math.atan2(p.y - (enemy.y + 18), p.x - enemy.x);
    [-0.36, -0.18, 0, 0.18, 0.36].forEach((offset) => {
      this.spawnEnemyBullet(
        enemy.x, enemy.y + 18, base + offset, 215 * this.speedMul, 'bullet_enemy', 0.9
      );
    });
    sfx.play('enemyShoot');
  }

  bossAttack(boss) {
    this.bossPattern = (this.bossPattern + 1) % 3;
    const p = this.player;

    if (this.bossPattern === 0) {
      for (let i = -4; i <= 4; i++) {
        this.spawnEnemyBullet(
          boss.x, boss.y + 58, Math.PI / 2 + i * 0.1,
          220 * this.speedMul, 'bullet_boss'
        );
      }
    } else if (this.bossPattern === 1) {
      const base = Math.atan2(p.y - boss.y, p.x - boss.x);
      [-0.14, 0, 0.14].forEach((offset) => {
        this.spawnEnemyBullet(
          boss.x, boss.y + 48, base + offset,
          305 * this.speedMul, 'bullet_boss'
        );
      });
    } else {
      for (let i = 0; i < 14; i++) {
        this.spawnEnemyBullet(
          boss.x, boss.y + 36, (i / 14) * Math.PI * 2,
          180 * this.speedMul, 'bullet_boss', 0.9
        );
      }
    }
    sfx.play('enemyShoot');
  }

  spawnEnemyBullet(x, y, angle, speed, texture, scale = 1) {
    const bullet = this.enemyBullets.get(x, y);
    if (!bullet) return;
    bullet.fire(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, texture, scale);
  }

  // ---------- 碰撞 ----------

  onPlayerBulletHitsEnemy(bullet, enemy) {
    if (!bullet.active || !enemy.active) return;
    if (bullet.pierce) {
      // 激光弹贯穿：同一目标只结算一次
      if (bullet.hits && bullet.hits.has(enemy)) return;
      if (bullet.hits) bullet.hits.add(enemy);
      this.spark(enemy.x, enemy.y + 8, 0.55);
      enemy.hit(3);
      return;
    }
    bullet.disableBody(true, true);
    this.spark(enemy.x, enemy.y + 8, 0.5);
    enemy.hit(1);
  }

  onPlayerHit(player, bullet) {
    if (this.over || !player.alive || !bullet.active) return;
    bullet.disableBody(true, true);
    const now = this.time.now;
    if (player.isInvulnerable(now)) return;
    if (player.hasShield(now)) {
      player.shieldUntil = 0;
      this.shieldBreak(player.x, player.y);
      sfx.play('hit');
      return;
    }
    this.damagePlayer();
  }

  onPlayerRamsEnemy(player, enemy) {
    if (this.over || !player.alive || !enemy.active) return;
    const now = this.time.now;
    if (player.isInvulnerable(now)) {
      if (enemy.enemyType !== 'boss') enemy.hit(999);
      return;
    }
    if (player.hasShield(now)) {
      player.shieldUntil = 0;
      if (enemy.enemyType !== 'boss') enemy.hit(999);
      this.shieldBreak(player.x, player.y);
      sfx.play('hit');
      return;
    }
    if (enemy.enemyType !== 'boss') enemy.hit(999);
    this.damagePlayer();
  }

  onCollectPowerup(player, powerup) {
    if (!powerup.active || !player.alive) return;
    const type = powerup.powerType;
    const x = powerup.x;
    const y = powerup.y;
    powerup.disableBody(true, true);
    this.spark(x, y, 1);

    if (type === 'power') {
      if (this.weaponLevel < PLAYER.maxWeapon) {
        this.weaponLevel++;
        this.floatText(x, y, '火力提升', '#63f2ff');
      } else {
        this.score += 300;
        this.floatText(x, y, '+300', '#63f2ff');
      }
    } else if (type === 'shield') {
      player.activateShield(this.time.now, PLAYER.shieldMs);
      this.floatText(x, y, '护盾展开', '#7ea8ff');
    } else if (type === 'laser') {
      player.activateLaser(this.time.now, PLAYER.laserMs);
      this.floatText(x, y, '激光武装', '#c084ff');
    } else {
      this.bombs = Math.min(PLAYER.maxBombs, this.bombs + 1);
      this.floatText(x, y, '炸弹 +1', '#ffd75e');
    }

    this.updateHud();
    sfx.play('powerup');
  }

  onEnemyDestroyed(enemy) {
    const type = enemy.enemyType;
    const cfg = ENEMY[type];
    const isBoss = type === 'boss';

    this.kills++;
    this.score += cfg.score;

    if (isBoss) {
      this.boss = null;
      this.bossBar.setVisible(false);
      this.bossLabel.setVisible(false);
      this.nextBossAt = this.elapsed + this.diffConfig.bossEvery * 1000;
      this.cameras.main.shake(620, 0.02);
      this.cameras.main.flash(340, 255, 210, 120);
      this.bigExplosion(enemy.x, enemy.y);
      sfx.play('bigExplode');
      for (let i = 0; i < 3; i++) {
        this.dropPowerupAt(enemy.x + (i - 1) * 56, enemy.y + 20);
      }
    } else {
      this.boom(enemy.x, enemy.y, type === 'tank' ? 1.2 : 0.72);
      sfx.play('explode');
      if (Math.random() < cfg.drop) this.dropPowerupAt(enemy.x, enemy.y);
    }

    this.floatText(
      enemy.x, enemy.y - 16,
      `+${cfg.score}`,
      isBoss ? '#ffd75e' : '#bfe8ff',
      isBoss ? 24 : 15
    );
    this.updateHud();
  }

  // ---------- 玩家受伤 / 结算 ----------

  damagePlayer() {
    if (this.over || !this.player.alive) return;

    this.lives--;
    this.weaponLevel = Math.max(1, this.weaponLevel - 1);
    this.updateHud();

    const x = this.player.x;
    const y = this.player.y;
    this.player.hide();
    this.boom(x, y, 1.5);
    this.cameras.main.shake(300, 0.015);
    this.cameras.main.flash(200, 255, 90, 90);
    sfx.play('hurt');

    if (this.lives <= 0) {
      this.over = true;
      this.showBanner('任务失败', '#ff5a5a', 'GAME OVER');
      this.time.delayedCall(1200, () => this.finishGame());
    } else {
      this.showBanner('战机损毁', '#ffb03a', `剩余 ${this.lives} 架`);
      this.time.delayedCall(PLAYER.respawnDelay, () => {
        if (!this.over && !this.player.alive) {
          this.player.reveal(
            VIEW.width / 2, VIEW.height - 150, this.time.now, PLAYER.invulnMs
          );
        }
      });
    }
  }

  finishGame() {
    const newBest = this.score > this.best;
    saveBest(Math.max(this.best, this.score));
    this.scene.start(SCENE.GAMEOVER, {
      score: this.score,
      kills: this.kills,
      time: this.elapsed,
      best: Math.max(this.best, this.score),
      newBest
    });
  }

  // ---------- 特效 ----------

  dropPowerupAt(x, y) {
    const powerup = this.powerups.get(x, Phaser.Math.Clamp(y, 120, VIEW.height - 160));
    if (!powerup) return;
    powerup.spawn(x, y, pickPowerup());
  }

  boom(x, y, scale = 1) {
    const explosion = this.add.sprite(x, y, 'explosion_0')
      .setDepth(30).setScale(scale).setBlendMode(Phaser.BlendModes.ADD);
    explosion.play('explode');
    explosion.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => explosion.destroy());
  }

  bigExplosion(x, y) {
    for (let i = 0; i < 6; i++) {
      this.time.delayedCall(i * 90, () => {
        this.boom(
          x + Phaser.Math.Between(-80, 80),
          y + Phaser.Math.Between(-60, 60),
          1.5 + Math.random() * 0.8
        );
      });
    }
  }

  spark(x, y, scale = 1) {
    const spark = this.add.image(x, y, 'spark')
      .setDepth(31).setScale(scale).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: spark, scale: scale * 1.9, alpha: 0,
      duration: 180, onComplete: () => spark.destroy()
    });
  }

  shieldBreak(x, y) {
    this.spark(x, y, 1.6);
    this.shockwave(x, y);
    this.cameras.main.shake(120, 0.008);
  }

  shockwave(x, y) {
    const wave = this.add.image(x, y, 'shockwave')
      .setDepth(32).setScale(0.25).setAlpha(0.95)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: wave, scale: 3.2, alpha: 0,
      duration: 520, ease: 'cubic.out', onComplete: () => wave.destroy()
    });
  }

  floatText(x, y, text, color, size = 15) {
    const label = this.add.text(x, y, text, {
      fontFamily: FONT, fontSize: `${size}px`, fontStyle: 'bold', color,
      stroke: '#050912', strokeThickness: 3
    }).setOrigin(0.5).setDepth(120);
    this.tweens.add({
      targets: label, y: y - 46, alpha: 0,
      duration: 720, ease: 'cubic.out',
      onComplete: () => label.destroy()
    });
  }
}
