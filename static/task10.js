const uploadBtn = document.getElementById('uploadBtn');
const connectionStatus = document.getElementById('connectionStatus');
const validationStatus = document.getElementById('validationStatus');
const uploadStatus = document.getElementById('uploadStatus');
const progressFill = document.getElementById('progressFill');
const dataInfo = document.getElementById('dataInfo');
const terminalContent = document.querySelector('.terminal-content');
const indicator = document.querySelector('.indicator');
const modal = document.getElementById('successModal');
const errorModal = document.getElementById('errorModal');
const closeModalBtn = document.getElementById('closeModal');
const closeErrorModalBtn = document.getElementById('closeErrorModal');
const errorMessage = document.getElementById('errorMessage');

let uploadProgress = 0;
let isUploading = false;

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

function deleteCookie(name) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}

function addLogLine(message, delay = 0) {
  setTimeout(() => {
    const logLine = document.createElement('div');
    logLine.classList.add('log-line');
    logLine.textContent = `> ${message}`;
    terminalContent.appendChild(logLine);
    terminalContent.scrollTop = terminalContent.scrollHeight;
  }, delay);
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
        "task_name": "Upload Data"
    }));
  }
}

function validateDataCookie() {
  const dataDownloaded = getCookie('data_downloaded');
  
  if (dataDownloaded === 'true') {
    addLogLine('Data download cookie found: VALID', 1000);
    addLogLine('File: mission_data.dat (847.2 KB)', 1500);
    addLogLine('Checksum: 4f3a2b1c9e8d7e6f5a4b3c2d1e0f9a8b', 2000);
    addLogLine('Data validation: COMPLETE', 2500);
    
    setTimeout(() => {
      connectionStatus.textContent = 'ESTABLISHED';
      connectionStatus.classList.add('good');
      validationStatus.textContent = 'PASSED';
      validationStatus.classList.add('good');
      
      dataInfo.innerHTML = `
        <p style="color: var(--good); font-weight: bold;">✓ DATA PACKAGE FOUND</p>
        <p>File: mission_data.dat</p>
        <p>Size: 847.2 KB</p>
        <p>Status: Ready for upload</p>
      `;
      
      uploadBtn.disabled = false;
      uploadBtn.textContent = 'START UPLOAD';
      
      indicator.innerHTML = '<span class="dot"></span><span class="msg">Data validated! Click to start upload</span>';
    }, 3000);
    
  } else {
    addLogLine('ERROR: No data download cookie found', 1000);
    addLogLine('Required file: mission_data.dat - NOT FOUND', 1500);
    addLogLine('Upload cannot proceed without downloaded data', 2000);
    
    setTimeout(() => {
      connectionStatus.textContent = 'ESTABLISHED';
      connectionStatus.classList.add('good');
      validationStatus.textContent = 'FAILED';
      validationStatus.classList.add('bad');
      
      dataInfo.innerHTML = `
        <p style="color: var(--bad); font-weight: bold;">✗ NO DATA FOUND</p>
        <p>Required: mission_data.dat</p>
        <p>Status: Download Task 5 first</p>
      `;
      
      indicator.classList.add('bad');
      indicator.innerHTML = '<span class="dot"></span><span class="msg">No downloaded data found - complete Task 5 first</span>';
      
      uploadBtn.textContent = 'DATA REQUIRED';
      uploadBtn.disabled = true;
      
      // Show error modal
      setTimeout(() => {
        errorModal.classList.remove('hidden');
      }, 1000);
      
    }, 3000);
  }
}

function simulateUpload() {
  if (!isUploading || uploadProgress >= 100) {
    if (uploadProgress >= 100) {
      uploadStatus.textContent = '100%';
      progressFill.style.width = '100%';
      uploadBtn.textContent = 'UPLOAD COMPLETE';
      
      addLogLine('Upload completed successfully!', 0);
      addLogLine('Deleting temporary data cache...', 500);
      addLogLine('Data cache cleared', 1000);
      
      // Delete the cookie to allow task completion again
      deleteCookie('data_downloaded');
      
      indicator.classList.add('good');
      indicator.innerHTML = '<span class="dot"></span><span class="msg">Data uploaded successfully!</span>';
      
      setTimeout(onTaskComplete, 1500);
    }
    return;
  }
  
  // Simulate upload progress
  const increment = Math.random() * 4 + 1; // 1-5% per step
  uploadProgress = Math.min(100, uploadProgress + increment);
  
  uploadStatus.textContent = `${Math.floor(uploadProgress)}%`;
  progressFill.style.width = `${uploadProgress}%`;
  
  // Add occasional log messages
  if (Math.random() < 0.3) {
    const messages = [
      'Transmitting data packet...',
      'Verifying upload integrity...',
      'Establishing secure connection...',
      'Compressing data stream...',
      'Synchronizing with server...'
    ];
    addLogLine(messages[Math.floor(Math.random() * messages.length)], 0);
  }
  
  setTimeout(simulateUpload, 200 + Math.random() * 300);
}

function startUpload() {
  const dataDownloaded = getCookie('data_downloaded');
  if (dataDownloaded !== 'true') {
    errorModal.classList.remove('hidden');
    return;
  }
  
  isUploading = true;
  uploadProgress = 0;
  uploadBtn.disabled = true;
  uploadBtn.textContent = 'UPLOADING...';
  
  indicator.innerHTML = '<span class="dot"></span><span class="msg">Uploading data to server...</span>';
  
  addLogLine('Starting data upload...', 0);
  addLogLine('Establishing secure connection to server', 300);
  addLogLine('Beginning file transfer: mission_data.dat', 600);
  
  setTimeout(simulateUpload, 1000);
}

uploadBtn.addEventListener('click', startUpload);

closeModalBtn.addEventListener('click', () => {
  modal.classList.add("hidden");
});

closeErrorModalBtn.addEventListener('click', () => {
  errorModal.classList.add("hidden");
});

setTimeout(() => {
  addLogLine('Connection established to upload server', 500);
  validateDataCookie();
}, 500);