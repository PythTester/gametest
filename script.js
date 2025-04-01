document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('gesturechange', e => e.preventDefault());
document.addEventListener('gestureend', e => e.preventDefault());



const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const minimap = document.getElementById('minimap');
const minimapCtx = minimap.getContext('2d');
minimap.width = 200;
minimap.height = 200;

let resources = { wood: 0, stone: 0, gold: 0 };
const resourceDisplay = {
  wood: document.getElementById('wood'),
  stone: document.getElementById('stone'),
  gold: document.getElementById('gold')
};

const tooltip = document.getElementById('tooltip');
const battleLog = document.getElementById('battleLog');
const toggleLogBtn = document.getElementById('toggleLog');
const logContent = document.getElementById('battleLog');

// --- Map Variables ---
const mapWidth = 15000;
const mapHeight = 15000;
let offsetX = 0;
let offsetY = 0;
let zoom = 1;

// --- Spot Variables ---
const spots = [];
const spotSize = 50;
const spotTypes = ['wood', 'stone', 'gold', 'monster'];
const minDistance = 70;

// --- Troop Movement ---
let marchTimer = null;
const troopSpeed = 300; // Higher = slower

// --- Generate Spots ---
function generateSpots(count) {
  let attempts = 0;
  while (spots.length < count && attempts < count * 10) {
    attempts++;
    const newSpot = {
      x: Math.random() * mapWidth,
      y: Math.random() * mapHeight,
      type: spotTypes[Math.floor(Math.random() * spotTypes.length)],
      level: Math.floor(Math.random() * 30) + 1,
      collected: false
    };
    if (isValidPosition(newSpot)) {
      spots.push(newSpot);
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

function respawnSpot(oldSpot) {
  let newSpot;
  let tries = 0;
  do {
    tries++;
    newSpot = {
      x: Math.random() * mapWidth,
      y: Math.random() * mapHeight,
      type: spotTypes[Math.floor(Math.random() * spotTypes.length)],
      level: Math.floor(Math.random() * 30) + 1,
      collected: false
    };
  } while (!isValidPosition(newSpot) && tries < 100);

  if (tries < 100) {
    spots.push(newSpot);
  }
}

// --- Mouse Controls ---
let isDragging = false;
let startX, startY;

canvas.addEventListener('mousedown', e => {
  isDragging = true;
  startX = e.clientX - offsetX;
  startY = e.clientY - offsetY;
});

canvas.addEventListener('mouseup', () => {
  isDragging = false;
});

canvas.addEventListener('mousemove', e => {
  if (isDragging) {
    offsetX = e.clientX - startX;
    offsetY = e.clientY - startY;
    clampOffset();
  }

  // Tooltip hover
  const mouseX = (e.clientX - offsetX) / zoom;
  const mouseY = (e.clientY - offsetY) / zoom;
  let hovered = false;

  spots.forEach(spot => {
    if (!spot.collected &&
      spot.type === 'monster' &&
      mouseX > spot.x && mouseX < spot.x + spotSize &&
      mouseY > spot.y && mouseY < spot.y + spotSize) {
      tooltip.style.display = 'block';
      tooltip.style.left = e.clientX + 10 + 'px';
      tooltip.style.top = e.clientY + 10 + 'px';
      tooltip.textContent = `Monster Lvl ${spot.level}`;
      hovered = true;
    }
  });

  if (!hovered) {
    tooltip.style.display = 'none';
  }
});

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  zoom += e.deltaY * -0.001;
  zoom = Math.min(Math.max(0.3, zoom), 2);
  clampOffset();
});

// --- Minimap Click ---
minimap.addEventListener('click', e => {
  const rect = minimap.getBoundingClientRect();
  const x = (e.clientX - rect.left) / minimap.width;
  const y = (e.clientY - rect.top) / minimap.height;
  offsetX = -(x * mapWidth - canvas.width / (2 * zoom)) * zoom;
  offsetY = -(y * mapHeight - canvas.height / (2 * zoom)) * zoom;
  clampOffset();
});

// --- Scroll Limit ---
function clampOffset() {
  const maxOffsetX = 0;
  const maxOffsetY = 0;
  const minOffsetX = canvas.width - mapWidth * zoom;
  const minOffsetY = canvas.height - mapHeight * zoom;
  offsetX = Math.min(Math.max(offsetX, minOffsetX), maxOffsetX);
  offsetY = Math.min(Math.max(offsetY, minOffsetY), maxOffsetY);
}

// --- Click Interaction ---
canvas.addEventListener('click', e => {
  const mouseX = (e.clientX - offsetX) / zoom;
  const mouseY = (e.clientY - offsetY) / zoom;

  const spot = spots.find(s =>
    !s.collected &&
    mouseX > s.x && mouseX < s.x + spotSize &&
    mouseY > s.y && mouseY < s.y + spotSize
  );

  if (spot) {
    if (spot.type === 'monster') {
      if (!marchTimer) startMarch(spot);
    } else {
      collectResource(spot);
    }
  }
});

function collectResource(spot) {
  resources[spot.type]++;
  resourceDisplay[spot.type].textContent = resources[spot.type];
  spot.collected = true;
  setTimeout(() => {
    const index = spots.indexOf(spot);
    if (index !== -1) spots.splice(index, 1);
    respawnSpot(spot);
  }, 30000);
}

// --- March System ---
function calculateTravelTime(startX, startY, targetX, targetY) {
  const dx = targetX - startX;
  const dy = targetY - startY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return Math.ceil(distance / troopSpeed);
}

function startMarch(target) {
  if (totalTroops() === 0) {
    alert('No troops! Build troops first!');
    return;
  }

  const startX = (canvas.width / 2 - offsetX) / zoom;
  const startY = (canvas.height / 2 - offsetY) / zoom;
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

function engageBattle(monster) {
    if (monster.collected) {
      logBattle(`⚠️ Monster Lvl ${monster.level} is already defeated.`);
      return;
    }
  
    const monsterPower = monster.level * 5;
    const playerPower = troops.infantry * 3 + troops.archer * 4 + troops.cavalry * 6;
  
    if (playerPower >= monsterPower) {
      let goldReward = 0;
      let resourceBonus = { wood: 0, stone: 0, gold: 0 };
  
      if (monster.level <= 4) {
        goldReward = randomInt(1, 2);
      } else if (monster.level <= 10) {
        goldReward = randomInt(2, 6);
        resourceBonus = { wood: 1, stone: 1, gold: 1 };
      } else if (monster.level <= 18) {
        goldReward = randomInt(5, 13);
      } else if (monster.level <= 20) {
        goldReward = randomInt(5, 13);
        resourceBonus = { wood: 3, stone: 3, gold: 3 };
      } else {
        goldReward = randomInt(10, 20);
        resourceBonus = { wood: 5, stone: 5, gold: 5 };
      }
  
      resources.gold += goldReward;
      resourceDisplay.gold.textContent = resources.gold;
  
      // Add resources
      Object.keys(resourceBonus).forEach(key => {
        resources[key] += resourceBonus[key];
        resourceDisplay[key].textContent = resources[key];
      });
  
      logBattle(`✅ Defeated Lvl ${monster.level} monster! +${goldReward} Gold ${resourceBonus.wood ? `+${resourceBonus.wood} of each resource` : ''}`);
      showRewardPopup(`+${goldReward} 💰 Gold${resourceBonus.wood ? ` & +${resourceBonus.wood} Resources` : ''}`);
  
      monster.collected = true;
      setTimeout(() => {
        const index = spots.indexOf(monster);
        if (index !== -1) spots.splice(index, 1);
        respawnSpot(monster);
      }, 30000);
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
  

// --- Troop Data ---
let troops = {
  infantry: 0,
  archer: 0,
  cavalry: 0
};

const troopCost = {
  infantry: { wood: 2, stone: 1, gold: 0 },
  archer: { wood: 1, stone: 0, gold: 2 },
  cavalry: { wood: 0, stone: 3, gold: 3 }
};

const troopDisplay = {
  infantry: document.getElementById('infantryCount'),
  archer: document.getElementById('archerCount'),
  cavalry: document.getElementById('cavalryCount')
};

function buildTroop(type) {
  const cost = troopCost[type];
  const canBuild = Object.keys(cost).every(resource => resources[resource] >= cost[resource]);
  if (canBuild) {
    Object.keys(cost).forEach(resource => {
      resources[resource] -= cost[resource];
      resourceDisplay[resource].textContent = resources[resource];
    });
    troops[type]++;
    troopDisplay[type].textContent = troops[type];
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

// --- Drawing ---
function draw() {
  ctx.setTransform(zoom, 0, 0, zoom, offsetX, offsetY);
  ctx.clearRect(-offsetX / zoom, -offsetY / zoom, canvas.width / zoom, canvas.height / zoom);
  ctx.clearRect(0, 0, mapWidth, mapHeight);

  spots.forEach(spot => {
    if (spot.collected) return;
    if (spot.type === 'monster') ctx.fillStyle = 'red';
    else if (spot.type === 'wood') ctx.fillStyle = 'green';
    else if (spot.type === 'stone') ctx.fillStyle = 'gray';
    else ctx.fillStyle = 'yellow';
    ctx.fillRect(spot.x, spot.y, spotSize, spotSize);
  });

  drawMinimap();
  requestAnimationFrame(draw);
}

// --- Minimap ---
function drawMinimap() {
  minimapCtx.clearRect(0, 0, minimap.width, minimap.height);
  minimapCtx.fillStyle = '#222';
  minimapCtx.fillRect(0, 0, minimap.width, minimap.height);

  const scaleX = minimap.width / mapWidth;
  const scaleY = minimap.height / mapHeight;

  spots.forEach(spot => {
    if (spot.collected) return;
    minimapCtx.fillStyle = spot.type === 'monster' ? 'red' : 'green';
    minimapCtx.fillRect(spot.x * scaleX, spot.y * scaleY, 2, 2);
  });

  minimapCtx.strokeStyle = 'white';
  minimapCtx.strokeRect(
    (-offsetX / zoom) * scaleX,
    (-offsetY / zoom) * scaleY,
    (canvas.width / zoom) * scaleX,
    (canvas.height / zoom) * scaleY
  );
}

// === QUEST SYSTEM ===
const questListEl = document.getElementById('questList');

let questSetNumber = 1;
let quests = [];

function generateQuests() {
  quests = [];
  const baseAmount = Math.pow(2, questSetNumber - 1) * 5; // 5, 10, 20, 40...

  // Random Quest 1 - Resource Collection
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

  // Random Quest 2 - Monster Hunt
  quests.push({
    id: 2,
    description: `Defeat ${Math.ceil(baseAmount / 2)} Monsters`,
    type: 'monster',
    target: Math.ceil(baseAmount / 2),
    progress: 0,
    completed: false,
    reward: { stone: baseAmount, gold: Math.ceil(baseAmount / 2) }
  });
  

  // Random Quest 3 - Troop Building
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
      if (type === 'resource' && q.resource === data) {
        q.progress++;
      }
      if (type === 'monster') {
        q.progress++;
      }
      if (type === 'troop' && q.troopType === data) {
        q.progress++;
      }
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

// === Hook Quest Progress into existing systems ===
const originalCollectResource = collectResource;
collectResource = function (spot) {
  originalCollectResource(spot);
  updateQuestProgress('resource', spot.type);
};

const originalEngageBattle = engageBattle;
engageBattle = function (monster) {
  originalEngageBattle(monster);
  if (monster.collected) {
    updateQuestProgress('monster');
  }
};

const originalBuildTroop = buildTroop;
buildTroop = function (type) {
  originalBuildTroop(type);
  updateQuestProgress('troop', type);
};

// === INIT QUESTS ===
generateQuests();
renderQuests();

// === MOBILE TOUCH CONTROLS ===
let lastTouchDistance = null;
let lastTouchX = null;
let lastTouchY = null;

canvas.addEventListener('touchstart', e => {
  if (e.touches.length === 2) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    lastTouchDistance = Math.sqrt(dx * dx + dy * dy);
  } else if (e.touches.length === 1) {
    lastTouchX = e.touches[0].clientX;
    lastTouchY = e.touches[0].clientY;
  }
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  if (e.touches.length === 2) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const delta = distance - lastTouchDistance;
    zoom += delta * 0.003;
    zoom = Math.min(Math.max(0.3, zoom), 2);
    lastTouchDistance = distance;
    clampOffset();
  } else if (e.touches.length === 1) {
    const deltaX = e.touches[0].clientX - lastTouchX;
    const deltaY = e.touches[0].clientY - lastTouchY;
    offsetX += deltaX;
    offsetY += deltaY;
    lastTouchX = e.touches[0].clientX;
    lastTouchY = e.touches[0].clientY;
    clampOffset();
  }
}, { passive: false });

canvas.addEventListener('touchend', () => {
  lastTouchDistance = null;
  lastTouchX = null;
  lastTouchY = null;
});




// --- INIT ---
generateSpots(300);
draw();

window.addEventListener('resize', () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});
