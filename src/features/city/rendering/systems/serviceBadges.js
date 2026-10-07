import { SpriteManager } from '@babylonjs/core/Sprites/spriteManager.js';
import { Sprite } from '@babylonjs/core/Sprites/sprite.js';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { assetById } from '../../presets/catalog.js';
import { objectBaseHeight } from '../../plots/plotModel.js';
import { calculateUtilityService } from '../../simulation/utilityService.js';
import { serviceBadgeRecords } from '../../simulation/serviceBadges.js';

function badgeManager(scene) {
  const texture = new DynamicTexture('service-badge-atlas', { width: 1024, height: 128 }, scene, false);
  const ctx = texture.getContext();
  ctx.clearRect(0, 0, 1024, 128);
  for (let i = 0; i < 6; i++) {
    ctx.save(); ctx.translate(i * 128, 0);
    const power = i < 2 || i >= 4, connected = i === 0 || i === 2;
    const statusColor = i === 4 ? '#ffdf7e' : i === 5 ? '#b9c6d0' : connected ? '#7ee5a5' : '#ff9685';
    ctx.fillStyle = '#18342f'; ctx.beginPath(); ctx.roundRect(8, 12, 112, 100, 22); ctx.fill();
    ctx.strokeStyle = statusColor; ctx.lineWidth = 5; ctx.stroke();
    ctx.fillStyle = power ? '#ffe08a' : '#87deed'; ctx.beginPath();
    if (power) { ctx.moveTo(48, 30); ctx.lineTo(27, 65); ctx.lineTo(44, 65); ctx.lineTo(39, 91); ctx.lineTo(64, 54); ctx.lineTo(48, 54); }
    else { ctx.moveTo(43, 31); ctx.bezierCurveTo(13, 65, 25, 89, 43, 89); ctx.bezierCurveTo(63, 89, 75, 65, 43, 31); }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = statusColor; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
    if (connected) { ctx.moveTo(76, 62); ctx.lineTo(86, 73); ctx.lineTo(104, 49); }
    else { ctx.moveTo(91, 42); ctx.lineTo(91, 68); }
    ctx.stroke();
    if (!connected) { ctx.fillStyle = statusColor; ctx.beginPath(); ctx.arc(91, 83, 4.5, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
  // Sprite sheets use a top-left origin, matching the canvas cell order.
  texture.hasAlpha = true; texture.update(false);
  const manager = new SpriteManager('service-status-badges', '', 10000, 128, scene);
  manager.texture = texture; manager.isPickable = false; manager.disableDepthWrite = true;
  return manager;
}

export const serviceBadges = {
  setServiceBadgeOptions(options) {
    this.serviceBadgeOptions = { ...options };
    this.updateServiceBadges();
  },
  updateServiceBadges() {
    const options = this.serviceBadgeOptions;
    if (!this.city || !options || !options.power && !options.water) { this.clearServiceBadges(); return; }
    const service = this.getUtilityService?.() || calculateUtilityService(this.city);
    const records = serviceBadgeRecords(service, options);
    if (!records.length) { this.clearServiceBadges(); return; }
    if (!this.serviceBadgeManager) {
      this.serviceBadgeManager = (this.createServiceBadgeManager || badgeManager)(this.scene);
      this.serviceBadgeObserver = this.scene.onBeforeRenderObservable.add(() => this.positionServiceBadges());
    }
    const manager = this.serviceBadgeManager;
    const objects = new Map(this.city.objects.map(o => [o.id, o]));
    const markedIds = new Set(records.map(record => record.id));
    const roofs = new Map(this.nodes.filter(node => markedIds.has(node.name)).map(node => [node.name, node.getHierarchyBoundingVectors().max.y]));
    const previous = this.serviceBadgeSprites || new Map(), next = new Map();
    for (const record of records) {
      const key = `${record.id}:${record.kind}`, object = objects.get(record.id);
      const sprite = previous.get(key) || new Sprite(key, manager);
      sprite.cellIndex = record.status === 'shortage' ? 4 : record.status === 'unset' ? 5 : (record.kind === 'power' ? 0 : 2) + (record.connected ? 0 : 1);
      sprite.isPickable = false;
      sprite.badgeAnchor = { x: object.x, z: object.z, roof: roofs.get(record.id) ?? objectBaseHeight(this.city, object) + assetById[object.asset].height, kind: record.kind };
      next.set(key, sprite);
    }
    for (const [key, sprite] of previous) if (!next.has(key)) sprite.dispose();
    this.serviceBadgeSprites = next;
    this.serviceBadgeSize = null;
    this.positionServiceBadges();
  },
  positionServiceBadges() {
    // One atlas batches all icons. Update positions only when zoom changes;
    // no DOM labels, picking, per-frame graph traversal or individual textures.
    const size = Math.max(2, Math.min(16, (this.camera?.radius || 205) / 35));
    const alpha = this.camera?.alpha || 0;
    if (Math.abs(size - (this.serviceBadgeSize || 0)) < 0.03 && Math.abs(alpha - (this.serviceBadgeAlpha ?? Infinity)) < 0.001) return;
    this.serviceBadgeSize = size;
    this.serviceBadgeAlpha = alpha;
    const both = this.serviceBadgeOptions.power && this.serviceBadgeOptions.water;
    for (const sprite of this.serviceBadgeSprites.values()) {
      const anchor = sprite.badgeAnchor;
      sprite.width = size; sprite.height = size;
      const offset = both ? size * (anchor.kind === 'power' ? -0.58 : 0.58) : 0;
      sprite.position = new Vector3(anchor.x + Math.sin(alpha) * offset, anchor.roof + size * 0.85, anchor.z - Math.cos(alpha) * offset);
    }
  },
  clearServiceBadges() {
    if (this.serviceBadgeObserver) this.scene.onBeforeRenderObservable.remove(this.serviceBadgeObserver);
    this.serviceBadgeObserver = null;
    this.serviceBadgeManager?.dispose(); this.serviceBadgeManager = null;
    this.serviceBadgeSprites = new Map(); this.serviceBadgeSize = null;
  },
};
