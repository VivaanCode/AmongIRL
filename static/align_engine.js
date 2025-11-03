const controlDials = document.querySelectorAll('.control-dial');
const pointers = document.querySelectorAll('.control-dial .dial-pointer');
const indicator = document.querySelector('.indicator');
const modal = document.getElementById('successModal');
const closeModalBtn = document.getElementById('closeModal');

// Target angles (in degrees)
const targetAngles = [45, 135, 225, 315];
const tolerance = 10; // degrees tolerance for alignment

let dialAngles = [0, 0, 0, 0];
let alignedCount = 0;

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
        "task_name": "Align Engine Output"
    }));
  }
}

function normalizeAngle(angle) {
  while (angle < 0) angle += 360;
  while (angle >= 360) angle -= 360;
  return angle;
}

function isAligned(currentAngle, targetAngle) {
  const normalizedCurrent = normalizeAngle(currentAngle);
  const normalizedTarget = normalizeAngle(targetAngle);
  
  let diff = Math.abs(normalizedCurrent - normalizedTarget);
  if (diff > 180) diff = 360 - diff;
  
  return diff <= tolerance;
}

function updateDialAlignment() {
  alignedCount = 0;
  
  dialAngles.forEach((angle, index) => {
    const dialElement = document.querySelector(`[data-dial="${index + 1}"]`);
    const pointer = document.getElementById(`pointer${index + 1}`);
    
    if (isAligned(angle, targetAngles[index])) {
      dialElement.classList.add('aligned');
      pointer.classList.add('aligned');
      alignedCount++;
    } else {
      dialElement.classList.remove('aligned');
      pointer.classList.remove('aligned');
    }
  });
  
  if (alignedCount === 0) {
    indicator.innerHTML = '<span class="dot"></span><span class="msg">Rotate dials to match the target pattern</span>';
  } else if (alignedCount < 4) {
    indicator.innerHTML = `<span class="dot"></span><span class="msg">${alignedCount}/4 dials aligned</span>`;
  } else {
    indicator.classList.add('good');
    indicator.innerHTML = '<span class="dot"></span><span class="msg">All dials aligned!</span>';
    
    setTimeout(onTaskComplete, 1000);
  }
}

function rotateDial(dialIndex, event) {
  const dialElement = controlDials[dialIndex];
  const rect = dialElement.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  
  const mouseX = event.clientX;
  const mouseY = event.clientY;
  
  const deltaX = mouseX - centerX;
  const deltaY = mouseY - centerY;
  
  let angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
  angle += 90; // Adjust for pointer orientation
  angle = normalizeAngle(angle);
  
  // Snap to 15-degree increments for easier alignment
  angle = Math.round(angle / 15) * 15;
  
  dialAngles[dialIndex] = angle;
  
  const pointer = document.getElementById(`pointer${dialIndex + 1}`);
  pointer.style.transform = `translate(-50%, -100%) rotate(${angle}deg)`;
  
  updateDialAlignment();
}

// Add click handlers for each dial
controlDials.forEach((dial, index) => {
  dial.addEventListener('click', (event) => {
    rotateDial(index, event);
  });
  
  // Also add mousemove handler for dragging
  let isDragging = false;
  
  dial.addEventListener('mousedown', () => {
    isDragging = true;
  });
  
  dial.addEventListener('mousemove', (event) => {
    if (isDragging) {
      rotateDial(index, event);
    }
  });
  
  dial.addEventListener('mouseup', () => {
    isDragging = false;
  });
  
  dial.addEventListener('mouseleave', () => {
    isDragging = false;
  });
});

controlDials.forEach((dial, index) => {
  dial.addEventListener('touchstart', (event) => {
    event.preventDefault();
  });
  
  dial.addEventListener('touchmove', (event) => {
    event.preventDefault();
    const touch = event.touches[0];
    rotateDial(index, touch);
  });
});

closeModalBtn.addEventListener('click', () => {
  modal.classList.add("hidden");
});

updateDialAlignment();