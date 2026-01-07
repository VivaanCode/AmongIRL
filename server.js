const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'default-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

// Set view engine to match Flask's Jinja2 templates
app.set('view engine', 'html');
app.engine('html', require('ejs').renderFile);
app.set('views', path.join(__dirname, 'templates'));

// Serve static files
app.use('/static', express.static(path.join(__dirname, 'static')));

// Global state variables
const state = {
  currentProgress: 0,
  oldProgress: 0,
  deadUsername: '',
  reporterUsername: '',
  callerUsername: '',
  availableRoles: ['Imposter1', 'Imposter2', 'Imposter3', 'Crewmate'],
  userRoles: {},
  activeUsers: {},
  userSessions: {},
  usernameRenames: {},
  kickedUsers: new Set(),
  lastResetTime: Date.now(),
  lastSessionInvalidation: 0,
  taskCompletions: [],
  gameStarted: false,
  lastCompletedTaskName: '',

  // Task system
  allTasks: {
    1: 'Swipe Card',
    2: 'Fix Wiring',
    3: 'Memory Sequence',
    4: 'Enter Access Code',
    5: 'Download Data',
    6: 'Fuel Engines',
    7: 'Align Engine Output',
    8: 'Clear O2 Filter',
    9: 'Calibrate Distributor',
    10: 'Upload Data'
  },
  excludedFromGlobal: [5, 10],
  globalTasks: [],
  userIndividualTasks: {},
  playerIndividualTasks: {},
  totalProgressPercentage: 150,
  progressPerTask: 0,
  uniqueCompletions: new Set(),
  userCompletedTasks: {},

  // ID-based user management
  playerCounter: 1,
  players: {},
  usernameToId: {}
};

// Helper functions
function cleanupInactiveUsers() {
  const currentTime = Date.now();
  const inactiveThreshold = 25000;

  const inactiveUsers = [];
  for (const [username, lastPing] of Object.entries(state.activeUsers)) {
    if (currentTime - lastPing > inactiveThreshold) {
      inactiveUsers.push(username);
    }
  }

  for (const username of inactiveUsers) {
    delete state.activeUsers[username];
    if (state.userSessions[username]) {
      delete state.userSessions[username];
    }
    if (state.userRoles[username] && state.kickedUsers.has(username)) {
      delete state.userRoles[username];
    }
  }

  const renamesToRemove = [];
  for (const [oldUsername, newUsername] of Object.entries(state.usernameRenames)) {
    if (!state.activeUsers[oldUsername] && !state.activeUsers[newUsername]) {
      renamesToRemove.push(oldUsername);
    }
  }

  for (const oldUsername of renamesToRemove) {
    delete state.usernameRenames[oldUsername];
  }
}

function assignGlobalTasks() {
  const availableForGlobal = Object.keys(state.allTasks)
    .map(Number)
    .filter(taskId => !state.excludedFromGlobal.includes(taskId));

  state.globalTasks = [];
  const tasksCopy = [...availableForGlobal];
  while (state.globalTasks.length < 5 && tasksCopy.length > 0) {
    const randomIndex = Math.floor(Math.random() * tasksCopy.length);
    state.globalTasks.push(tasksCopy.splice(randomIndex, 1)[0]);
  }

  return state.globalTasks;
}

function assignIndividualTasksForUser(username) {
  const availableTasks = Object.keys(state.allTasks).map(Number);
  const selectedTasks = [];
  const tasksCopy = [...availableTasks];

  while (selectedTasks.length < 5 && tasksCopy.length > 0) {
    const randomIndex = Math.floor(Math.random() * tasksCopy.length);
    selectedTasks.push(tasksCopy.splice(randomIndex, 1)[0]);
  }

  if (selectedTasks.includes(5) && !selectedTasks.includes(10)) {
    const otherTasks = selectedTasks.filter(t => t !== 5);
    if (otherTasks.length > 0) {
      const taskToReplace = otherTasks[Math.floor(Math.random() * otherTasks.length)];
      const index = selectedTasks.indexOf(taskToReplace);
      selectedTasks[index] = 10;
    }
  }

  state.userIndividualTasks[username] = selectedTasks;

  if (state.usernameToId[username]) {
    const playerId = state.usernameToId[username];
    state.playerIndividualTasks[playerId] = selectedTasks;
  }

  return selectedTasks;
}

