import os
import logging
import random
import time
from flask import Flask, render_template, jsonify, request, redirect, url_for, session
import uuid

# Configure logging for debugging
logging.basicConfig(level=logging.DEBUG)

# Create the Flask app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET")

# Global variable to store current progress (0-100)
current_progress = 0
old_progress = 0
dead_username = ""
reporter_username = ""
caller_username = ""

# Role assignment system
available_roles = ["Imposter1", "Imposter2", "Imposter3", "Crewmate"]  # Configurable list of roles
user_roles = {}  # Dictionary to track username -> role assignments
active_users = {}  # Dictionary to track username -> last ping time
user_sessions = {}  # Dictionary to track username -> session identifier for duplicate checking
username_renames = {}  # Dictionary to track old_username -> new_username for redirects
kicked_users = set()  # Set to track users who have been kicked and should not be allowed back
last_reset_time = time.time()  # Track when roles were last reset
last_session_invalidation = 0  # Track when sessions were last invalidated
task_completions = []  # Track recent task completions
game_started = False  # Track if roles have been assigned (game started)
last_completed_task_name = ""  # Track the name of the last completed task

# Task assignment system
all_tasks = {
    1: "Swipe Card",
    2: "Fix Wiring", 
    3: "Memory Sequence",
    4: "Enter Access Code",
    5: "Download Data",
    6: "Fuel Engines",
    7: "Align Engine Output",
    8: "Clear O2 Filter",
    9: "Calibrate Distributor",
    10: "Upload Data"
}

# Tasks that cannot be in global assignments
excluded_from_global = [5, 10]  # Download and Upload Data

# Task assignments for current game
global_tasks = []  # 5 tasks that everyone gets
user_individual_tasks = {}  # Dictionary: username -> list of 5 individual task numbers (legacy)
player_individual_tasks = {}  # Dictionary: player_id -> list of 5 individual task numbers

# Progress calculation system
total_progress_percentage = 150  # Default 150% - configurable
progress_per_task = 0  # Calculated dynamically based on number of players
unique_completions = set()  # Track unique (player_id, task_id) completions by crewmates
user_completed_tasks = {}  # Track completed tasks per user: username -> set of task_ids

# ID-based user management (new system)
player_counter = 1  # Counter for generating unique player IDs
players = {}  # Dictionary to track player_id -> {'username': str, 'role': str, 'active': bool, 'last_ping': float, 'session_id': str, 'kicked': bool}
username_to_id = {}  # Dictionary to track username -> player_id mappings

def cleanup_inactive_users():
    """Remove users who haven't pinged in the last 25 seconds"""
    current_time = time.time()
    inactive_threshold = 25  # seconds
    
    inactive_users = []
    for username, last_ping in list(active_users.items()):
        if current_time - last_ping > inactive_threshold:
            inactive_users.append(username)
    
    for username in inactive_users:
        del active_users[username]
        if username in user_sessions:
            del user_sessions[username]  # Remove session tracking
        if username in user_roles:
            # Only completely remove kicked users from user_roles
            # For regular inactive users, keep their role assignment intact
            if username in kicked_users:
                del user_roles[username]  # Remove kicked users completely
            # Don't modify user_roles for regular inactive users - let them keep their roles
    
    # Clean up old rename mappings for inactive users
    renames_to_remove = []
    for old_username, new_username in list(username_renames.items()):
        # Remove rename mapping if both old and new usernames are inactive
        if old_username not in active_users and new_username not in active_users:
            renames_to_remove.append(old_username)
    
    for old_username in renames_to_remove:
        del username_renames[old_username]

def assign_global_tasks():
    """Assign 5 random global tasks (excluding download/upload data)"""
    global global_tasks
    
    # Get tasks that can be global (exclude download/upload data)
    available_for_global = [task_id for task_id in all_tasks.keys() if task_id not in excluded_from_global]
    
    # Randomly select 5 tasks for global assignment
    global_tasks = random.sample(available_for_global, 5)
    return global_tasks

def assign_individual_tasks_for_user(username):
    """Assign 5 random individual tasks for a specific user"""
    global user_individual_tasks, player_individual_tasks
    
    # Get all available tasks
    available_tasks = list(all_tasks.keys())
    
    # Randomly select 5 tasks
    selected_tasks = random.sample(available_tasks, 5)
    
    # Check if download data (task 5) is selected
    if 5 in selected_tasks:
        # If download data is selected, ensure upload data (task 10) is also included
        if 10 not in selected_tasks:
            # Replace one random task (not download data) with upload data
            other_tasks = [t for t in selected_tasks if t != 5]
            if other_tasks:
                task_to_replace = random.choice(other_tasks)
                selected_tasks[selected_tasks.index(task_to_replace)] = 10
    
    # Store by username (for backward compatibility)
    user_individual_tasks[username] = selected_tasks
    
    # Also store by player_id if we can find it
    if username in username_to_id:
        player_id = username_to_id[username]
        player_individual_tasks[player_id] = selected_tasks
    
    return selected_tasks

