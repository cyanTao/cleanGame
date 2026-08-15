// ===== 机甲实体：状态机 + Arcade 物理体 + 姿态控制 =====
import Phaser from 'phaser';
import { PHYSICS, COMBAT } from '../config.js';
import { SPRITE_SCALE } from '../data/sprites.js';

export class Mecha extends Phaser.Physics.Arcade.Sprite {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x 出生 x
   * @param {number} facing 初始面向（1 右 / -1 左）
   * @param {string} paletteKey 调色板/纹理前缀（blu/red）
   * @param {Object} stats { hp, speed, damage, specialDamage }
   */
  constructor(scene, x, facing, paletteKey, stats) {
    super(scene, x, 0, `${paletteKey}_idle`);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.paletteKey = paletteKey;
    this.stats = stats;
    this.facing = facing;

    // 物理体：16×20 像素 ×4 = 64×80，实际碰撞盒略窄
    this.setOrigin(0.5, 1);
    this.body.setSize(14, 19);
    this.body.setOffset(1, 1);
    this.setCollideWorldBounds(true);
    this.setScale(SPRITE_SCALE);
    this.setDepth(10);

    this.maxHp = stats.hp;
    this.hp = stats.hp;
    this.energy = 0;

    // 状态机：idle | walk | jump | attack | special | defend | hit | dead
    this.state = 'idle';
    this.stateTime = 0;      // 当前状态已持续 ms
    this.attackPhase = null; // windup | active | recover
    this.hitLanded = false;  // 本次攻击是否已结算命中
    this.walkFrame = 0;
    this.walkTimer = 0;
    this.locked = false;     // 回合控制锁（开场/结算）
    this.hitFlash = 0;

    this.setFrameTo('idle');
    this.resetToGround();
  }

  resetToGround() {
    this.setY(this.scene.groundY);
    this.setVelocity(0, 0);
  }

  get isAttacking() { return this.state === 'attack'; }
  get isChargingSpecial() { return this.state === 'special'; }
  get isDead() { return this.state === 'dead'; }
  get isDefending() { return this.state === 'defend'; }
  get isAirborne() { return !this.body.blocked.down && !this.body.touching.down; }

  /** 切换姿态纹理（单帧姿态，非 Phaser 动画） */
  setFrameTo(pose) {
    const key = `${this.paletteKey}_${pose}`;
    if (this.scene.textures.exists(key)) this.setTexture(key);
  }

  /** 面向目标（攻击/受击/死亡时锁定） */
  faceToward(targetX) {
    if (this.isAttacking || this.isChargingSpecial || this.isDefending || this.isDead) return;
    this.facing = targetX >= this.x ? 1 : -1;
    this.setFlipX(this.facing === -1);
  }

  /**
   * 每帧逻辑（由 BattleScene 手动调用；不能叫 update，避免与 Phaser 自动调用冲突）
   * @param {number} dt 帧间隔 ms
   * @param {{left,right,jump,attack,defend,special}} input 统一输入接口
   */
  tick(dt, input) {
    this.stateTime += dt;
    this.syncFlip();
    this.tickFlash(dt);

    if (this.isDead) { this.setVelocityX(0); return; }
    if (this.locked) { this.setVelocityX(0); return; }

    switch (this.state) {
      case 'attack':
      case 'special':
        this.updateAttack(dt);
        break;
      case 'hit':
        this.setVelocityX(0);
        if (this.stateTime >= COMBAT.hitstun) this.enter('idle');
        break;
      default:
        this.updateFree(dt, input);
        break;
    }
    this.clampEnergy();
  }

  syncFlip() {
    if (!this.isDead) this.setFlipX(this.facing === -1);
  }

  tickFlash(dt) {
    if (this.hitFlash > 0) {
      this.hitFlash -= dt;
      if (this.hitFlash <= 0) this.clearTint();
    }
  }

  clampEnergy() {
    this.energy = Phaser.Math.Clamp(this.energy, 0, COMBAT.energyMax);
  }