function calculateProgressPerTask() {
  if (Object.keys(state.userRoles).length === 0) {
    state.progressPerTask = 0;
    return;
  }

  const playerCount = Object.keys(state.userRoles).length;
  const denominator = (playerCount * 5) + 5;
  state.progressPerTask = denominator > 0 ? state.totalProgressPercentage / denominator : 0;
}

function assignAllTasks(usernames) {
  state.globalTasks = [];
  state.userIndividualTasks = {};

  assignGlobalTasks();

  for (const username of usernames) {
    assignIndividualTasksForUser(username);
  }

  calculateProgressPerTask();

  return {
    globalTasks: state.globalTasks,
    individualTasks: state.userIndividualTasks
  };
}

function getUserAllTasks(username) {
  const userTasks = [...state.globalTasks];

  let individualTasks = [];
  if (state.usernameToId[username]) {
    const playerId = state.usernameToId[username];
    if (state.playerIndividualTasks[playerId]) {
      individualTasks = state.playerIndividualTasks[playerId];
    }
  }

  if (individualTasks.length === 0 && state.userIndividualTasks[username]) {
    individualTasks = state.userIndividualTasks[username];
  }

  userTasks.push(...individualTasks);

  return [...new Set(userTasks)].sort((a, b) => a - b);
}

function canUserAccessTask(username, taskId) {
  if (!username || !state.gameStarted) {
    return false;
  }

  const userTasks = getUserAllTasks(username);

  if (!userTasks.includes(taskId)) {
    return false;
  }

  if (state.userCompletedTasks[username] && state.userCompletedTasks[username].has(taskId)) {
    return false;
  }

  return true;
}

// Routes
app.get('/', (req, res) => {
  res.render('index.html', { progress: state.currentProgress });
});

// Task routes
for (let i = 1; i <= 10; i++) {
  app.get(`/task${i}`, (req, res) => {
    const username = req.cookies.username;
    const gameStartedCookie = req.cookies.game_started;

    if (!username || !gameStartedCookie) {
      return res.render('not_in_game.html');
    }

    if (!canUserAccessTask(username, i)) {
      return res.render('not_in_game.html');
    }

    const templateMap = {
      1: 'swipecard.html',
      2: 'wire_connect.html',
      3: 'simon_says.html',
      4: 'keypad_entry.html',
      5: 'file_download.html',
      6: 'fuel_engines.html',
      7: 'align_engine.html',
      8: 'clear_o2.html',
      9: 'calibrate_distributor.html',
      10: 'upload_data.html'
    };

    res.render(templateMap[i], { progress: state.currentProgress, username });
  });
}

app.get('/admin', (req, res) => {
  res.render('admin.html', { last_task: state.lastCompletedTaskName });
});

app.get('/panel', (req, res) => {
  if (!req.session.panel_authenticated) {
    return res.render('panel_login.html', { error: null });
  }
  res.render('panel.html');
});

app.post('/panel', (req, res) => {
  const password = req.body.password || '';
  const correctPassword = process.env.PANEL_PASSWORD || '';

  if (password === correctPassword) {
    req.session.panel_authenticated = true;
    return res.redirect('/panel');
  }

  res.render('panel_login.html', { error: 'Incorrect password' });
});

app.get('/panel/join', (req, res) => {
  if (!req.session.panel_authenticated) {
    return res.redirect('/panel');
  }

  cleanupInactiveUsers();
  const gameInProgress = state.gameStarted && Object.values(state.userRoles).some(role => role);

  res.render('join.html', { game_in_progress: gameInProgress, debug_mode: true, error: null, kicked: false });
});