def calculate_progress_per_task():
    """Calculate how much progress each task should give based on total players and configured percentage"""
    global progress_per_task
    
    if not user_roles:
        progress_per_task = 0
        return
    
    # Count total number of players (all players, not just crewmates)
    player_count = len(user_roles)
    
    if player_count == 0:
        progress_per_task = 0
        return
    
    # Calculate progress per task using formula: total_progress_percentage / [(amount of players * 5) + 5]
    denominator = (player_count * 5) + 5
    progress_per_task = (total_progress_percentage / denominator) if denominator > 0 else 0

def assign_all_tasks(usernames):
    """Assign tasks for all users in the game"""
    global global_tasks, user_individual_tasks
    
    # Clear previous assignments
    global_tasks = []
    user_individual_tasks = {}
    
    # Assign global tasks
    assign_global_tasks()
    
    # Assign individual tasks for each user
    for username in usernames:
        assign_individual_tasks_for_user(username)
    
    # Calculate progress per task based on number of players
    calculate_progress_per_task()
    
    return {
        'global_tasks': global_tasks,
        'individual_tasks': user_individual_tasks
    }

def get_user_all_tasks(username):
    """Get all tasks (global + individual) for a specific user"""
    user_tasks = []
    
    # Add global tasks
    user_tasks.extend(global_tasks)
    
    # Add individual tasks - try player_id first, then fall back to username
    individual_tasks = []
    if username in username_to_id:
        player_id = username_to_id[username]
        if player_id in player_individual_tasks:
            individual_tasks = player_individual_tasks[player_id]
    
    # Fall back to username-based lookup if no player_id tasks found
    if not individual_tasks and username in user_individual_tasks:
        individual_tasks = user_individual_tasks[username]
    
    user_tasks.extend(individual_tasks)
    
    # Remove duplicates and sort
    user_tasks = sorted(list(set(user_tasks)))
    
    return user_tasks

def can_user_access_task(username, task_id):
    """Check if a user can access a specific task (has it assigned and hasn't completed it)"""
    if not username or not game_started:
        return False
    
    # Get user's assigned tasks
    user_tasks = get_user_all_tasks(username)
    
    # Check if user has this task assigned
    if task_id not in user_tasks:
        return False
    
    # Check if user has already completed this task
    if username in user_completed_tasks and task_id in user_completed_tasks[username]:
        return False
    
    return True

@app.route('/')
def index():
    """Main page with only the progress bar"""
    return render_template('index.html', progress=current_progress)

@app.route('/task1')
def task1():
    """The page with the first task"""
    username = request.cookies.get('username')
    game_started_cookie = request.cookies.get('game_started')
    
    if not username or not game_started_cookie:
        return render_template('not_in_game.html')
    
    # Check if user can access this specific task
    if not can_user_access_task(username, 1):
        return render_template('not_in_game.html')
    
    return render_template('swipecard.html', progress=current_progress, username=username)

@app.route('/task2')
def task2():
    """Wire connection task"""
    username = request.cookies.get('username')
    game_started_cookie = request.cookies.get('game_started')
    
    if not username or not game_started_cookie:
        return render_template('not_in_game.html')
    
    # Check if user can access this specific task
    if not can_user_access_task(username, 2):
        return render_template('not_in_game.html')
    
    return render_template('wire_connect.html', progress=current_progress, username=username)

@app.route('/task3')
def task3():
    """Simon Says memory game task"""
    username = request.cookies.get('username')
    game_started_cookie = request.cookies.get('game_started')
    
    if not username or not game_started_cookie:
        return render_template('not_in_game.html')
    
    # Check if user can access this specific task
    if not can_user_access_task(username, 3):
        return render_template('not_in_game.html')
    
    return render_template('simon_says.html', progress=current_progress, username=username)

@app.route('/task4')
def task4():
    """Keypad entry puzzle task"""
    username = request.cookies.get('username')
    game_started_cookie = request.cookies.get('game_started')
    
    if not username or not game_started_cookie:
        return render_template('not_in_game.html')
    
    # Check if user can access this specific task
    if not can_user_access_task(username, 4):
        return render_template('not_in_game.html')
    
    return render_template('keypad_entry.html', progress=current_progress, username=username)

@app.route('/task5')
def task5():
    """File download progress simulation task"""
    username = request.cookies.get('username')
    game_started_cookie = request.cookies.get('game_started')
    
    if not username or not game_started_cookie:
        return render_template('not_in_game.html')
    
    # Check if user can access this specific task
    if not can_user_access_task(username, 5):
        return render_template('not_in_game.html')
    
    return render_template('file_download.html', progress=current_progress, username=username)

