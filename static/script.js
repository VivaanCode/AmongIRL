// Wait for the entire page to load before running any script
document.addEventListener('DOMContentLoaded', () => {

    // --- 1. SELECT ALL ELEMENTS ---
    const progressBar = document.getElementById('progressBar');
    const progressContainer = document.getElementById('progressContainer');
    const victoryMessage = document.getElementById('victoryMessage');
    const defeatMessage = document.getElementById('defeatMessage');
    const emergencyMeetingAlert = document.getElementById('emergencyMeetingAlert');
    const deadBodyAlert = document.getElementById('deadBodyAlert');
    const taskAlertsContainer = document.getElementById('taskAlertsContainer');

    // --- 2. DEFINE STATE & UI FUNCTIONS ---
    let isMeetingActive = false;
    let isDeadBodyActive = false;

    const showVictory = () => {
        progressContainer.classList.add('fade-out');
        victoryMessage.classList.remove('d-none');
        victoryMessage.classList.add('fade-in');
        setTimeout(() => { progressContainer.style.display = 'none'; }, 800);
    };

    const showDefeat = () => {
        progressContainer.classList.add('fade-out');
        defeatMessage.classList.remove('d-none');
        defeatMessage.classList.add('fade-in');
        setTimeout(() => { progressContainer.style.display = 'none'; }, 800);
    };

    const showEmergencyMeeting = (callerUsername) => {
        progressContainer.classList.add('progress-container-minimized');
        document.getElementById('callerInfo').textContent = `Called by: ${callerUsername || 'Unknown'}`;
        emergencyMeetingAlert.classList.remove('d-none');
        emergencyMeetingAlert.classList.add('fade-in');
    };

    const hideEmergencyMeeting = () => {
        progressContainer.classList.remove('progress-container-minimized');
        emergencyMeetingAlert.classList.add('fade-out');
        setTimeout(() => {
            emergencyMeetingAlert.classList.remove('fade-in', 'fade-out');
            emergencyMeetingAlert.classList.add('d-none');
        }, 800);
    };

    const showDeadBody = (deadUsername, reporterUsername) => {
        progressContainer.classList.add('progress-container-minimized');
        document.getElementById('deadUsername').textContent = deadUsername;
        document.getElementById('reporterInfo').textContent = `Reported by: ${reporterUsername}`;
        deadBodyAlert.classList.remove('d-none');
        deadBodyAlert.classList.add('fade-in');
    };

    const hideDeadBody = () => {
        progressContainer.classList.remove('progress-container-minimized');
        deadBodyAlert.classList.add('fade-out');
        setTimeout(() => {
            deadBodyAlert.classList.remove('fade-in', 'fade-out');
            deadBodyAlert.classList.add('d-none');
        }, 800);
    };

    // --- 3. DEFINE CORE LOGIC ---


    /**
     * Get current progress from server
     */
    async function getCurrentProgress() {
        try {
            const response = await fetch('/api/progress');
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error getting current progress:', error);
            return {progress: 0};
        }
    }

    /**
     * Poll server for progress updates every 2 seconds
     */
    function startProgressPolling() {
        let previousProgress = null;
        let previousDeadUsername = null;
        let previousReporterUsername = null;
        let previousCallerUsername = null;
        
        setInterval(async () => {
            try {
                const serverData = await getCurrentProgress();
                const serverProgress = serverData.progress;

                // Only update UI if something actually changed
                const progressChanged = previousProgress !== serverProgress;
                const deadDataChanged = previousDeadUsername !== serverData.dead_username || 
                                      previousReporterUsername !== serverData.reporter_username;
                const callerDataChanged = previousCallerUsername !== serverData.caller_username;

                if (serverProgress === -2 && !isMeetingActive && !isDeadBodyActive) {
                    if (progressChanged || callerDataChanged) {
                        isMeetingActive = true;
                        showEmergencyMeeting(serverData.caller_username);
                    }
                } 
                else if (serverProgress === -3 && !isDeadBodyActive && !isMeetingActive) {
                    if (progressChanged || deadDataChanged) {
                        isDeadBodyActive = true;
                        showDeadBody(serverData.dead_username || 'Unknown', serverData.reporter_username || 'Unknown');
                    }
                }
                else if (serverProgress !== -2 && serverProgress !== -3 && (isMeetingActive || isDeadBodyActive)) {
                    if (isMeetingActive) {
                        isMeetingActive = false;
                        hideEmergencyMeeting();
                    }
                    if (isDeadBodyActive) {
                        isDeadBodyActive = false;
                        hideDeadBody();
                    }
                }
                else if (serverProgress === -1 && !isMeetingActive && !isDeadBodyActive) {
                    if (progressChanged) {
                        showDefeat();
                    }
                }
                else if (serverProgress >= 0 && !isMeetingActive && !isDeadBodyActive) {
                    const currentProgress = parseFloat(progressBar.style.width) || 0;
                    if (serverProgress !== currentProgress) {
                        progressBar.style.width = serverProgress + '%';
                        progressBar.setAttribute('aria-valuenow', serverProgress);
                    }
                }

                // Update previous values for next comparison
                previousProgress = serverProgress;
                previousDeadUsername = serverData.dead_username;
                previousReporterUsername = serverData.reporter_username;
                previousCallerUsername = serverData.caller_username;
            } catch (error) {
                // Silent error handling
            }
        }, 2000);
    }

    // The observer now only handles the VICTORY condition for client-side updates
    const observer = new MutationObserver(() => {
        if (parseFloat(progressBar.style.width) >= 100) {
            showVictory();
            observer.disconnect();
        }
    });
    observer.observe(progressBar, { attributes: true });

    // --- 4. START THE APPLICATION ---
    
    // Immediately check current state on page load to handle navigation during meetings
    async function initializePageState() {
        try {
            const serverData = await getCurrentProgress();
            const serverProgress = serverData.progress;
            
            if (serverProgress === -2) {
                isMeetingActive = true;
                showEmergencyMeeting(serverData.caller_username);
            } else if (serverProgress === -3) {
                isDeadBodyActive = true;
                showDeadBody(serverData.dead_username || 'Unknown', serverData.reporter_username || 'Unknown');
            } else if (serverProgress === -1) {
                showDefeat();
            }
        } catch (error) {
            // Silent error handling
        }
    }
    
    // Initialize page state immediately, then start polling
    initializePageState();
    startProgressPolling();
});