app.post('/panel/join', (req, res) => {
  if (!req.session.panel_authenticated) {
    return res.redirect('/panel');
  }

  const username = (req.body.username || '').trim();
  if (!username) {
    return res.render('join.html', { error: 'Please enter a username', debug_mode: true, game_in_progress: false, kicked: false });
  }

  cleanupInactiveUsers();

  const forceJoin = req.body.force_join === 'on';
  if (forceJoin && state.activeUsers[username]) {
    delete state.activeUsers[username];
    if (state.userSessions[username]) {
      delete state.userSessions[username];
    }
  }

  if (state.activeUsers[username] && !forceJoin) {
    delete state.activeUsers[username];
    if (state.userSessions[username]) {
      delete state.userSessions[username];
    }
  }

  if (!state.userRoles[username]) {
    state.userRoles[username] = null;
  }
  state.activeUsers[username] = Date.now();
  state.userSessions[username] = req.session.id || 'panel_debug';

  res.redirect(`/panel/user/${username}`);
});

app.get('/meetingbtn', (req, res) => {
  const username = req.cookies.username || 'No username';
  res.render('meetingbtn.html', { username });
});

app.get('/join', (req, res) => {
  cleanupInactiveUsers();
  const gameInProgress = state.gameStarted && Object.values(state.userRoles).some(role => role);
  const kicked = req.query.kicked === '1';

  res.render('join.html', { game_in_progress: gameInProgress, kicked, error: null, debug_mode: false });
});

app.post('/join', (req, res) => {
  const username = (req.body.username || '').trim();
  if (!username) {
    return res.render('join.html', { error: 'Please enter a username', game_in_progress: false, kicked: false, debug_mode: false });
  }

  cleanupInactiveUsers();
  if (state.activeUsers[username]) {
    return res.render('join.html', { 
      error: `Username '${username}' is already taken. If you want to use this name, the current user must leave first.`,
      game_in_progress: false,
      kicked: false,
      debug_mode: false
    });
  }

  res.redirect(`/user/${username}`);
});

app.get('/panel/user/:username', (req, res) => {
  if (!req.session.panel_authenticated) {
    return res.redirect('/panel');
  }

  const username = req.params.username;
  cleanupInactiveUsers();

  if (state.usernameRenames[username]) {
    const newUsername = state.usernameRenames[username];
    return res.redirect(`/panel/user/${newUsername}`);
  }

  if (state.kickedUsers.has(username)) {
    return res.redirect('/join?kicked=1');
  }

  const role = state.userRoles[username] || null;

  const otherImposters = [];
  if (role && role.startsWith('Imposter')) {
    for (const [user, userRole] of Object.entries(state.userRoles)) {
      if (user !== username && userRole && userRole.startsWith('Imposter')) {
        otherImposters.push(user);
      }
    }
  }

  res.render('panel_user.html', {
    username,
    role,
    other_imposters: otherImposters,
    reset_time: state.lastResetTime
  });
});

app.get('/user/:username', (req, res) => {
  const username = req.params.username;
  cleanupInactiveUsers();

  if (state.usernameRenames[username]) {
    const newUsername = state.usernameRenames[username];
    return res.redirect(`/user/${newUsername}`);
  }

  if (state.kickedUsers.has(username)) {
    return res.redirect('/join?kicked=1');
  }

  if (state.userRoles && !state.userRoles[username] && req.cookies.username === username) {
    return res.redirect('/join?kicked=1');
  }

  if (!req.session.session_id) {
    req.session.session_id = uuidv4();
    req.session.created_time = Date.now();
  } else {
    const sessionCreatedTime = req.session.created_time || 0;
    if (sessionCreatedTime < state.lastSessionInvalidation) {
      req.session.destroy();
      return res.redirect('/join');
    }
  }

  const currentSessionId = req.session.session_id;

  if (state.userSessions[username]) {
    const storedSessionId = state.userSessions[username];
    if (storedSessionId !== currentSessionId) {
      return res.render('duplicate_name.html', { username });
    }
  }

  if (!state.userRoles[username]) {
    state.userRoles[username] = null;
  }
  state.activeUsers[username] = Date.now();
  state.userSessions[username] = currentSessionId;

  const role = state.userRoles[username] || null;

  const otherImposters = [];
  if (role && role.startsWith('Imposter')) {
    for (const [otherUser, otherRole] of Object.entries(state.userRoles)) {
      if (otherUser !== username && otherRole && otherRole.startsWith('Imposter')) {
        otherImposters.push(otherUser);
      }
    }
  }

  res.cookie('username', username, { maxAge: 24 * 60 * 60 * 1000 });
  if (state.gameStarted || Object.values(state.userRoles).some(r => r)) {
    res.cookie('game_started', 'true', { maxAge: 24 * 60 * 60 * 1000 });
  }

  res.render('user.html', {
    username,
    role,
    progress: state.currentProgress,
    other_imposters: otherImposters,
    reset_time: state.lastResetTime
  });
});