@app.route('/task6')
def task6():
    """Fuel engines task with draggable fuel cans"""
    username = request.cookies.get('username')
    game_started_cookie = request.cookies.get('game_started')
    
    if not username or not game_started_cookie:
        return render_template('not_in_game.html')
    
    # Check if user can access this specific task
    if not can_user_access_task(username, 6):
        return render_template('not_in_game.html')
    
    return render_template('fuel_engines.html', progress=current_progress, username=username)

@app.route('/task7')
def task7():
    """Align engine output with rotating dials task"""
    username = request.cookies.get('username')
    game_started_cookie = request.cookies.get('game_started')
    
    if not username or not game_started_cookie:
        return render_template('not_in_game.html')
    
    # Check if user can access this specific task
    if not can_user_access_task(username, 7):
        return render_template('not_in_game.html')
    
    return render_template('align_engine.html', progress=current_progress, username=username)

@app.route('/task8')
def task8():
    """Clear O2 filter by clicking debris task"""
    username = request.cookies.get('username')
    game_started_cookie = request.cookies.get('game_started')
    
    if not username or not game_started_cookie:
        return render_template('not_in_game.html')
    
    # Check if user can access this specific task
    if not can_user_access_task(username, 8):
        return render_template('not_in_game.html')
    
    return render_template('clear_o2.html', progress=current_progress, username=username)

@app.route('/task9')
def task9():
    """Calibrate distributor with timed clicking task"""
    username = request.cookies.get('username')
    game_started_cookie = request.cookies.get('game_started')
    
    if not username or not game_started_cookie:
        return render_template('not_in_game.html')
    
    # Check if user can access this specific task
    if not can_user_access_task(username, 9):
        return render_template('not_in_game.html')
    
    return render_template('calibrate_distributor.html', progress=current_progress, username=username)

@app.route('/task10')
def task10():
    """Upload data task with cookie validation"""
    username = request.cookies.get('username')
    game_started_cookie = request.cookies.get('game_started')
    
    if not username or not game_started_cookie:
        return render_template('not_in_game.html')
    
    # Check if user can access this specific task
    if not can_user_access_task(username, 10):
        return render_template('not_in_game.html')
    
    return render_template('upload_data.html', progress=current_progress, username=username)


@app.route('/admin')
def admin_page():
    """Admin page showing last completed task"""
    return render_template('admin.html', last_task=last_completed_task_name)

@app.route('/panel', methods=['GET', 'POST'])
def panel_page():
    """Control panel for game management"""
    if request.method == 'POST':
        # Handle password submission
        password = request.form.get('password', '')
        correct_password = os.environ.get("PANEL_PASSWORD", "")
        
        if password == correct_password:
            # Set session flag for authenticated access
            session['panel_authenticated'] = True
            return redirect(url_for('panel_page'))
        else:
            return render_template('panel_login.html', error="Incorrect password")
    
    # Check if user is authenticated
    if not session.get('panel_authenticated'):
        return render_template('panel_login.html')
    
    return render_template('panel.html')

@app.route('/panel/join', methods=['GET', 'POST'])
def panel_join():
    """Debug join page accessible through panel authentication - ignores cookies"""
    # Check if user is panel authenticated first
    if not session.get('panel_authenticated'):
        return redirect(url_for('panel_page'))
    
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        if not username:
            return render_template('join.html', error="Please enter a username", debug_mode=True)
        
        # Clean up inactive users
        cleanup_inactive_users()
        
        # For debug mode, we can optionally allow duplicate usernames by removing existing ones
        force_join = request.form.get('force_join') == 'on'
        if force_join and username in active_users:
            # Remove existing user
            del active_users[username]
            if username in user_sessions:
                del user_sessions[username]
        
        if username in active_users and not force_join:
            # In debug mode, automatically take over existing usernames for rapid testing
            del active_users[username]
            if username in user_sessions:
                del user_sessions[username]
        
        # Add user to the system directly without cookies
        if username not in user_roles:
            user_roles[username] = None
        active_users[username] = time.time()
        user_sessions[username] = session.get('session_id', 'panel_debug')
        
        return redirect(url_for('panel_user_page', username=username))
    
    # Clean up inactive users and show join form
    cleanup_inactive_users()
    game_in_progress = game_started and any(role for role in user_roles.values() if role)
    
    return render_template('join.html', game_in_progress=game_in_progress, debug_mode=True)

@app.route('/meetingbtn')
def meetingbtn_page():
    """Meeting button page showing username and meeting controls"""
    username = request.cookies.get('username', 'No username')
    return render_template('meetingbtn.html', username=username)

