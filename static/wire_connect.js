const wireStarts = document.querySelectorAll('.wire-start');
const wireEnds = document.querySelectorAll('.wire-end');
const wireSvg = document.querySelector('.wire-svg');
const indicator = document.querySelector('.indicator');
const modal = document.getElementById('successModal');
const closeModalBtn = document.getElementById('closeModal');

let connections = new Map(); // wire number -> connected
let totalWires = 4;
let isDragging = false;
let dragElement = null;
let tempWire = null;
let mousePos = { x: 0, y: 0 };
let clickStartPos = { x: 0, y: 0 }; // Store exact click position




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
        "task_name": "Fix Wiring"
    }));
  }
}

function getElementPosition(element) {
  const areaRect = document.querySelector('.connection-area').getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();
  
  return {
    x: elementRect.left - areaRect.left + elementRect.width / 2,
    y: elementRect.top - areaRect.top + elementRect.height / 2
  };
}

function drawWire(start, end, color) {
  const startPos = getElementPosition(start);
  const endPos = getElementPosition(end);
  
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', startPos.x);
  line.setAttribute('y1', startPos.y);
  line.setAttribute('x2', endPos.x);
  line.setAttribute('y2', endPos.y);
  line.setAttribute('class', `wire-path ${color}`);
  
  wireSvg.appendChild(line);
}

function drawTempWire(startX, startY, mouseX, mouseY, color) {
  if (tempWire) {
    wireSvg.removeChild(tempWire);
  }
  
  tempWire = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  tempWire.setAttribute('x1', startX);
  tempWire.setAttribute('y1', startY);
  tempWire.setAttribute('x2', mouseX);
  tempWire.setAttribute('y2', mouseY);
  tempWire.setAttribute('class', `temp-wire ${color}`);
  tempWire.setAttribute('stroke-dasharray', '5,5');
  
  wireSvg.appendChild(tempWire);
}

function removeTempWire() {
  if (tempWire) {
    wireSvg.removeChild(tempWire);
    tempWire = null;
  }
}

function clearWires() {
  while (wireSvg.firstChild) {
    wireSvg.removeChild(wireSvg.firstChild);
  }
}

function updateConnections() {
  clearWires();
  
  connections.forEach((connected, wireNum) => {
    if (connected) {
      const startWire = document.querySelector(`.wire-start[data-wire="${wireNum}"]`);
      const endWire = document.querySelector(`.wire-end[data-wire="${wireNum}"]`);
      const color = startWire.dataset.color;
      
      drawWire(startWire, endWire, color);
    }
  });
  
  if (connections.size === totalWires && Array.from(connections.values()).every(v => v)) {
    indicator.classList.add('good');
    indicator.innerHTML = '<span class="dot"></span><span class="msg">All wires connected!</span>';
    
    // Mark all elements as connected
    wireStarts.forEach(wire => wire.classList.add('connected'));
    wireEnds.forEach(wire => wire.classList.add('connected'));
    
    setTimeout(onTaskComplete, 500);
  }
}

// Mouse/Touch position tracking
function updateMousePosition(e) {
  const areaRect = document.querySelector('.connection-area').getBoundingClientRect();
  const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
  const clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
  mousePos.x = clientX - areaRect.left;
  mousePos.y = clientY - areaRect.top;
}

function handleDragStart(e, wire) {
  e.preventDefault();
  isDragging = true;
  dragElement = wire;
  wire.classList.add('selected');
  
  indicator.innerHTML = '<span class="dot"></span><span class="msg">Drag to connect to matching wire</span>';
  
  updateMousePosition(e);
  // Use wire center position as start point
  const wirePos = getElementPosition(wire);
  clickStartPos.x = wirePos.x;
  clickStartPos.y = wirePos.y;
  
  drawTempWire(clickStartPos.x, clickStartPos.y, mousePos.x, mousePos.y, wire.dataset.color);
  
  // Set pointer capture for mobile
  if (wire.setPointerCapture && e.pointerId) {
    wire.setPointerCapture(e.pointerId);
  }
}