// API Routes
app.get('/api/progress', (req, res) => {
  const responseData = { progress: state.currentProgress };
  if (state.currentProgress === -3) {
    responseData.dead_username = state.deadUsername;
    responseData.reporter_username = state.reporterUsername;
  } else if (state.currentProgress === -2) {
    responseData.caller_username = state.callerUsername;
  }
  res.json(responseData);
});

app.post('/api/progress', (req, res) => {
  const data = req.body;
  if (data && 'progress' in data) {
    const newProgress = parseFloat(data.progress);
    if (newProgress >= 0 && newProgress <= 100) {
      state.currentProgress = newProgress;
      return res.json({ success: true, progress: state.currentProgress });
    }
    return res.status(400).json({ success: false, error: 'Progress must be between 0 and 100' });
  }
  res.status(400).json({ success: false, error: 'Missing progress value' });
});

app.post('/api/addprogress', (req, res) => {
  const data = req.body;
  if (data && 'progress' in data) {
    let newProgress = parseFloat(data.progress) + state.currentProgress;
    if (newProgress > 100) {
      state.currentProgress = 100;
    } else {
      state.currentProgress = newProgress;
    }
    return res.json({ success: true, progress: state.currentProgress });
  }
  res.status(400).json({ success: false, error: 'Missing progress value' });
});

app.post('/api/removeprogress', (req, res) => {
  const data = req.body;
  if (data && 'progress' in data) {
    let newProgress = state.currentProgress - parseFloat(data.progress);
    if (newProgress > 100) {
      state.currentProgress = 100;
    } else {
      state.currentProgress = newProgress;
    }
    return res.json({ success: true, progress: state.currentProgress });
  }
  res.status(400).json({ success: false, error: 'Missing progress value' });
});

app.post('/api/defeat', (req, res) => {
  state.currentProgress = -1;
  res.json({ success: true, progress: state.currentProgress });
});

app.post('/api/meeting', (req, res) => {
  state.oldProgress = state.currentProgress;
  state.currentProgress = -2;
  state.callerUsername = req.cookies.username || 'Anonymous';
  res.json({ success: true, progress: state.currentProgress });
});

app.post('/api/endmeeting', (req, res) => {
  state.currentProgress = state.oldProgress;
  state.deadUsername = '';
  state.reporterUsername = '';
  state.callerUsername = '';
  res.json({ success: true, progress: state.currentProgress });
});

app.post('/api/assign-roles', (req, res) => {
  cleanupInactiveUsers();

  const activeUsernames = Object.keys(state.userRoles).filter(username => state.activeUsers[username]);

  if (activeUsernames.length === 0) {
    return res.status(400).json({ success: false, error: 'No active users found' });
  }

  const playerCount = activeUsernames.length;

  let imposterCount;
  if (playerCount <= 6) {
    imposterCount = 1;
  } else if (playerCount <= 10) {
    imposterCount = 2;
  } else {
    imposterCount = 3;
  }

  const imposters = [];
  const usersCopy = [...activeUsernames];
  while (imposters.length < Math.min(imposterCount, playerCount)) {
    const randomIndex = Math.floor(Math.random() * usersCopy.length);
    imposters.push(usersCopy.splice(randomIndex, 1)[0]);
  }

  for (const username of activeUsernames) {
    if (imposters.includes(username)) {
      const imposterIndex = imposters.indexOf(username) + 1;
      state.userRoles[username] = `Imposter${imposterIndex}`;
    } else {
      state.userRoles[username] = 'Crewmate';
    }
  }

  const taskAssignments = assignAllTasks(activeUsernames);
  state.gameStarted = true;

  const response = {
    success: true,
    message: `Game started! Roles and tasks assigned to ${playerCount} users (${imposterCount} imposters)`,
    assignments: state.userRoles,
    imposter_count: imposterCount,
    global_tasks: state.globalTasks.map(taskId => ({ id: taskId, name: state.allTasks[taskId] })),
    task_assignments: taskAssignments
  };

  res.cookie('game_started', 'true', { maxAge: 24 * 60 * 60 * 1000 });
  res.json(response);
});