@app.route('/join')
def join_page():
    """Join page where users enter their username"""
    # Check if game is in progress (roles assigned)
    cleanup_inactive_users()
    game_in_progress = game_started and any(role for role in user_roles.values() if role)
    
    # Check if user was kicked (from URL parameter)
    kicked = request.args.get('kicked') == '1'
    
    return render_template('join.html', game_in_progress=game_in_progress, kicked=kicked)

@app.route('/join', methods=['POST'])
def join_submit():
    """Handle join form submission"""
    username = request.form.get('username', '').strip()
    if not username:
        return render_template('join.html', error="Please enter a username")
    
    # Check if username is already taken by an active user
    cleanup_inactive_users()
    if username in active_users:
        return render_template('join.html', error=f"Username '{username}' is already taken. If you want to use this name, the current user must leave first.")
    
    return redirect(url_for('user_page', username=username))

@app.route('/panel/user/<username>')
def panel_user_page(username):
    """Panel user page for debug joins - no cookie warnings"""
    # Check panel authentication
    if not session.get('panel_authenticated'):
        return redirect(url_for('panel_page'))
    
    # Clean up inactive users first
    cleanup_inactive_users()
    
    # Check if this username was renamed - if so, redirect to new username
    if username in username_renames:
        new_username = username_renames[username]
        return redirect(url_for('panel_user_page', username=new_username))
    
    # Check if this user has been kicked
    if username in kicked_users:
        return redirect(url_for('join_page') + '?kicked=1')
    
    # Get user's role (if any)
    role = user_roles.get(username)
    
    # Get other imposters if this user is an imposter
    other_imposters = []
    if role and role.startswith('Imposter'):
        other_imposters = [user for user, user_role in user_roles.items() 
                          if user != username and user_role and user_role.startswith('Imposter')]
    
    return render_template('panel_user.html', 
                         username=username, 
                         role=role, 
                         other_imposters=other_imposters,
                         reset_time=last_reset_time)

@app.route('/user/<username>')
def user_page(username):
    """User page to display assigned role"""
    # Clean up inactive users first
    cleanup_inactive_users()
    
    # Check if this username was renamed - if so, redirect to new username
    if username in username_renames:
        new_username = username_renames[username]
        return redirect(url_for('user_page', username=new_username))
    
    # Check if this user has been kicked
    if username in kicked_users:
        return redirect(url_for('join_page') + '?kicked=1')
    
    # Check if this user has been kicked (no longer exists in user_roles)
    # But only if they previously owned this username in this browser (have the cookie)
    if user_roles and username not in user_roles and request.cookies.get('username') == username:
        return redirect(url_for('join_page') + '?kicked=1')
    
    # Create a unique session identifier for each browser/tab first
    if 'session_id' not in session:
        session['session_id'] = str(uuid.uuid4())
        session['created_time'] = time.time()
        session.permanent = False  # Ensure session doesn't persist across browser instances
    else:
        # Check if existing session has been invalidated by role reset
        session_created_time = session.get('created_time', 0)
        if session_created_time < last_session_invalidation:
            # Session is invalid - clear it and redirect to join page
            session.clear()
            return redirect(url_for('join_page'))
    
    current_session_id = session['session_id']
    
    # Check if this username is taken by someone else (different session)
    if username in user_sessions:
        stored_session_id = user_sessions[username]
        if stored_session_id != current_session_id:
            # Username is taken by a different session - show duplicate page
            return render_template('duplicate_name.html', username=username)
    
    # Add user to the system and mark as active
    if username not in user_roles:
        user_roles[username] = None
    active_users[username] = time.time()
    user_sessions[username] = current_session_id  # Track session for this username
    
    role = user_roles.get(username, None)
    
    # Get list of other imposters if this user is an imposter
    other_imposters = []
    if role and role.startswith('Imposter'):
        for other_user, other_role in user_roles.items():
            if other_user != username and other_role and other_role.startswith('Imposter'):
                other_imposters.append(other_user)
    
    response = app.response_class(
        response=render_template('user.html', username=username, role=role, progress=current_progress, other_imposters=other_imposters, reset_time=last_reset_time),
        status=200,
        mimetype='text/html'
    )
    # Set username cookie for task completion tracking
    response.set_cookie('username', username, max_age=60*60*24)  # 24 hours
    
    # Set game started cookie if roles have been assigned
    if game_started or any(user_roles.values()):
        response.set_cookie('game_started', 'true', max_age=60*60*24)  # 24 hours
    
    return response

@app.route('/api/progress', methods=['GET', 'POST'])
def progress_api():
    """API endpoint to get or set progress"""
    global current_progress, dead_username, reporter_username
    
    if request.method == 'POST':
        data = request.get_json()
        if data and 'progress' in data:
            # Validate progress value (0-100)
            new_progress = float(data['progress'])
            if 0 <= new_progress <= 100:
                current_progress = new_progress
                return jsonify({'success': True, 'progress': current_progress})
            else:
                return jsonify({'success': False, 'error': 'Progress must be between 0 and 100'}), 400
        return jsonify({'success': False, 'error': 'Missing progress value'}), 400
    
    # GET request - return current progress and additional data
    response_data: dict[str, object] = {'progress': current_progress}
    if current_progress == -3:
        response_data['dead_username'] = dead_username
        response_data['reporter_username'] = reporter_username
    elif current_progress == -2:
        response_data['caller_username'] = caller_username
    return jsonify(response_data)


