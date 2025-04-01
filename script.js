const mapWidth = 15000;
const mapHeight = 15000;
const spotSize = 50;
const minDistance = 70;
const troopSpeed = 300;

let resources = { wood: 0, stone: 0, gold: 0 };
const troops = { infantry: 0, archer: 0, cavalry: 0 };
let questSetNumber = 1;
let quests = [];
let spots = [];
let marchTimer = null;

const resourceDisplay = {
  wood: document.getElementById('wood'),
  stone: document.getElementById('stone'),
  gold: document.getElementById('gold')
};
const troopDisplay = {
  infantry: document.getElementById('infantryCount'),
  archer: document.getElementById('archerCount'),
  cavalry: document.getElementById('cavalryCount')
};
const battleLog = document.getElementById('battleLog');
const toggleLogBtn = document.getElementById('toggleLog');
const logContent = document.getElementById('battleLog');
const questListEl = document.getElementById('questList');

// === KONVA INIT ===
const stage = new Konva.Stage({
  container: 'gameContainer',
  width: window.innerWidth,
  height: window.innerHeight,
  draggable: true
});
const layer = new Konva.Layer();
stage.add(layer);

// --- ZOOM ---
const scaleBy = 1.05;
stage.on('wheel', e => {
  e.evt.preventDefault();
  const oldScale = stage.scaleX();
  const pointer = stage.getPointerPosition();
  const mousePointTo = {
    x: (pointer.x - stage.x()) / oldScale,
    y: (pointer.y - stage.y()) / oldScale
  };
  const direction = e.evt.deltaY > 0 ? 1 : -1;
  const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
  stage.scale({ x: newScale, y: newScale });
  const newPos = {
    x: pointer.x - mousePointTo.x * newScale,
    y: pointer.y - mousePointTo.y * newScale
  };
  stage.position(newPos);
  stage.batchDraw();
});

