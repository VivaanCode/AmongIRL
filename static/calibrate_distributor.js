const nodes = document.querySelectorAll('.node');
const calibratedCountElement = document.getElementById('calibratedCount');
const accuracyElement = document.getElementById('accuracy');
const responseTimeElement = document.getElementById('responseTime');
const progressFill = document.getElementById('progressFill');
const startBtn = document.getElementById('startBtn');
const indicator = document.querySelector('.indicator');
const modal = document.getElementById('successModal');
const closeModalBtn = document.getElementById('closeModal');

let gameActive = false;
let calibratedNodes = 0;
let totalNodes = 9;
let correctClicks = 0;
let totalClicks = 0;
let currentSequence = [];
let sequenceIndex = 0;
let activationTime = 0;

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
        "task_name": "Calibrate Distributor"
    }));
  }
}

function generateSequence() {
  currentSequence = [];
  const nodeNumbers = Array.from({length: totalNodes}, (_, i) => i + 1);
  
  // Shuffle the array to get random order
  for (let i = nodeNumbers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [nodeNumbers[i], nodeNumbers[j]] = [nodeNumbers[j], nodeNumbers[i]];
  }
  
  currentSequence = nodeNumbers;
  sequenceIndex = 0;
}

function activateNextNode() {
  if (!gameActive || sequenceIndex >= currentSequence.length) {
    if (sequenceIndex >= currentSequence.length) {
      completeCalibration();
    }
    return;
  }
  
  const nodeNumber = currentSequence[sequenceIndex];
  const node = document.querySelector(`[data-node="${nodeNumber}"]`);
  
  node.classList.add('active');
  activationTime = Date.now();
  
  // Node stays active for 2 seconds
  setTimeout(() => {
    if (node.classList.contains('active')) {
      // Node was missed - reset the entire task
      node.classList.remove('active');
      node.classList.add('missed');
      
      totalClicks++;
      
      // Show failure state briefly, then reset
      indicator.classList.add('bad');
      indicator.innerHTML = '<span class="dot"></span><span class="msg">Calibration failed! Starting over...</span>';
      
      setTimeout(() => {
        resetTask();
      }, 1500);
    }
  }, 2000);
}

function clickNode(nodeElement) {
  if (!gameActive) return;
  
  const nodeNumber = parseInt(nodeElement.dataset.node);
  const expectedNode = currentSequence[sequenceIndex];
  
  if (nodeElement.classList.contains('active') && nodeNumber === expectedNode) {
    const responseTime = Date.now() - activationTime;
    nodeElement.classList.remove('active');
    nodeElement.classList.add('calibrated');
    
    calibratedNodes++;
    correctClicks++;
    totalClicks++;
    
    responseTimeElement.textContent = `${responseTime} ms`;
    sequenceIndex++;
    
    // Advance to next node after a short delay
    setTimeout(() => {
      activateNextNode();
    }, 300);
    
  } else if (!nodeElement.classList.contains('calibrated')) {
    totalClicks++;
  }
  
  updateStats();
}

function updateStats() {
  calibratedCountElement.textContent = `${calibratedNodes}/${totalNodes}`;
  
  const accuracy = totalClicks === 0 ? 100 : Math.round((correctClicks / totalClicks) * 100);
  accuracyElement.textContent = `${accuracy}%`;
  
  const progress = Math.round((calibratedNodes / totalNodes) * 100);
  progressFill.style.width = `${progress}%`;
  
  if (calibratedNodes === 0 && gameActive) {
    indicator.innerHTML = '<span class="dot"></span><span class="msg">Click nodes when they light up yellow</span>';
  } else if (calibratedNodes < totalNodes && gameActive) {
    indicator.innerHTML = `<span class="dot"></span><span class="msg">${calibratedNodes}/${totalNodes} nodes calibrated</span>`;
  }
}

function resetTask() {
  gameActive = false;
  calibratedNodes = 0;
  correctClicks = 0;
  totalClicks = 0;
  sequenceIndex = 0;
  
  startBtn.disabled = false;
  startBtn.textContent = 'START CALIBRATION';
  
  nodes.forEach(node => {
    node.classList.remove('active', 'calibrated', 'missed');
  });
  
  indicator.classList.remove('bad', 'good');
  indicator.innerHTML = '<span class="dot"></span><span class="msg">Wait for nodes to activate, then click them quickly</span>';
  
  responseTimeElement.textContent = '-- ms';
  
  updateStats();
}

function completeCalibration() {
  gameActive = false;
  startBtn.disabled = false;
  startBtn.textContent = 'START CALIBRATION';
  
  indicator.classList.add('good');
  indicator.innerHTML = '<span class="dot"></span><span class="msg">All nodes calibrated successfully!</span>';
  
  setTimeout(onTaskComplete, 1000);
}

function startCalibration() {
  gameActive = true;
  calibratedNodes = 0;
  correctClicks = 0;
  totalClicks = 0;
  
  startBtn.disabled = true;
  startBtn.textContent = 'CALIBRATING...';
  
  nodes.forEach(node => {
    node.classList.remove('active', 'calibrated', 'missed');
  });
  indicator.classList.remove('bad', 'good');
  
  generateSequence();
  updateStats();
  
  indicator.innerHTML = '<span class="dot"></span><span class="msg">Get ready... first node will activate soon</span>';
  
  setTimeout(() => {
    activateNextNode();
  }, 1500);
}

// Add click handlers to all nodes
nodes.forEach(node => {
  node.addEventListener('click', () => clickNode(node));
});

startBtn.addEventListener('click', startCalibration);

closeModalBtn.addEventListener('click', () => {
  modal.classList.add("hidden");
});

updateStats();