@app.route('/api/addprogress', methods=['POST'])
def addprogress_api():
    """API endpoint to get or set progress"""
    global current_progress

    data = request.get_json()
    if data and 'progress' in data:
        # Calculate new progress and cap at upper boundary only
        new_progress = float(data['progress'])+current_progress
        # Cap at 100% if it would exceed, allow going below 0%
        if new_progress > 100:
            current_progress = 100
        else:
            current_progress = new_progress
        return jsonify({'success': True, 'progress': current_progress})
    return jsonify({'success': False, 'error': 'Missing progress value'}), 400


@app.route('/api/removeprogress', methods=['POST'])
def removeprogress_api():
    """API endpoint to get or set progress"""
    global current_progress

    data = request.get_json()
    if data and 'progress' in data:
        # Calculate new progress and cap at upper boundary only
        new_progress = current_progress-float(data['progress'])
        # Cap at 100% if it would exceed, allow going below 0%
        if new_progress > 100:
            current_progress = 100
        else:
            current_progress = new_progress
        return jsonify({'success': True, 'progress': current_progress})
    return jsonify({'success': False, 'error': 'Missing progress value'}), 400

@app.route('/api/defeat', methods=['POST'])
def defeat_api():
    """API endpoint to set defeat"""
    global current_progress

    current_progress = -1
    return jsonify({'success': True, 'progress': current_progress})

@app.route('/api/meeting', methods=['POST'])
def meeting_api():
    """API endpoint to set meeting"""
    global current_progress, old_progress, caller_username
    old_progress = current_progress
    current_progress = -2
    
    # Try to get caller from session/cookie or default
    caller_username = request.cookies.get('username', 'Anonymous')
    
    return jsonify({'success': True, 'progress': current_progress})


@app.route('/api/endmeeting', methods=['POST'])
def endmeeting_api():
    """API endpoint to end meeting (emergency or dead body)"""
    global current_progress, old_progress, dead_username, reporter_username, caller_username

    current_progress = old_progress
    # Clear meeting data
    dead_username = ""
    reporter_username = ""
    caller_username = ""
    return jsonify({'success': True, 'progress': current_progress})


@app.route('/api/assign-roles', methods=['POST'])
def assign_roles_api():
    """API endpoint to assign roles to all users"""
    global user_roles
    
    # Clean up inactive users first
    cleanup_inactive_users()
    
    # Get active users only
    active_usernames = [username for username in user_roles.keys() if username in active_users]
    
    if not active_usernames:
        return jsonify({'success': False, 'error': 'No active users found'}), 400
    
    player_count = len(active_usernames)
    
    # Determine number of imposters based on player count
    if player_count <= 6:
        imposter_count = 1
    elif player_count <= 10:
        imposter_count = 2
    else:
        imposter_count = 3
    
    # Randomly select imposters
    imposters = random.sample(active_usernames, min(imposter_count, player_count))
    
    # Assign roles
    for username in active_usernames:
        if username in imposters:
            # Assign Imposter1, Imposter2, or Imposter3 based on order
            imposter_index = imposters.index(username) + 1
            user_roles[username] = f"Imposter{imposter_index}"
        else:
            user_roles[username] = "Crewmate"
    
    # Assign tasks for all players
    task_assignments = assign_all_tasks(active_usernames)
    
    global game_started
    game_started = True
    
    response = jsonify({
        'success': True, 
        'message': f'Game started! Roles and tasks assigned to {player_count} users ({imposter_count} imposters)',
        'assignments': user_roles,
        'imposter_count': imposter_count,
        'global_tasks': [{'id': task_id, 'name': all_tasks[task_id]} for task_id in global_tasks],
        'task_assignments': task_assignments
    })
    # Set game started cookie
    response.set_cookie('game_started', 'true', max_age=60*60*24)  # 24 hours
    return response