app.post('/api/reset-roles', (req, res) => {
  for (const username in state.userRoles) {
    state.userRoles[username] = null;
  }

  state.userSessions = {};
  state.usernameRenames = {};
  state.kickedUsers.clear();
  state.activeUsers = {};

  state.globalTasks = [];
  state.userIndividualTasks = {};
  state.playerIndividualTasks = {};
  state.uniqueCompletions = new Set();
  state.progressPerTask = 0;
  state.taskCompletions = [];
  state.lastCompletedTaskName = '';
  state.gameStarted = false;

  state.lastResetTime = Date.now();
  state.lastSessionInvalidation = Date.now();

  res.clearCookie('username');
  res.clearCookie('game_started');
  res.json({
    success: true,
    message: `Roles reset for ${Object.keys(state.userRoles).length} users`,
    users_cleared: Object.keys(state.userRoles),
    reset_time: state.lastResetTime,
    sessions_invalidated: true
  });
});

app.post('/api/ping', (req, res) => {
  const data = req.body;
  const username = data.username;
  if (username) {
    if (state.kickedUsers.has(username)) {
      return res.status(403).json({ success: false, error: 'User has been kicked' });
    }
    state.activeUsers[username] = Date.now();
    return res.json({ success: true });
  }
  res.status(400).json({ success: false, error: 'Username required' });
});

app.get('/api/players', (req, res) => {
  cleanupInactiveUsers();
  const activeUsernames = Object.keys(state.userRoles).filter(username => state.activeUsers[username]);

  res.json({
    success: true,
    players: activeUsernames,
    count: activeUsernames.length
  });
});

app.post('/api/rename-player', (req, res) => {
  const data = req.body;
  if (!data || !data.old_username || !data.new_username) {
    return res.status(400).json({ success: false, error: 'Missing username data' });
  }

  const oldUsername = data.old_username;
  const newUsername = data.new_username.trim();

  if (!newUsername || newUsername.length > 20) {
    return res.status(400).json({ success: false, error: 'Invalid username' });
  }

  if (!state.userRoles[oldUsername]) {
    return res.status(404).json({ success: false, error: 'Player not found' });
  }

  if (state.userRoles[newUsername] && newUsername !== oldUsername) {
    return res.status(400).json({ success: false, error: 'Username already taken' });
  }

  if (state.userRoles[oldUsername]) {
    state.userRoles[newUsername] = state.userRoles[oldUsername];
    delete state.userRoles[oldUsername];
  }

  if (state.activeUsers[oldUsername]) {
    state.activeUsers[newUsername] = state.activeUsers[oldUsername];
    delete state.activeUsers[oldUsername];
  }

  if (state.userSessions[oldUsername]) {
    state.userSessions[newUsername] = state.userSessions[oldUsername];
    delete state.userSessions[oldUsername];
  }

  state.usernameRenames[oldUsername] = newUsername;

  res.json({
    success: true,
    message: `Player renamed from ${oldUsername} to ${newUsername}`,
    old_username: oldUsername,
    new_username: newUsername
  });
});

