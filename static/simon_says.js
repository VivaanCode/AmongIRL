const simonButtons = document.querySelectorAll('.simon-button');
const startBtn = document.getElementById('startBtn');
const roundNumber = document.querySelector('.round-number');
const indicator = document.querySelector('.indicator');
const modal = document.getElementById('successModal');
const closeModalBtn = document.getElementById('closeModal');

let sequence = [];
let playerSequence = [];
let currentRound = 1;
let isShowingSequence = false;
let canClick = false;
const maxRounds = 5;

// Simple beep sounds using Web Audio API
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

function playBeep(frequency, duration = 200) {
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.frequency.value = frequency;
  oscillator.type = 'sine';
  
  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);
  
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + duration / 1000);
}

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
        "task_name": "Memory Sequence"
    }));
  }
}

function generateNewColor() {
  const colors = ['red', 'blue', 'green', 'yellow'];
  
  // Ensure we don't repeat the last color to guarantee variety
  let availableColors = [...colors];
  if (sequence.length > 0) {
    const lastColor = sequence[sequence.length - 1];
    availableColors = colors.filter(color => color !== lastColor);
  }
  
  const randomIndex = Math.floor(Math.random() * availableColors.length);
  return availableColors[randomIndex];
}

function addToSequence() {
  const newColor = generateNewColor();
  sequence.push(newColor);
}

function showSequence() {
  isShowingSequence = true;
  canClick = false;
  disableButtons();
  startBtn.disabled = true;
  
  indicator.innerHTML = '<span class="dot"></span><span class="msg">Watch the sequence</span>';
  
  let index = 0;
  const showNext = () => {
    if (index < sequence.length) {
      const color = sequence[index];
      const button = document.querySelector(`.simon-button.${color}`);
      
      // Light up button
      button.classList.add('active');
      
      const frequencies = { red: 440, blue: 554, green: 659, yellow: 784 };
      playBeep(frequencies[color], 300);
      
      setTimeout(() => {
        button.classList.remove('active');
        index++;
        setTimeout(showNext, 200);
      }, 500);
    } else {
      // Sequence finished, allow player input
      setTimeout(() => {
        isShowingSequence = false;
        canClick = true;
        enableButtons();
        indicator.innerHTML = '<span class="dot"></span><span class="msg">Repeat the sequence</span>';
      }, 500);
    }
  };
  
  setTimeout(showNext, 500);
}

function checkPlayerInput(color) {
  playerSequence.push(color);
  const currentIndex = playerSequence.length - 1;
  
  if (playerSequence[currentIndex] !== sequence[currentIndex]) {
    indicator.classList.add('bad');
    indicator.innerHTML = '<span class="dot"></span><span class="msg">Wrong! Starting over...</span>';
    
    setTimeout(() => {
      resetGame();
    }, 1500);
    return;
  }
  
  if (playerSequence.length === sequence.length) {
    // Round complete!
    if (currentRound >= maxRounds) {
      indicator.classList.add('good');
      indicator.innerHTML = '<span class="dot"></span><span class="msg">All sequences completed!</span>';
      
      setTimeout(onTaskComplete, 1000);
      return;
    }
    
    currentRound++;
    roundNumber.textContent = currentRound;
    playerSequence = [];
    
    indicator.innerHTML = '<span class="dot"></span><span class="msg">Good! Next round...</span>';
    
    setTimeout(() => {
      addToSequence();
      showSequence();
    }, 1000);
  }
}

function disableButtons() {
  simonButtons.forEach(button => {
    button.classList.add('disabled');
  });
}

function enableButtons() {
  simonButtons.forEach(button => {
    button.classList.remove('disabled');
  });
}

function resetGame() {
  sequence = [];
  playerSequence = [];
  currentRound = 1;
  roundNumber.textContent = currentRound;
  isShowingSequence = false;
  canClick = false;
  startBtn.disabled = false;
  
  indicator.classList.remove('good', 'bad');
  indicator.innerHTML = '<span class="dot"></span><span class="msg">Click Start to begin</span>';
  
  disableButtons();
}

// Button click handlers
simonButtons.forEach(button => {
  button.addEventListener('click', () => {
    if (!canClick || button.classList.contains('disabled')) return;
    
    const color = button.dataset.color;
    
    button.classList.add('active');
    
    const frequencies = { red: 440, blue: 554, green: 659, yellow: 784 };
    playBeep(frequencies[color], 150);
    
    setTimeout(() => {
      button.classList.remove('active');
    }, 200);
    
    checkPlayerInput(color);
  });
});

startBtn.addEventListener('click', () => {
  if (sequence.length === 0) {
    addToSequence();
  }
  showSequence();
});

closeModalBtn.addEventListener('click', () => {
  modal.classList.add("hidden");
});

resetGame();