wireStarts.forEach(wire => {
  // Mouse events
  wire.addEventListener('mousedown', (e) => handleDragStart(e, wire));
  
  // Touch events for mobile
  wire.addEventListener('touchstart', (e) => handleDragStart(e, wire));
  
  // Pointer events for unified handling
  wire.addEventListener('pointerdown', (e) => handleDragStart(e, wire));
});

function handleDragMove(e) {
  if (isDragging && dragElement) {
    e.preventDefault();
    updateMousePosition(e);
    drawTempWire(clickStartPos.x, clickStartPos.y, mousePos.x, mousePos.y, dragElement.dataset.color);
  }
}

document.addEventListener('mousemove', handleDragMove);
document.addEventListener('touchmove', handleDragMove);
document.addEventListener('pointermove', handleDragMove);

function handleDragEnd(e) {
  if (isDragging && dragElement) {
    removeTempWire();
    
    const clientX = e.clientX || (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : 0);
    const clientY = e.clientY || (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientY : 0);
    
    const target = document.elementFromPoint(clientX, clientY);
    const wireEnd = target?.closest('.wire-end');
    
    if (wireEnd) {
      const startWireNum = dragElement.dataset.wire;
      const endWireNum = wireEnd.dataset.wire;
      
      if (startWireNum === endWireNum) {
        connections.set(parseInt(startWireNum), true);
        indicator.innerHTML = '<span class="dot"></span><span class="msg">Good connection! Continue with the next wire</span>';
        updateConnections();
      } else {
        indicator.classList.add('bad');
        indicator.innerHTML = '<span class="dot"></span><span class="msg">Wrong connection! Try again</span>';
        
        setTimeout(() => {
          indicator.classList.remove('bad');
          indicator.innerHTML = '<span class="dot"></span><span class="msg">Drag wires to connect matching colors</span>';
        }, 1500);
      }
    } else {
      indicator.innerHTML = '<span class="dot"></span><span class="msg">Drag wires to connect matching colors</span>';
    }
    
    dragElement.classList.remove('selected');
    dragElement = null;
    isDragging = false;
  }
}

document.addEventListener('mouseup', handleDragEnd);
document.addEventListener('touchend', handleDragEnd);
document.addEventListener('pointerup', handleDragEnd);

// Prevent drag on wire ends
wireEnds.forEach(wire => {
  wire.addEventListener('mousedown', (e) => {
    e.preventDefault();
  });
  wire.addEventListener('touchstart', (e) => {
    e.preventDefault();
  });
  wire.addEventListener('pointerdown', (e) => {
    e.preventDefault();
  });
});

closeModalBtn.addEventListener('click', () => {
  modal.classList.add("hidden");
});

// Shuffle array utility function
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function syncSvgViewBox() {
  const areaRect = document.querySelector('.connection-area').getBoundingClientRect();
  wireSvg.setAttribute('viewBox', `0 0 ${areaRect.width} ${areaRect.height}`);
  wireSvg.setAttribute('preserveAspectRatio', 'none');
}

function randomizeWirePositions() {
  const leftSide = document.querySelector('.left-side');
  const rightSide = document.querySelector('.right-side');
  
  // Get all wire elements
  const leftWires = Array.from(leftSide.children);
  const rightWires = Array.from(rightSide.children);
  
  // Shuffle the arrays
  const shuffledLeftWires = shuffleArray([...leftWires]);
  const shuffledRightWires = shuffleArray([...rightWires]);
  
  leftWires.forEach(wire => wire.remove());
  rightWires.forEach(wire => wire.remove());
  
  // Re-append in shuffled order
  shuffledLeftWires.forEach(wire => leftSide.appendChild(wire));
  shuffledRightWires.forEach(wire => rightSide.appendChild(wire));
}

document.addEventListener('DOMContentLoaded', () => {
  randomizeWirePositions();
  syncSvgViewBox();
});

// Redraw wires on window resize
window.addEventListener('resize', () => {
  syncSvgViewBox();
  if (connections.size > 0) {
    updateConnections();
  }
});