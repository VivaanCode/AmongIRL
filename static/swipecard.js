const min = 760;
const max = 940;

const card = document.querySelector(".card");
const reader = document.querySelector(".reader");
const indicator = document.querySelector(".indicator");

const modal = document.getElementById("successModal");
const closeModalBtn = document.getElementById("closeModal");

let dragging = false;
let offsetX = 0;
let startTime = 0;
let endTime = 0;

function onCardTaskComplete() {
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
        "task_name": "Swipe Card"
    }));
  }
}

function resetCardPosition() {
  const readerRect = reader.getBoundingClientRect();
  const containerRect = reader.parentElement.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();

  const startLeft = readerRect.left - containerRect.left;
  const startTop =
    readerRect.top -
    containerRect.top +
    (readerRect.height - cardRect.height) / 2;

  card.style.transition = "all 0.3s ease"; // smooth reset
  card.style.left = `${startLeft}px`;
  card.style.top = `${startTop}px`;

  // Save fixed top for dragging
  card.dataset.fixedTop = startTop;

  setTimeout(() => {
    card.style.transition = "";
  }, 300);
}

function startDrag(e) {
  dragging = true;
  startTime = Date.now();

  const containerRect = reader.parentElement.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();

  offsetX = e.clientX - (cardRect.left - containerRect.left);

  card.style.transition = "none";
}

function moveDrag(clientX) {
  if (!dragging) return;

  const readerRect = reader.getBoundingClientRect();
  const containerRect = reader.parentElement.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();

  const minLeft = readerRect.left - containerRect.left;
  const maxLeft = readerRect.right - containerRect.left - cardRect.width;

  let newLeft = clientX - offsetX;
  if (newLeft < minLeft) newLeft = minLeft;
  if (newLeft > maxLeft) newLeft = maxLeft;

  const fixedTop = parseFloat(card.dataset.fixedTop);

  card.style.left = `${newLeft}px`;
  card.style.top = `${fixedTop}px`;
}

function endDrag() {
  if (!dragging) return;
  dragging = false;
  endTime = Date.now();

  const elapsed = endTime - startTime; // ms to swipe
  const ideal = (min + max) / 2;
  const diff = Math.abs(elapsed - ideal);

  if (elapsed > min && elapsed < max) {
    indicator.innerHTML = `<span style="color: #00ff90;">●</span> Task Completed (${elapsed}ms)`;
    card.style.border = "3px solid #00ff90";
    onCardTaskComplete();
  } else {
    let feedback = "";
    if (elapsed < min) {
      feedback = "Too Fast";
    } else {
      feedback = "Too Slow";
    }

    if (diff < 100) {
      feedback += " — You were extremely close!";
    } else if (diff < 250) {
      feedback += " — You were pretty close but still off..";
    } else {
      feedback += " — Oh hell nah 💀";
    }

    indicator.innerHTML = `<span style="color: #ff004c;">●</span> ${feedback} (${diff}ms off)`;
    card.style.border = "3px solid #ff004c";

    setTimeout(() => {
      card.style.border = "none";
      resetCardPosition();
    }, 1200);
  }
}

card.addEventListener("mousedown", startDrag);
window.addEventListener("mousemove", (e) => moveDrag(e.clientX));
window.addEventListener("mouseup", endDrag);

card.addEventListener("touchstart", (e) => {
  startDrag(e.touches[0]);
});
window.addEventListener("touchmove", (e) => {
  moveDrag(e.touches[0].clientX);
});
window.addEventListener("touchend", endDrag);

closeModalBtn.addEventListener("click", () => {
  modal.classList.add("hidden");
  resetCardPosition();
});

window.addEventListener("load", resetCardPosition);
window.addEventListener("resize", resetCardPosition);
