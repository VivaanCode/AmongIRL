const fuelCans = document.querySelectorAll('.fuel-can');
const fuelSlots = document.querySelectorAll('.fuel-slot');
const needles = document.querySelectorAll('.gauge-needle');
const indicator = document.querySelector('.indicator');
const modal = document.getElementById('successModal');
const closeModalBtn = document.getElementById('closeModal');

let fueledEngines = 0;
const totalEngines = 2;

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
        "task_name": "Fuel Engines"
    }));
  }
}

function fuelEngine(engineNumber) {
  const needle = document.getElementById(`needle${engineNumber}`);
  const slot = document.getElementById(`slot${engineNumber}`);
  
  needle.classList.add('fueled');
  slot.classList.add('fueled');
  slot.innerHTML = '<span class="slot-text">FUELED</span>';
  
  fueledEngines++;
  
  if (fueledEngines === 1) {
    indicator.innerHTML = '<span class="dot"></span><span class="msg">Good! Fuel the remaining engine</span>';
  } else if (fueledEngines === totalEngines) {
    indicator.classList.add('good');
    indicator.innerHTML = '<span class="dot"></span><span class="msg">All engines fueled!</span>';
    
    setTimeout(onTaskComplete, 1000);
  }
}

// Drag and drop functionality
let draggedCan = null;

fuelCans.forEach(can => {
  can.addEventListener('dragstart', (e) => {
    if (can.classList.contains('used')) {
      e.preventDefault();
      return;
    }
    
    draggedCan = can;
    can.classList.add('dragging');
    
    // Set drag data
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', can.outerHTML);
  });
  
  can.addEventListener('dragend', () => {
    can.classList.remove('dragging');
  });
});

fuelSlots.forEach(slot => {
  slot.addEventListener('dragover', (e) => {
    if (slot.classList.contains('fueled')) return;
    
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    slot.classList.add('drag-over');
  });
  
  slot.addEventListener('dragleave', (e) => {
    // Only remove drag-over if we're actually leaving the slot
    if (!slot.contains(e.relatedTarget)) {
      slot.classList.remove('drag-over');
    }
  });
  
  slot.addEventListener('drop', (e) => {
    e.preventDefault();
    slot.classList.remove('drag-over');
    
    if (!draggedCan || slot.classList.contains('fueled')) return;
    
    // Fuel the engine
    const engineNumber = slot.closest('.engine').dataset.engine;
    fuelEngine(engineNumber);
    
    // Mark the fuel can as used
    draggedCan.classList.add('used');
    
    draggedCan = null;
  });
});

let touchStartPos = { x: 0, y: 0 };
let touchCan = null;

fuelCans.forEach(can => {
  can.addEventListener('touchstart', (e) => {
    if (can.classList.contains('used')) return;
    
    touchCan = can;
    const touch = e.touches[0];
    touchStartPos = { x: touch.clientX, y: touch.clientY };
    can.classList.add('dragging');
  });
  
  can.addEventListener('touchmove', (e) => {
    if (!touchCan) return;
    
    e.preventDefault();
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartPos.x;
    const deltaY = touch.clientY - touchStartPos.y;
    
    touchCan.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
    
    const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
    const slot = elementBelow?.closest('.fuel-slot');
    
    fuelSlots.forEach(s => s.classList.remove('drag-over'));
    if (slot && !slot.classList.contains('fueled')) {
      slot.classList.add('drag-over');
    }
  });
  
  can.addEventListener('touchend', (e) => {
    if (!touchCan) return;
    
    const touch = e.changedTouches[0];
    const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
    const slot = elementBelow?.closest('.fuel-slot');
    
    fuelSlots.forEach(s => s.classList.remove('drag-over'));
    
    if (slot && !slot.classList.contains('fueled')) {
      const engineNumber = slot.closest('.engine').dataset.engine;
      fuelEngine(engineNumber);
      touchCan.classList.add('used');
    }
    
    touchCan.style.transform = '';
    touchCan.classList.remove('dragging');
    touchCan = null;
  });
});

closeModalBtn.addEventListener('click', () => {
  modal.classList.add("hidden");
});