app.post('/api/kick-player', (req, res) => {
  const data = req.body;
  if (!data || !data.username) {
    return res.status(400).json({ success: false, error: 'Missing username' });
  }

  const username = data.username;

  if (!state.userRoles[username]) {
    return res.status(404).json({ success: false, error: 'Player not found' });
  }

  if (state.userRoles[username]) {
    delete state.userRoles[username];
  }

  if (state.activeUsers[username]) {
    delete state.activeUsers[username];
  }

  if (state.userSessions[username]) {
    delete state.userSessions[username];
  }

  state.kickedUsers.add(username);

  res.json({
    success: true,
    message: `${username} has been kicked from the game`,
    kicked_username: username
  });
});

app.get('/api/reset-status', (req, res) => {
  res.json({
    success: true,
    last_reset_time: state.lastResetTime
  });
});

app.get('/api/check-rename/:old_username/:new_username', (req, res) => {
  const { old_username, new_username } = req.params;
  const isRenamed = state.usernameRenames[old_username] === new_username;
  res.json({
    success: true,
    is_renamed: isRenamed
  });
});

app.get('/api/user-tasks', (req, res) => {
  const username = req.cookies.username;

  if (!username) {
    return res.status(401).json({ success: false, error: 'Not logged in - username cookie missing' });
  }

  if (!state.gameStarted) {
    return res.status(400).json({ success: false, error: 'Game not started yet' });
  }

  if (!state.userIndividualTasks[username]) {
    assignIndividualTasksForUser(username);
  }

  const userTasks = getUserAllTasks(username);
  const completedTasks = state.userCompletedTasks[username] || new Set();

  const taskList = [];
  for (const taskId of userTasks) {
    if (!completedTasks.has(taskId)) {
      taskList.push({
        id: taskId,
        name: state.allTasks[taskId],
        url: `/task${taskId}`,
        type: state.globalTasks.includes(taskId) ? 'global' : 'individual'
      });
    }
  }

  const globalTasksAssigned = state.globalTasks.filter(t => userTasks.includes(t));
  const individualTasksAssigned = userTasks.filter(t => !state.globalTasks.includes(t));

  const globalCompleted = globalTasksAssigned.filter(t => completedTasks.has(t)).length;
  const individualCompleted = individualTasksAssigned.filter(t => completedTasks.has(t)).length;

  const allTasksComplete = (globalCompleted === globalTasksAssigned.length && 
                           individualCompleted === individualTasksAssigned.length);

  res.json({
    success: true,
    tasks: taskList,
    global_tasks: state.globalTasks.filter(taskId => !completedTasks.has(taskId))
      .map(taskId => ({ id: taskId, name: state.allTasks[taskId] })),
    individual_tasks: (state.userIndividualTasks[username] || []).filter(taskId => !completedTasks.has(taskId))
      .map(taskId => ({ id: taskId, name: state.allTasks[taskId] })),
    completion_status: {
      all_complete: allTasksComplete,
      global_completed: globalCompleted,
      global_total: globalTasksAssigned.length,
      individual_completed: individualCompleted,
      individual_total: individualTasksAssigned.length,
      completed_task_ids: Array.from(completedTasks)
    }
  });
});

app.post('/api/task-completed', (req, res) => {
  const data = req.body;
  const username = data.username;
  const taskName = data.task_name || 'Unknown Task';

  const cookieUsername = req.cookies.username;
  if (!cookieUsername || cookieUsername !== username) {
    return res.status(403).json({ success: false, error: 'Authentication mismatch' });
  }

  if (username) {
    const userRole = state.userRoles[username] || '';
    const isImposter = userRole && userRole.startsWith('Imposter');

    let taskId = null;
    for (const [tid, tname] of Object.entries(state.allTasks)) {
      if (tname === taskName) {
        taskId = parseInt(tid);
        break;
      }
    }

    if (!isImposter && taskId && state.usernameToId[username]) {
      const playerId = state.usernameToId[username];
      state.uniqueCompletions.add(`${playerId}-${taskId}`);
    }

    if (taskId) {
      if (!state.userCompletedTasks[username]) {
        state.userCompletedTasks[username] = new Set();
      }
      state.userCompletedTasks[username].add(taskId);
    }

    const completion = {
      username,
      task_name: taskName,
      timestamp: Date.now(),
      id: uuidv4(),
      is_imposter: isImposter
    };
    state.taskCompletions.push(completion);

    state.lastCompletedTaskName = isImposter ? `${taskName} (FAKE)` : taskName;

    const currentTime = Date.now();
    state.taskCompletions = state.taskCompletions.filter(tc => currentTime - tc.timestamp < 15000);

    return res.json({ success: true, message: `${username} completed ${taskName}` });
  }
  res.status(400).json({ success: false, error: 'Username required' });
});