@app.route('/api/reset-roles', methods=['POST'])
def reset_roles_api():
    """API endpoint to reset all user roles"""
    global user_roles, last_reset_time, user_sessions, last_session_invalidation, game_started
    
    # Clear all role assignments
    for username in user_roles:
        user_roles[username] = None
    
    # Clear all session tracking
    user_sessions.clear()
    
    # Clear all rename mappings
    username_renames.clear()
    
    # Clear kicked users list (allow everyone to rejoin)
    kicked_users.clear()
    
    # Clear active users (forces rejoin)
    active_users.clear()
    
    # Clear task assignments
    global global_tasks, user_individual_tasks, player_individual_tasks, unique_completions, progress_per_task
    global_tasks = []
    user_individual_tasks = {}
    player_individual_tasks = {}
    unique_completions = set()
    progress_per_task = 0
    
    # Clear task completions and reset progress tracking
    global task_completions, last_completed_task_name
    task_completions = []
    last_completed_task_name = ""
    
    # Reset game started status
    game_started = False
    
    # Update timestamps
    last_reset_time = time.time()
    last_session_invalidation = time.time()
    
    response = jsonify({
        'success': True, 
        'message': f'Roles reset for {len(user_roles)} users',
        'users_cleared': list(user_roles.keys()),
        'reset_time': last_reset_time,
        'sessions_invalidated': True
    })
    # Clear username and game started cookies to force rejoin
    response.set_cookie('username', '', expires=0)
    response.set_cookie('game_started', '', expires=0)
    return response


@app.route('/api/ping', methods=['POST'])
def ping_api():
    """API endpoint for users to ping their presence"""
    data = request.get_json()
    username = data.get('username')
    if username:
        # Don't allow pings from kicked users
        if username in kicked_users:
            return jsonify({'success': False, 'error': 'User has been kicked'}), 403
        
        active_users[username] = time.time()
        return jsonify({'success': True})
    return jsonify({'success': False, 'error': 'Username required'}), 400


@app.route('/api/players', methods=['GET'])
def players_api():
    """API endpoint to get list of active players"""
    cleanup_inactive_users()
    active_usernames = [username for username in user_roles.keys() if username in active_users]
    
    return jsonify({
        'success': True,
        'players': active_usernames,
        'count': len(active_usernames)
    })

@app.route('/api/rename-player', methods=['POST'])
def rename_player_api():
    """API endpoint to rename a player"""
    global user_roles, active_users, user_sessions, username_to_id
    
    data = request.get_json()
    if not data or not data.get('old_username') or not data.get('new_username'):
        return jsonify({'success': False, 'error': 'Missing username data'}), 400
    
    old_username = data['old_username']
    new_username = data['new_username'].strip()
    
    # Validate new username
    if not new_username or len(new_username) > 20:
        return jsonify({'success': False, 'error': 'Invalid username'}), 400
    
    # Check if old username exists
    if old_username not in user_roles:
        return jsonify({'success': False, 'error': 'Player not found'}), 404
    
    # Check if new username is already taken
    if new_username in user_roles and new_username != old_username:
        return jsonify({'success': False, 'error': 'Username already taken'}), 400
    
    # Perform the rename
    if old_username in user_roles:
        user_roles[new_username] = user_roles[old_username]
        del user_roles[old_username]
    
    if old_username in active_users:
        active_users[new_username] = active_users[old_username]
        del active_users[old_username]
    
    if old_username in user_sessions:
        user_sessions[new_username] = user_sessions[old_username]
        del user_sessions[old_username]
    
    # Add to rename mapping so user gets redirected to new username
    username_renames[old_username] = new_username
    
    return jsonify({
        'success': True,
        'message': f'Player renamed from {old_username} to {new_username}',
        'old_username': old_username,
        'new_username': new_username
    })

@app.route('/api/kick-player', methods=['POST'])
def kick_player_api():
    """API endpoint to kick a player from the game"""
    global user_roles, active_users, user_sessions
    
    data = request.get_json()
    if not data or not data.get('username'):
        return jsonify({'success': False, 'error': 'Missing username'}), 400
    
    username = data['username']
    
    # Check if player exists
    if username not in user_roles:
        return jsonify({'success': False, 'error': 'Player not found'}), 404
    
    # Remove player from all tracking
    if username in user_roles:
        del user_roles[username]
    
    if username in active_users:
        del active_users[username]
    
    if username in user_sessions:
        del user_sessions[username]
    
    # Add to kicked users set to prevent rejoining
    kicked_users.add(username)
    
    return jsonify({
        'success': True,
        'message': f'{username} has been kicked from the game',
        'kicked_username': username
    })

@app.route('/api/reset-status', methods=['GET'])
def reset_status_api():
    """API endpoint to check if roles have been reset"""
    return jsonify({
        'success': True,
        'last_reset_time': last_reset_time
    })

@app.route('/api/check-rename/<old_username>/<new_username>')
def check_rename_api(old_username, new_username):
    """API endpoint to check if old_username was renamed to new_username"""
    is_renamed = username_renames.get(old_username) == new_username
    return jsonify({
        'success': True,
        'is_renamed': is_renamed
    })

