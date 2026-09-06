import * as THREE from 'three';
import { World } from '../src/game/World.js';
import { EnemySystem } from '../src/game/Enemies.js';

// World uses canvas only to create sprite textures. A tiny DOM facade lets this
// geometry test run in Node without pretending to render WebGL.
const gradient = { addColorStop() {} };
globalThis.document = {
  createElement(tag) {
    if (tag !== 'canvas') return {};
    return {
      width: 0,
      height: 0,
      getContext() {
        return {
          createRadialGradient: () => gradient,
          fillStyle: '',
          fillRect() {},
        };
      },
    };
  },
};

const world = new World(new THREE.Scene());
const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};
const rectDistance = (x, z, platform) => {
  const dx = Math.max(0, Math.abs(x - platform.x) - platform.width / 2);
  const dz = Math.max(0, Math.abs(z - platform.z) - platform.depth / 2);
  return Math.hypot(dx, dz);
};
const pointSegmentDistance = (x, z, start, end) => {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lengthSq = dx * dx + dz * dz;
  const progress = lengthSq ? Math.max(0, Math.min(1, ((x - start.x) * dx + (z - start.z) * dz) / lengthSq)) : 0;
  return Math.hypot(x - (start.x + dx * progress), z - (start.z + dz * progress));
};
const orientation = (a, b, c) => Math.sign((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x));
const segmentsIntersect = (a, b, c, d) => {
  const abC = orientation(a, b, c);
  const abD = orientation(a, b, d);
  const cdA = orientation(c, d, a);
  const cdB = orientation(c, d, b);
  return abC === 0 || abD === 0 || cdA === 0 || cdB === 0 ? false : abC !== abD && cdA !== cdB;
};
const segmentRectDistance = (start, end, platform) => {
  if (rectDistance(start.x, start.z, platform) === 0 || rectDistance(end.x, end.z, platform) === 0) return 0;
  const left = platform.x - platform.width / 2;
  const right = platform.x + platform.width / 2;
  const north = platform.z - platform.depth / 2;
  const south = platform.z + platform.depth / 2;
  const corners = [{ x: left, z: north }, { x: right, z: north }, { x: right, z: south }, { x: left, z: south }];
  const edges = corners.map((corner, index) => [corner, corners[(index + 1) % corners.length]]);
  if (edges.some(([edgeStart, edgeEnd]) => segmentsIntersect(start, end, edgeStart, edgeEnd))) return 0;
  return Math.min(rectDistance(start.x, start.z, platform), rectDistance(end.x, end.z, platform), ...corners.map((corner) => pointSegmentDistance(corner.x, corner.z, start, end)));
};

check(world.platforms.length === 26, `Expected 26 platforms, found ${world.platforms.length}.`);
check(world.platformById.size === world.platforms.length, 'Platform IDs are missing or duplicated.');
const spawn = world.getPlatformPoint('roots', 0, .2, .03);
check(Math.abs(world.getLandingHeight(spawn.x, spawn.z, spawn.y) - world.getPlatform('roots').top) < .01, 'The player spawn has no solid platform below it.');
for (let first = 0; first < world.platforms.length; first += 1) {
  const a = world.platforms[first];
  check(Boolean(a.id), `Platform at index ${first} has no ID.`);
  for (let second = first + 1; second < world.platforms.length; second += 1) {
    const b = world.platforms[second];
    const overlapX = Math.abs(a.x - b.x) < (a.width + b.width) / 2;
    const overlapZ = Math.abs(a.z - b.z) < (a.depth + b.depth) / 2;
    check(!(overlapX && overlapZ), `Overlapping platforms: ${a.id} and ${b.id}.`);
  }
}