// --- PINCH ---
let lastDist = 0;
stage.on('touchmove', e => {
  e.evt.preventDefault();
  const touch1 = e.evt.touches[0];
  const touch2 = e.evt.touches[1];
  if (touch1 && touch2) {
    const dist = getDistance(
      { x: touch1.clientX, y: touch1.clientY },
      { x: touch2.clientX, y: touch2.clientY }
    );
    if (!lastDist) lastDist = dist;
    const scale = stage.scaleX() * (dist / lastDist);
    stage.scale({ x: scale, y: scale });
    lastDist = dist;
  }
});
stage.on('touchend', () => { lastDist = 0; });
function getDistance(p1, p2) {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

// --- Generate Map ---
function generateSpots(count) {
  let attempts = 0;
  while (spots.length < count && attempts < count * 10) {
    attempts++;
    const newSpot = {
      x: Math.random() * mapWidth,
      y: Math.random() * mapHeight,
      type: ['wood', 'stone', 'gold', 'monster'][Math.floor(Math.random() * 4)],
      level: Math.floor(Math.random() * 30) + 1,
      collected: false
    };
    if (isValidPosition(newSpot)) {
      spots.push(newSpot);
      addSpotToLayer(newSpot);
    }
  }
}

function isValidPosition(spot) {
  return !spots.some(existing => {
    const dx = existing.x - spot.x;
    const dy = existing.y - spot.y;
    return Math.sqrt(dx * dx + dy * dy) < minDistance;
  });
}

function addSpotToLayer(spot) {
  const rect = new Konva.Rect({
    x: spot.x,
    y: spot.y,
    width: spotSize,
    height: spotSize,
    fill: spot.type === 'monster' ? 'red' : spot.type === 'wood' ? 'green' : spot.type === 'stone' ? 'gray' : 'yellow',
    stroke: 'black',
    strokeWidth: 1
  });
  rect.on('click tap', () => handleSpotClick(spot, rect));
  layer.add(rect);
  layer.batchDraw();
}

function handleSpotClick(spot, rect) {
  if (spot.collected) return;
  if (spot.type === 'monster') {
    if (!marchTimer) startMarch(spot);
  } else {
    collectResource(spot, rect);
  }
}

function collectResource(spot, rect) {
  resources[spot.type]++;
  resourceDisplay[spot.type].textContent = resources[spot.type];
  spot.collected = true;
  rect.destroy();
  setTimeout(() => {
    const index = spots.indexOf(spot);
    if (index !== -1) spots.splice(index, 1);
    respawnSpot();
  }, 30000);
  updateQuestProgress('resource', spot.type);
}

function respawnSpot() {
  let newSpot;
  let tries = 0;
  do {
    tries++;
    newSpot = {
      x: Math.random() * mapWidth,
      y: Math.random() * mapHeight,
      type: ['wood', 'stone', 'gold', 'monster'][Math.floor(Math.random() * 4)],
      level: Math.floor(Math.random() * 30) + 1,
      collected: false
    };
  } while (!isValidPosition(newSpot) && tries < 100);

  if (tries < 100) {
    spots.push(newSpot);
    addSpotToLayer(newSpot);
  }
}

function startMarch(target) {
  if (totalTroops() === 0) {
    alert('No troops! Build troops first!');
    return;
  }
  const start = stage.getAbsolutePosition();
  const startX = -start.x / stage.scaleX() + window.innerWidth / 2 / stage.scaleX();
  const startY = -start.y / stage.scaleY() + window.innerHeight / 2 / stage.scaleY();
  const travelTime = calculateTravelTime(startX, startY, target.x, target.y);
  logBattle(`🚶‍♂️ Troops marching to Lvl ${target.level} monster. ETA: ${travelTime}s`);
  let remainingTime = travelTime;
  marchTimer = setInterval(() => {
    remainingTime--;
    if (remainingTime <= 0) {
      clearInterval(marchTimer);
      marchTimer = null;
      engageBattle(target);
    } else {
      logBattle(`⏳ Arriving in ${remainingTime}s...`);
    }
  }, 1000);
}

function calculateTravelTime(sx, sy, tx, ty) {
  const dx = tx - sx;
  const dy = ty - sy;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return Math.ceil(distance / troopSpeed);
}

function engageBattle(monster) {
  if (monster.collected) {
    logBattle(`⚠️ Monster Lvl ${monster.level} already defeated.`);
    return;
  }
  const monsterPower = monster.level * 5;
  const playerPower = troops.infantry * 3 + troops.archer * 4 + troops.cavalry * 6;
  if (playerPower >= monsterPower) {
    let goldReward = 0;
    let resourceBonus = { wood: 0, stone: 0, gold: 0 };
    if (monster.level <= 4) goldReward = randomInt(1, 2);
    else if (monster.level <= 10) {
      goldReward = randomInt(2, 6);
      resourceBonus = { wood: 1, stone: 1, gold: 1 };
    } else if (monster.level <= 18) goldReward = randomInt(5, 13);
    else if (monster.level <= 20) {
      goldReward = randomInt(5, 13);
      resourceBonus = { wood: 3, stone: 3, gold: 3 };
    } else {
      goldReward = randomInt(10, 20);
      resourceBonus = { wood: 5, stone: 5, gold: 5 };
    }
    resources.gold += goldReward;
    resourceDisplay.gold.textContent = resources.gold;
    Object.keys(resourceBonus).forEach(key => {
      resources[key] += resourceBonus[key];
      resourceDisplay[key].textContent = resources[key];
    });
    logBattle(`✅ Defeated Lvl ${monster.level} monster! +${goldReward} Gold`);
    showRewardPopup(`+${goldReward} 💰 Gold`);
    monster.collected = true;
    layer.find(node => node.attrs.x === monster.x && node.attrs.y === monster.y)[0].destroy();
    setTimeout(() => {
      const index = spots.indexOf(monster);
      if (index !== -1) spots.splice(index, 1);
      respawnSpot();
    }, 30000);
    updateQuestProgress('monster');
  } else {
    loseTroops();
    logBattle(`❌ You lost to Lvl ${monster.level} monster! Troops lost.`);
  }
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function showRewardPopup(text) {
  const popup = document.getElementById('rewardPopup');
  popup.textContent = text;
  popup.classList.add('show');
  setTimeout(() => {
    popup.classList.remove('show');
  }, 1000);
}

// === TROOPS & QUESTS ===
const troopCost = {
  infantry: { wood: 2, stone: 1, gold: 0 },
  archer: { wood: 1, stone: 0, gold: 2 },
  cavalry: { wood: 0, stone: 3, gold: 3 }
};

function buildTroop(type) {
  const cost = troopCost[type];
  const canBuild = Object.keys(cost).every(r => resources[r] >= cost[r]);
  if (canBuild) {
    Object.keys(cost).forEach(r => {
      resources[r] -= cost[r];
      resourceDisplay[r].textContent = resources[r];
    });
    troops[type]++;
    troopDisplay[type].textContent = troops[type];
    updateQuestProgress('troop', type);
  } else {
    alert('Not enough resources!');
  }
}

toggleLogBtn.addEventListener('click', () => {
  logContent.classList.toggle('collapsed');
  toggleLogBtn.textContent = logContent.classList.contains('collapsed') ? 'Battle Log ▼' : 'Battle Log ▲';
});

function totalTroops() {
  return troops.infantry + troops.archer + troops.cavalry;
}

function loseTroops() {
  Object.keys(troops).forEach(type => {
    troops[type] = Math.floor(troops[type] / 2);
    troopDisplay[type].textContent = troops[type];
  });
}

function logBattle(message) {
  const p = document.createElement('p');
  p.textContent = message;
  battleLog.prepend(p);
  while (battleLog.children.length > 5) {
    battleLog.removeChild(battleLog.lastChild);
  }
}

// === QUEST SYSTEM ===
function generateQuests() {
  quests = [];
  const baseAmount = Math.pow(2, questSetNumber - 1) * 5;
  const resourceType = ['wood', 'stone', 'gold'][Math.floor(Math.random() * 3)];
  quests.push({
    id: 1,
    description: `Collect ${baseAmount} ${resourceType}`,
    type: 'resource',
    resource: resourceType,
    target: baseAmount,
    progress: 0,
    completed: false,
    reward: { gold: baseAmount }
  });
  quests.push({
    id: 2,
    description: `Defeat ${Math.ceil(baseAmount / 2)} Monsters`,
    type: 'monster',
    target: Math.ceil(baseAmount / 2),
    progress: 0,
    completed: false,
    reward: { stone: baseAmount, gold: Math.ceil(baseAmount / 2) }
  });
  const troopTypes = ['infantry', 'archer', 'cavalry'];
  const troopType = troopTypes[Math.floor(Math.random() * 3)];
  quests.push({
    id: 3,
    description: `Build ${baseAmount} ${troopType.charAt(0).toUpperCase() + troopType.slice(1)} Units`,
    type: 'troop',
    troopType: troopType,
    target: baseAmount,
    progress: 0,
    completed: false,
    reward: { wood: baseAmount, stone: baseAmount }
  });
}

function renderQuests() {
  questListEl.innerHTML = '';
  quests.forEach(q => {
    const li = document.createElement('li');
    li.textContent = `${q.description} - ${q.progress}/${q.target} ${q.completed ? '✅' : ''}`;
    questListEl.appendChild(li);
  });
}

function updateQuestProgress(type, data) {
  let allCompleted = true;
  quests.forEach(q => {
    if (q.completed) return;
    allCompleted = false;
    if (q.type === type) {
      if (type === 'resource' && q.resource === data) q.progress++;
      if (type === 'monster') q.progress++;
      if (type === 'troop' && q.troopType === data) q.progress++;
      if (q.progress >= q.target) {
        q.completed = true;
        giveQuestReward(q.reward);
        logBattle(`🎯 Quest Completed: ${q.description}`);
        showRewardPopup(`🎯 Quest Reward!`);
      }
    }
  });
  if (quests.every(q => q.completed)) {
    questSetNumber++;
    logBattle(`🌟 New Quest Set Unlocked! Difficulty Increased.`);
    showRewardPopup(`🌟 New Quests Available!`);
    generateQuests();
  }
  renderQuests();
}

function giveQuestReward(reward) {
  Object.keys(reward).forEach(res => {
    resources[res] += reward[res];
    resourceDisplay[res].textContent = resources[res];
  });
}

// === INIT ===
generateSpots(300);
generateQuests();
renderQuests();

window.addEventListener('resize', () => {
  stage.width(window.innerWidth);
  stage.height(window.innerHeight);
});