  /** 自由态：移动 / 跳 / 攻击 / 防御 */
  updateFree(dt, input) {
    if (!input) { this.setVelocityX(0); this.enterIdleIfWalk(); return; }

    // 落地回到待机
    if (this.state === 'jump' && !this.isAirborne) this.enter('idle');

    // 防御（优先，按住）
    if (input.defend && !this.isAirborne) {
      this.enter('defend');
      this.setVelocityX(0);
      return;
    }
    if (this.isDefending) this.enter('idle');

    // 攻击
    if (input.attack && !this.isAirborne) { this.startAttack('attack'); return; }
    if (input.special && !this.isAirborne && this.energy >= COMBAT.energyMax) {
      this.startAttack('special');
      this.energy = 0;
      return;
    }

    // 跳跃
    if (input.jump && !this.isAirborne) {
      this.setVelocityY(-PHYSICS.jumpVelocity);
      this.enter('jump');
    }

    // 水平移动
    const speed = this.isAirborne ? this.stats.speed : this.stats.speed;
    if (input.left) { this.setVelocityX(-speed); if (!this.isAirborne) this.enter('walk'); }
    else if (input.right) { this.setVelocityX(speed); if (!this.isAirborne) this.enter('walk'); }
    else { this.setVelocityX(0); this.enterIdleIfWalk(); }

    // 行走帧动画（140ms 切换）
    if (this.state === 'walk' && !this.isAirborne) {
      this.walkTimer += dt;
      if (this.walkTimer >= 140) {
        this.walkTimer = 0;
        this.walkFrame = 1 - this.walkFrame;
        this.setFrameTo(this.walkFrame === 0 ? 'walkA' : 'walkB');
      }
    }

    // 空中姿态
    if (this.isAirborne) this.setFrameTo('jump');
  }

  enterIdleIfWalk() {
    if (this.state === 'walk') this.enter('idle');
  }

  enter(state) {
    if (this.state === state) return;
    this.state = state;
    this.stateTime = 0;
    switch (state) {
      case 'idle': this.setFrameTo('idle'); break;
      case 'walk':
        this.walkFrame = 0;
        this.walkTimer = 0;
        this.setFrameTo('walkA');
        break;
      case 'jump': this.setFrameTo('jump'); break;
      case 'defend': this.setFrameTo('defend'); break;
      case 'hit': this.setFrameTo('hit'); break;
      case 'dead': this.setFrameTo('dead'); break;
      default: break;
    }
  }

  startAttack(kind) {
    this.enter(kind); // attack | special
    this.attackPhase = 'windup';
    this.stateTime = 0;
    this.hitLanded = false;
    this.setVelocityX(0);
    this.setFrameTo(kind === 'special' ? 'attackA' : 'attackA');
  }

  /** 攻击三段：windup → active → recover */
  updateAttack(dt) {
    const c = this.state === 'special'
      ? { w: COMBAT.specialWindup, a: COMBAT.specialActive, r: COMBAT.specialRecover }
      : { w: COMBAT.attackWindup, a: COMBAT.attackActive, r: COMBAT.attackRecover };
    const t = this.stateTime;
    if (this.attackPhase === 'windup') {
      if (t >= c.w) { this.attackPhase = 'active'; this.stateTime = 0; this.setFrameTo('attackB'); }
    } else if (this.attackPhase === 'active') {
      if (t >= c.a) { this.attackPhase = 'recover'; this.stateTime = 0; this.setFrameTo('attackA'); }
    } else {
      if (t >= c.r) { this.attackPhase = null; this.enter('idle'); }
    }
  }

  /** 当前是否处于命中判定窗 */
  get isActiveWindow() {
    return (this.state === 'attack' || this.state === 'special') && this.attackPhase === 'active';
  }

  /** 攻击判定矩形（世界坐标） */
  getAttackBox() {
    const isSpecial = this.state === 'special';
    const size = isSpecial ? COMBAT.specialHitboxSize : COMBAT.hitboxSize;
    const cx = this.x + this.facing * COMBAT.hitboxOffset;
    return new Phaser.Geom.Rectangle(
      cx - size.w / 2,
      this.y - size.h,  // origin 0.5,1 → this.y 为脚底
      size.w,
      size.h
    );
  }

  /** 本体碰撞矩形（世界坐标） */
  getBodyBox() {
    return new Phaser.Geom.Rectangle(this.x - 28, this.y - 76, 56, 76);
  }

  /**
   * 受击结算（由 BattleScene 调用，伤害先经 resolveHit 计算）
   */
  applyHit(damage, fromDir, blocked, isSpecial) {
    if (this.isDead) return;
    this.hp = Math.max(0, this.hp - damage);
    this.hitFlash = 120;
    this.setTintFill(0xffffff);

    if (this.hp <= 0) {
      this.enter('dead');
      this.setVelocity(0, 0);
      return;
    }

    const kb = isSpecial ? COMBAT.specialKnockback : COMBAT.knockback;
    const reduce = blocked ? 0.4 : 1;
    this.setVelocityX(fromDir * kb * reduce);
    this.enter('hit');
  }
}