check(world.walkways.length === world.mainRouteIds.length + 2, 'A main-route or side-route gap has no physical walkway.');
for (let index = 0; index < world.walkways.length; index += 1) {
  const walkway = world.walkways[index];
  const from = world.getPlatform(walkway.fromId);
  const to = world.getPlatform(walkway.toId);
  const length = walkway.start.distanceTo(walkway.end);
  check(length > .5, `Walkway ${index + 1} is too short to cover a gap.`);
  check(rectDistance(walkway.start.x, walkway.start.z, from) < .02, `Walkway ${index + 1} does not start on ${from.id}.`);
  check(rectDistance(walkway.end.x, walkway.end.z, to) < .02, `Walkway ${index + 1} does not end on ${to.id}.`);
  check(Math.abs(walkway.start.y - from.top) < .001 && Math.abs(walkway.end.y - to.top) < .001, `Walkway ${index + 1} has an invalid landing height.`);
}
for (let index = 0; index < world.mainRouteIds.length - 1; index += 1) {
  const expectedFrom = world.mainRouteIds[index];
  const expectedTo = world.mainRouteIds[index + 1];
  check(world.walkways.some((walkway) => walkway.fromId === expectedFrom && walkway.toId === expectedTo), `Missing main walkway: ${expectedFrom} → ${expectedTo}.`);
}
for (const walkway of world.walkways) {
  for (const platform of world.platforms) {
    if (platform.id === walkway.fromId || platform.id === walkway.toId) continue;
    const clearance = segmentRectDistance(walkway.start, walkway.end, platform) - walkway.radius;
    check(clearance >= .35, `${walkway.name} cuts through ${platform.id} (${clearance.toFixed(2)}).`);
  }
  const midpoint = walkway.start.clone().lerp(walkway.end, .5);
  const landingHeight = world.getLandingHeight(midpoint.x, midpoint.z, midpoint.y + 1);
  check(Math.abs(landingHeight - midpoint.y) < .01, `${walkway.name} has no collision surface at its center.`);
}

for (const thermal of world.thermals) {
  for (const platform of world.platforms) {
    const clearance = rectDistance(thermal.x, thermal.z, platform) - thermal.radius;
    check(clearance >= .5, `Thermal ${thermal.id} is only ${clearance.toFixed(2)} from ${platform.id}.`);
  }
  for (const walkway of world.walkways) {
    const clearance = pointSegmentDistance(thermal.x, thermal.z, walkway.start, walkway.end) - thermal.radius - walkway.radius;
    check(clearance >= .5, `Thermal ${thermal.id} overlaps ${walkway.name} (${clearance.toFixed(2)}).`);
  }
}
for (const vine of world.climbingVines) {
  for (const platform of world.platforms) {
    const clearance = rectDistance(vine.x, vine.z, platform) - vine.radius;
    check(clearance >= .5, `${vine.name} is only ${clearance.toFixed(2)} from ${platform.id}.`);
  }
  for (const thermal of world.thermals) {
    const clearance = Math.hypot(vine.x - thermal.x, vine.z - thermal.z) - vine.radius - thermal.radius;
    check(clearance >= .5, `${vine.name} overlaps thermal ${thermal.id} (${clearance.toFixed(2)}).`);
  }
  for (const walkway of world.walkways) {
    const clearance = pointSegmentDistance(vine.x, vine.z, walkway.start, walkway.end) - vine.radius - walkway.radius;
    check(clearance >= .35, `${vine.name} overlaps ${walkway.name} (${clearance.toFixed(2)}).`);
  }
  check(vine.top > vine.bottom, `${vine.name} has no climbable height.`);
}
const solidTrees = world.climbables.filter((entry) => entry.solid);
for (const tree of solidTrees) {
  for (const platform of world.platforms) {
    const clearance = rectDistance(tree.x, tree.z, platform) - tree.radius;
    check(clearance >= .65, `Tree trunk is too close to ${platform.id} (${clearance.toFixed(2)}).`);
  }
  for (const thermal of world.thermals) {
    const clearance = Math.hypot(tree.x - thermal.x, tree.z - thermal.z) - tree.radius - thermal.radius;
    check(clearance >= .5, `Tree trunk overlaps thermal ${thermal.id} (${clearance.toFixed(2)}).`);
  }
  for (const walkway of world.walkways) {
    const clearance = pointSegmentDistance(tree.x, tree.z, walkway.start, walkway.end) - tree.radius - walkway.radius;
    check(clearance >= .5, `Tree trunk overlaps ${walkway.name} (${clearance.toFixed(2)}).`);
  }
}
for (let index = 0; index < solidTrees.length; index += 1) {
  for (let other = index + 1; other < solidTrees.length; other += 1) {
    const a = solidTrees[index];
    const b = solidTrees[other];
    const clearance = Math.hypot(a.x - b.x, a.z - b.z) - a.radius - b.radius;
    check(clearance >= .5, `Tree trunks overlap (${clearance.toFixed(2)}).`);
  }
}
for (const tree of solidTrees) {
  for (const platform of world.platforms) {
    const platformBottom = platform.top - platform.baseHeight;
    const verticalOverlap = platform.top >= tree.canopyBottom && platformBottom <= tree.canopyTop;
    if (!verticalOverlap) continue;
    const clearance = rectDistance(tree.x, tree.z, platform) - tree.canopyRadius;
    check(clearance >= .5, `Tree canopy crosses ${platform.id} (${clearance.toFixed(2)}).`);
  }
}