@app.route('/api/user-tasks', methods=['GET'])
def get_user_tasks_api():
    """API endpoint to get assigned tasks for the current user"""
    # Get username from cookie only (security - don't trust query params)
    username = request.cookies.get('username')
    
    if not username:
        return jsonify({'success': False, 'error': 'Not logged in - username cookie missing'}), 401
    
    if not game_started:
        return jsonify({'success': False, 'error': 'Game not started yet'}), 400
    
    # Handle late joiners - assign tasks if user doesn't have any yet
    if username not in user_individual_tasks:
        assign_individual_tasks_for_user(username)
    
    # Get user's tasks
    user_tasks = get_user_all_tasks(username)
    
    # Get user's completed tasks
    completed_tasks = user_completed_tasks.get(username, set())
    
    # Filter out completed tasks and convert to task info
    task_list = []
    for task_id in user_tasks:
        if task_id not in completed_tasks:
            task_list.append({
                'id': task_id,
                'name': all_tasks[task_id],
                'url': f'/task{task_id}',
                'type': 'global' if task_id in global_tasks else 'individual'
            })
    
    # Check completion status
    global_tasks_assigned = [t for t in global_tasks if t in user_tasks]
    individual_tasks_assigned = [t for t in user_tasks if t not in global_tasks]
    
    global_completed = len([t for t in global_tasks_assigned if t in completed_tasks])
    individual_completed = len([t for t in individual_tasks_assigned if t in completed_tasks])
    
    all_tasks_complete = (global_completed == len(global_tasks_assigned) and 
                         individual_completed == len(individual_tasks_assigned))
    
    return jsonify({
        'success': True,
        'tasks': task_list,
        'global_tasks': [{'id': task_id, 'name': all_tasks[task_id]} for task_id in global_tasks if task_id not in completed_tasks],
        'individual_tasks': [{'id': task_id, 'name': all_tasks[task_id]} for task_id in (user_individual_tasks.get(username, [])) if task_id not in completed_tasks],
        'completion_status': {
            'all_complete': all_tasks_complete,
            'global_completed': global_completed,
            'global_total': len(global_tasks_assigned),
            'individual_completed': individual_completed,
            'individual_total': len(individual_tasks_assigned),
            'completed_task_ids': list(completed_tasks)
        }
    })

@app.route('/api/task-completed', methods=['POST'])
def task_completed_api():
    """API endpoint to notify when a user completes a task"""
    data = request.get_json()
    username = data.get('username')
    task_name = data.get('task_name', 'Unknown Task')
    
    # Get username from cookie for security (don't trust client data)
    cookie_username = request.cookies.get('username')
    if not cookie_username or cookie_username != username:
        return jsonify({'success': False, 'error': 'Authentication mismatch'}), 403
    
    if username:
        # Store the task completion notification
        global task_completions, last_completed_task_name, unique_completions, user_completed_tasks
        
        # Check if user is an imposter
        user_role = user_roles.get(username, '')
        is_imposter = user_role and user_role.startswith('Imposter')
        
        # Extract task ID from task name for unique tracking
        task_id = None
        for tid, tname in all_tasks.items():
            if tname == task_name:
                task_id = tid
                break
        
        # Track unique completions for crewmates only
        if not is_imposter and task_id and username in username_to_id:
            player_id = username_to_id[username]
            unique_completions.add((player_id, task_id))
        
        # Track completed tasks per user (for access control and completion status)
        if task_id:
            if username not in user_completed_tasks:
                user_completed_tasks[username] = set()
            user_completed_tasks[username].add(task_id)
        
        completion = {
            'username': username,
            'task_name': task_name,
            'timestamp': time.time(),
            'id': str(uuid.uuid4()),  # Unique ID for each completion
            'is_imposter': is_imposter  # Track if this was an imposter completion
        }
        task_completions.append(completion)

        
        # Update last completed task
        if is_imposter:
            last_completed_task_name = f"{task_name} (FAKE)"
        else:
            last_completed_task_name = task_name
        
        # Clean up old completions (older than 15 seconds)
        current_time = time.time()
        task_completions = [tc for tc in task_completions if current_time - tc['timestamp'] < 15]
        
        return jsonify({'success': True, 'message': f'{username} completed {task_name}'})
    return jsonify({'success': False, 'error': 'Username required'}), 400

@app.route('/api/latest-task-completion', methods=['GET'])
def latest_task_completion_api():
    """API endpoint to get the latest task completion"""
    global task_completions
    # Clean up old completions first
    current_time = time.time()
    task_completions = [tc for tc in task_completions if current_time - tc['timestamp'] < 15]
    
    # Return the most recent completion if any exist
    if task_completions:
        latest_completion = max(task_completions, key=lambda x: x['timestamp'])
        return jsonify({
            'success': True,
            'task_completion': latest_completion
        })
    return jsonify({'success': True, 'task_completion': None})

