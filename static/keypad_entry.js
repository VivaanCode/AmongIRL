const keyButtons = document.querySelectorAll('.key-btn');
const displayText = document.getElementById('displayText');
const indicator = document.querySelector('.indicator');
const modal = document.getElementById('successModal');
const closeModalBtn = document.getElementById('closeModal');

let currentInput = '';
let correctCode = '';
const maxLength = 4;

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
        "task_name": "Enter Access Code"
    }));
  }
}

function updateDisplay() {
  let display = '';
  for (let i = 0; i < maxLength; i++) {
    if (i < currentInput.length) {
      display += currentInput[i] + ' ';
    } else {
      display += '- ';
    }
  }
  displayText.textContent = display.trim();
}

function playBeep(isSuccess = false) {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  if (isSuccess) {
    // Success chord
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
  } else {
    // Error beep
    oscillator.frequency.value = 200;
    oscillator.type = 'sawtooth';
    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
  }
  
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + (isSuccess ? 0.5 : 0.3));
}

function addNumber(number) {
  if (currentInput.length < maxLength) {
    currentInput += number;
    updateDisplay();
    
    const button = document.querySelector(`[data-number="${number}"]`);
    button.classList.add('pressed');
    setTimeout(() => {
      button.classList.remove('pressed');
    }, 100);
  }
}

function clearInput() {
  currentInput = '';
  updateDisplay();
  indicator.classList.remove('good', 'bad');
  indicator.innerHTML = '<span class="dot"></span><span class="msg">Find the 4-digit code and enter it</span>';
}

function checkCode() {
  if (currentInput.length !== 4) {
    indicator.classList.add('bad');
    indicator.innerHTML = '<span class="dot"></span><span class="msg">Enter exactly 4 digits</span>';
    playBeep(false);
    
    setTimeout(() => {
      indicator.classList.remove('bad');
      indicator.innerHTML = '<span class="dot"></span><span class="msg">Find the 4-digit code and enter it</span>';
    }, 2000);
    return;
  }
  
  if (currentInput === correctCode) {
    indicator.classList.add('good');
    indicator.innerHTML = '<span class="dot"></span><span class="msg">Access granted!</span>';
    displayText.style.color = 'var(--good)';
    playBeep(true);
    
    setTimeout(onTaskComplete, 1000);
  } else {
    indicator.classList.add('bad');
    indicator.innerHTML = '<span class="dot"></span><span class="msg">Wrong code! Look around for the correct one</span>';
    
    playBeep(false);
    displayText.style.color = 'var(--bad)';
    
    setTimeout(() => {
      indicator.classList.remove('bad');
      indicator.innerHTML = '<span class="dot"></span><span class="msg">Find the 4-digit code and enter it</span>';
      displayText.style.color = 'var(--good)';
      clearInput();
    }, 2500);
  }
}

// Button event listeners
keyButtons.forEach(button => {
  button.addEventListener('click', () => {
    const number = button.dataset.number;
    const action = button.dataset.action;
    
    if (number) {
      addNumber(number);
    } else if (action === 'clear') {
      clearInput();
    } else if (action === 'enter') {
      checkCode();
    }
  });
});

// Keyboard support
document.addEventListener('keydown', (e) => {
  if (e.key >= '0' && e.key <= '9') {
    addNumber(e.key);
  } else if (e.key === 'Enter') {
    checkCode();
  } else if (e.key === 'Escape' || e.key === 'Backspace') {
    clearInput();
  }
});

closeModalBtn.addEventListener('click', () => {
  modal.classList.add("hidden");
});

function generateRandomCode() {
  correctCode = '';
  for (let i = 0; i < 4; i++) {
    correctCode += Math.floor(Math.random() * 10).toString();
  }
  
  // Display the code at a random position
  const codeElement = document.getElementById('randomCode');
  codeElement.textContent = correctCode;
  
  const randomX = Math.random() * 60 + 10; // 10% to 70% from left
  const randomY = Math.random() * 40 + 10; // 10% to 50% from top
  
  codeElement.style.left = randomX + '%';
  codeElement.style.top = randomY + '%';
}

generateRandomCode();
updateDisplay();