app.get('/api/latest-task-completion', (req, res) => {
  const currentTime = Date.now();
  state.taskCompletions = state.taskCompletions.filter(tc => currentTime - tc.timestamp < 15000);

  if (state.taskCompletions.length > 0) {
    const latestCompletion = state.taskCompletions.reduce((latest, current) => 
      current.timestamp > latest.timestamp ? current : latest
    );
    return res.json({
      success: true,
      task_completion: latestCompletion
    });
  }
  res.json({ success: true, task_completion: null });
});

app.get('/api/last-completed-task', (req, res) => {
  res.json({
    success: true,
    last_task: state.lastCompletedTaskName
  });
});

app.post('/api/set-progress-percentage', (req, res) => {
  if (state.gameStarted) {
    return res.status(400).json({ success: false, error: 'Cannot change progress percentage while game is running' });
  }

  const data = req.body;
  const percentage = data.percentage;

  if (!percentage || typeof percentage !== 'number' || percentage <= 0) {
    return res.status(400).json({ success: false, error: 'Invalid percentage value' });
  }

  state.totalProgressPercentage = percentage;
  res.json({ success: true, message: `Progress percentage set to ${percentage}%` });
});

app.get('/body', (req, res) => {
  const username = req.query.username;
  if (!username) {
    return res.status(400).json({ success: false, error: 'Username parameter required' });
  }

  state.oldProgress = state.currentProgress;
  state.currentProgress = -3;
  state.deadUsername = username;
  state.reporterUsername = req.cookies.username || 'Anonymous';

  res.json({
    success: true,
    progress: state.currentProgress,
    dead_username: state.deadUsername,
    reporter_username: state.reporterUsername
  });
});

app.get('/reportbody', (req, res) => {
  res.render('reportbody.html', { error: null });
});

app.post('/reportbody', (req, res) => {
  const username = (req.body.username || '').trim();
  if (!username) {
    return res.render('reportbody.html', { error: 'Please enter a username' });
  }

  res.redirect(`/body?username=${encodeURIComponent(username)}`);
});

app.get('/meeting', (req, res) => {
  state.oldProgress = state.currentProgress;
  state.currentProgress = -2;
  state.callerUsername = req.cookies.username || 'Anonymous';

  res.json({
    success: true,
    progress: state.currentProgress,
    caller_username: state.callerUsername
  });
});

app.get('/endmeeting', (req, res) => {
  state.currentProgress = state.oldProgress;
  state.deadUsername = '';
  state.reporterUsername = '';
  state.callerUsername = '';
  res.json({ success: true, progress: state.currentProgress });
});

app.get('/api/current-roles', (req, res) => {
  cleanupInactiveUsers();

  const activeRoles = {};
  for (const [username, role] of Object.entries(state.userRoles)) {
    if (state.activeUsers[username] && role) {
      activeRoles[username] = role;
    }
  }

  res.json({
    success: true,
    roles: activeRoles,
    game_started: state.gameStarted,
    active_player_count: Object.keys(activeRoles).length
  });
});

app.get('/test', (req, res) => {
  function simulateProgress() {
    let i = 0;
    const interval = setInterval(() => {
      if (i > 100) {
        clearInterval(interval);
        return;
      }
      state.currentProgress = i;
      i += 5;
    }, 500);
  }

  simulateProgress();
  res.send('<h3>Progress simulation started!</h3><p>Go back to <a href="/">main page</a> to see live updates.</p>');
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});

module.exports = app;
