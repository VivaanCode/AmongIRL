const spaceField = document.getElementById('spaceField');
const destroyedCountElement = document.getElementById('destroyedCount');
const remainingCountElement = document.getElementById('remainingCount');
const activeCountElement = document.getElementById('activeCount');
const progressFill = document.getElementById('progressFill');
const startBtn = document.getElementById('startBtn');
const indicator = document.querySelector('.indicator');
const modal = document.getElementById('successModal');
const closeModalBtn = document.getElementById('closeModal');

let asteroids = [];
let destroyedCount = 0;
let totalTargets = 20;
let gameStarted = false;
let spawnInterval = null;

function onTaskComplete() {
  modal.classList.remove("hidden");
  
  var xhr = new XMLHttpRequest();
  xhr.open("POST", "/api/addprogress", true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.send(JSON.stringify({
      "progress": 10
  }));
  
  const username = document.body.dataset.username;
  if (username) {
    var taskXhr = new XMLHttpRequest();
    taskXhr.open("POST", "/api/task-completed", true);
    taskXhr.setRequestHeader('Content-Type', 'application/json');
    taskXhr.send(JSON.stringify({
        "username": username,
        "task_name": "Clear Asteroids"
    }));
  }
}

function createAsteroid() {
  if (!gameStarted) return;
  
  const asteroid = document.createElement('div');
  asteroid.classList.add('asteroid');
  
  const size = 15 + Math.random() * 20;
  asteroid.style.width = `${size}px`;
  asteroid.style.height = `${size}px`;
  
  const maxX = spaceField.clientWidth - size;
  const maxY = spaceField.clientHeight - size;
  asteroid.style.left = `${Math.random() * maxX}px`;
  asteroid.style.top = `${Math.random() * maxY}px`;
  
  const duration = 2 + Math.random() * 4; // 2-6 seconds
  asteroid.style.animationDuration = `${duration}s`;
  
  // Add click handler
  asteroid.addEventListener('click', (e) => {
    e.preventDefault();
    destroyAsteroid(asteroid);
  });
  
  // Auto-remove after some time (no penalty)
  setTimeout(() => {
    if (asteroid.parentNode) {
      removeAsteroid(asteroid);
    }
  }, 8000 + Math.random() * 4000); // 8-12 seconds
  
  spaceField.appendChild(asteroid);
  asteroids.push(asteroid);
  updateStats();
}

function destroyAsteroid(asteroid) {
  if (!gameStarted || asteroid.classList.contains('destroyed')) return;
  
  asteroid.classList.add('destroyed');
  asteroid.style.pointerEvents = 'none';
  destroyedCount++;
  
  // Play destruction sound effect (visual feedback)
  asteroid.style.background = '#ff6b35';
  
  setTimeout(() => {
    removeAsteroid(asteroid);
    
    if (destroyedCount >= totalTargets) {
      completeTask();
    }
  }, 400);
  
  updateStats();
}

function removeAsteroid(asteroid) {
  if (asteroid.parentNode) {
    asteroid.remove();
    asteroids = asteroids.filter(item => item !== asteroid);
    updateStats();
  }
}

function updateStats() {
  const remaining = Math.max(0, totalTargets - destroyedCount);
  const progress = Math.round((destroyedCount / totalTargets) * 100);
  const activeAsteroids = asteroids.filter(a => a.parentNode && !a.classList.contains('destroyed')).length;
  
  destroyedCountElement.textContent = destroyedCount;
  remainingCountElement.textContent = remaining;
  activeCountElement.textContent = activeAsteroids;
  progressFill.style.width = `${progress}%`;
  
  if (destroyedCount === 0 && gameStarted) {
    indicator.innerHTML = '<span class="dot"></span><span class="msg">Click asteroids to destroy them!</span>';
  } else if (destroyedCount > 0 && destroyedCount < totalTargets) {
    indicator.innerHTML = `<span class="dot"></span><span class="msg">${destroyedCount}/${totalTargets} asteroids destroyed - keep shooting!</span>`;
  }
}

function completeTask() {
  gameStarted = false;
  clearInterval(spawnInterval);
  startBtn.disabled = false;
  startBtn.textContent = 'START TARGETING';
  
  asteroids.forEach(asteroid => {
    if (asteroid.parentNode) {
      asteroid.remove();
    }
  });
  asteroids = [];
  
  indicator.classList.add('good');
  indicator.innerHTML = '<span class="dot"></span><span class="msg">All asteroids destroyed! Mission complete!</span>';
  
  setTimeout(onTaskComplete, 1000);
}

function startGame() {
  gameStarted = true;
  destroyedCount = 0;
  startBtn.disabled = true;
  startBtn.textContent = 'TARGETING...';
  
  // Clear any existing asteroids
  asteroids.forEach(asteroid => asteroid.remove());
  asteroids = [];
  
  updateStats();
  indicator.innerHTML = '<span class="dot"></span><span class="msg">Click asteroids to destroy them!</span>';
  
  // Start spawning asteroids at random intervals
  function spawnAsteroid() {
    if (gameStarted) {
      createAsteroid();
      const nextSpawn = 1000 + Math.random() * 2000;
      spawnInterval = setTimeout(spawnAsteroid, nextSpawn);
    }
  }
  
  spawnAsteroid();
}

startBtn.addEventListener('click', startGame);

closeModalBtn.addEventListener('click', () => {
  modal.classList.add("hidden");
});

spaceField.addEventListener('touchstart', (e) => {
  e.preventDefault();
  // Get the touch position
  const touch = e.touches[0];
  const element = document.elementFromPoint(touch.clientX, touch.clientY);
  if (element && element.classList.contains('asteroid')) {
    destroyAsteroid(element);
  }
});

updateStats();