@app.route('/api/last-completed-task', methods=['GET'])
def last_completed_task_api():
    """API endpoint to get the name of the last completed task"""
    return jsonify({
        'success': True,
        'last_task': last_completed_task_name
    })

@app.route('/api/progress', methods=['GET'])
def get_progress_api():
    """API endpoint to get current game progress"""
    if not game_started:
        return jsonify({'success': False, 'progress': 0, 'message': 'Game not started'})
    
    # Count unique crewmate task completions only
    unique_crewmate_completions = len(unique_completions)
    
    # Calculate current progress
    current_progress = min(100, unique_crewmate_completions * progress_per_task)
    
    return jsonify({
        'success': True,
        'progress': round(current_progress, 1),
        'completions': unique_crewmate_completions,
        'progress_per_task': round(progress_per_task, 2)
    })

@app.route('/api/set-progress-percentage', methods=['POST'])
def set_progress_percentage_api():
    """API endpoint to set the total progress percentage (only when game not started)"""
    if game_started:
        return jsonify({'success': False, 'error': 'Cannot change progress percentage while game is running'}), 400
    
    data = request.get_json()
    percentage = data.get('percentage')
    
    if not percentage or not isinstance(percentage, (int, float)) or percentage <= 0:
        return jsonify({'success': False, 'error': 'Invalid percentage value'}), 400
    
    global total_progress_percentage
    total_progress_percentage = percentage
    
    return jsonify({'success': True, 'message': f'Progress percentage set to {percentage}%'})

@app.route('/body', methods=['GET'])
def body_api():
    """API endpoint to report a dead body"""
    global current_progress, old_progress, dead_username, reporter_username
    
    username = request.args.get('username')
    if not username:
        return jsonify({'success': False, 'error': 'Username parameter required'}), 400
    
    # Store current progress and set dead body state
    old_progress = current_progress
    current_progress = -3
    dead_username = username
    
    # Try to get reporter from session/cookie or default
    reporter_username = request.cookies.get('username', 'Anonymous')
    
    return jsonify({
        'success': True, 
        'progress': current_progress,
        'dead_username': dead_username,
        'reporter_username': reporter_username
    })

@app.route('/reportbody', methods=['GET', 'POST'])
def reportbody_page():
    """Page for reporting a dead body with username input"""
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        if not username:
            return render_template('reportbody.html', error="Please enter a username")
        
        # Redirect to the body endpoint with the username parameter
        return redirect(url_for('body_api', username=username))
    
    # GET request - show the form
    return render_template('reportbody.html')

@app.route('/meeting', methods=['GET'])
def meeting_get_api():
    """API endpoint to call an emergency meeting (GET request)"""
    global current_progress, old_progress, caller_username
    
    # Store current progress and set emergency meeting state
    old_progress = current_progress
    current_progress = -2
    
    # Try to get caller from session/cookie or default
    caller_username = request.cookies.get('username', 'Anonymous')
    
    return jsonify({
        'success': True, 
        'progress': current_progress,
        'caller_username': caller_username
    })

@app.route('/endmeeting', methods=['GET'])
def endmeeting_get_api():
    """API endpoint to end meeting (emergency or dead body) - GET request"""
    global current_progress, old_progress, dead_username, reporter_username, caller_username

    current_progress = old_progress
    # Clear meeting data
    dead_username = ""
    reporter_username = ""
    caller_username = ""
    return jsonify({'success': True, 'progress': current_progress})

@app.route('/api/current-roles', methods=['GET'])
def current_roles_api():
    """API endpoint to get current role assignments"""
    cleanup_inactive_users()
    
    # Only return roles for active users
    active_roles = {}
    for username, role in user_roles.items():
        if username in active_users and role:
            active_roles[username] = role
    
    return jsonify({
        'success': True,
        'roles': active_roles,
        'game_started': game_started,
        'active_player_count': len(active_roles)
    })


def set_progress(percentage):
    """
    Easy function to modify the progress bar
    
    Args:
        percentage (float): Progress percentage (0-100)
    
    Example usage:
        set_progress(50)  # Sets progress to 50%
        set_progress(75.5)  # Sets progress to 75.5%
    """
    global current_progress
    if 0 <= percentage <= 100:
        current_progress = float(percentage)
        app.logger.info(f"Progress set to {current_progress}%")
        return True
    else:
        app.logger.error(f"Invalid progress value: {percentage}. Must be between 0 and 100.")
        return False

@app.route('/test')
def test_progress():
    """Test route to demonstrate live progress updates"""
    import time
    import threading
    
    def simulate_progress():
        for i in range(0, 101, 5):
            set_progress(i)
            time.sleep(0.5)
    
    # Start progress simulation in background
    threading.Thread(target=simulate_progress, daemon=True).start()
    
    return f"<h3>Progress simulation started!</h3><p>Go back to <a href='/'>main page</a> to see live updates.</p>"

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
