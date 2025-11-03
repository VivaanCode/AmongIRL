const startBtn = document.getElementById('startBtn');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const statusElement = document.getElementById('status');
const speedElement = document.getElementById('speed');
const etaElement = document.getElementById('eta');
const indicator = document.querySelector('.indicator');
const modal = document.getElementById('successModal');
const closeModalBtn = document.getElementById('closeModal');

let downloadProgress = 0;
let isDownloading = false;
const totalSize = 847.2; // KB
const downloadDuration = 8000; // 8 seconds for full download

function setCookie(name, value, days) {
  const expires = new Date();
  expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
}

function onTaskComplete() {
  // Set cookie to indicate data has been downloaded
  setCookie('data_downloaded', 'true', 1); // Cookie expires in 1 day
  
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
        "task_name": "Download Data"
    }));
  }
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function updateDownloadStats(progress) {
  const timeElapsed = (downloadDuration * progress / 100) / 1000; // seconds
  const downloadedSize = totalSize * progress / 100;
  
  // Simulate variable speed with some randomness
  const baseSpeed = 85 + Math.sin(timeElapsed * 2) * 25 + Math.random() * 10;
  const currentSpeed = Math.max(20, baseSpeed);
  
  speedElement.textContent = `${currentSpeed.toFixed(1)} KB/s`;
  
  const remainingSize = totalSize - downloadedSize;
  const eta = remainingSize / currentSpeed;
  etaElement.textContent = formatTime(eta);
}

function simulateDownload() {
  if (!isDownloading) return;
  
  if (downloadProgress >= 100) {
    progressFill.style.width = '100%';
    progressText.textContent = '100%';
    statusElement.textContent = 'Complete';
    statusElement.classList.add('complete');
    speedElement.textContent = '-- KB/s';
    etaElement.textContent = '00:00';
    
    indicator.classList.add('good');
    indicator.innerHTML = '<span class="dot"></span><span class="msg">Download completed successfully!</span>';
    
    setTimeout(onTaskComplete, 1000);
    return;
  }
  
  // Simulate realistic download progression (faster at start, slower at end)
  const progressIncrement = Math.random() * 3 + 0.5; // 0.5-3.5% per step
  downloadProgress = Math.min(100, downloadProgress + progressIncrement);
  
  progressFill.style.width = `${downloadProgress}%`;
  progressText.textContent = `${Math.floor(downloadProgress)}%`;
  
  updateDownloadStats(downloadProgress);
  
  const delay = 150 + Math.random() * 100; // 150-250ms between updates
  setTimeout(simulateDownload, delay);
}

function startDownload() {
  if (isDownloading) return;
  
  isDownloading = true;
  downloadProgress = 0;
  startBtn.disabled = true;
  startBtn.textContent = 'DOWNLOADING...';
  
  statusElement.textContent = 'Downloading';
  statusElement.classList.add('downloading');
  statusElement.classList.remove('complete');
  
  indicator.innerHTML = '<span class="dot"></span><span class="msg">Downloading data... please wait</span>';
  
  setTimeout(simulateDownload, 500);
}

startBtn.addEventListener('click', startDownload);

closeModalBtn.addEventListener('click', () => {
  modal.classList.add("hidden");
});

progressFill.style.width = '0%';
progressText.textContent = '0%';