// El altar es una estructura sólida de radio 5.7 y también necesita su propio claro.
for (const platform of world.platforms) {
  const clearance = rectDistance(0, 15, platform) - 5.7;
  check(clearance >= .5, `${platform.id} overlaps the altar clearing (${clearance.toFixed(2)}).`);
}

for (const seed of world.collectibles) {
  const platform = world.getPlatform(seed.platform);
  check(rectDistance(seed.x, seed.z, platform) === 0, `${seed.id} is not above ${seed.platform}.`);
  check(seed.y > platform.top, `${seed.id} is not above its platform surface.`);
  check(seed.checkpoint.y >= platform.top, `${seed.id} checkpoint is below its platform.`);
}
for (const fruit of world.fruits) {
  const platform = world.getPlatform(fruit.platformId);
  check(rectDistance(fruit.position.x, fruit.position.z, platform) === 0, 'A fruit is outside its platform.');
  check(fruit.position.y > platform.top, 'A fruit is below its platform surface.');
}
for (const pack of world.ammoPacks) {
  const platform = world.getPlatform(pack.platformId);
  check(rectDistance(pack.position.x, pack.position.z, platform) === 0, 'An ammo pack is outside its platform.');
  check(pack.position.y > platform.top, 'An ammo pack is below its platform surface.');
}

const enemies = new EnemySystem(new THREE.Scene(), world);
for (const enemy of enemies.enemies) {
  check(rectDistance(enemy.position.x, enemy.position.z, enemy.platform) === 0, `${enemy.type} is not on its platform.`);
  check(Math.abs(enemy.position.y - (enemy.platform.top + .02)) < .001, `${enemy.type} has incorrect ground height.`);
}
const placedObjects = [
  ...world.collectibles.map((seed) => ({ label: seed.title, platformId: seed.platform, position: seed.group.position, radius: 1.0 })),
  ...world.fruits.map((fruit) => ({ label: 'Fruit', platformId: fruit.platformId, position: fruit.position, radius: .42 })),
  ...world.ammoPacks.map((pack) => ({ label: 'Small-acorn pack', platformId: pack.platformId, position: pack.position, radius: .58 })),
  ...enemies.enemies.map((enemy) => ({ label: `${enemy.type} raccoon`, platformId: enemy.platform.id, position: enemy.position, radius: enemy.type === 'heavy' ? .88 : .72 })),
];
for (let index = 0; index < placedObjects.length; index += 1) {
  for (let other = index + 1; other < placedObjects.length; other += 1) {
    const a = placedObjects[index];
    const b = placedObjects[other];
    if (a.platformId !== b.platformId) continue;
    const clearance = Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z) - a.radius - b.radius;
    check(clearance >= .18, `${a.label} overlaps ${b.label} on ${a.platformId} (${clearance.toFixed(2)}).`);
  }
}
check(enemies.boss.position.distanceTo(world.getPlatformPoint('fortress', 0, -1.35, .02)) < .001, 'Boss is not anchored to the fortress platform.');

if (failures.length) {
  console.error('Layout validation failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Layout valid: ${world.platforms.length} platforms, ${world.walkways.length} physical walkways, ${world.climbingVines.length} climbing vines, ${world.thermals.length} thermals, ${enemies.enemies.length} grounded enemies.`);
