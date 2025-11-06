# AmongIRL
Note: This code is very badly written. AI wrote most of it and and about a quarter of the code could be rewritten to be better. If you have the time, I appreciate any help in the form of pull requests.
Before you do anything, create a `.env` file for PANEL_PASSWORD.

### Why I made this
When I was younger, I liked playing the game Among Us, so my friends and I made slips to assign roles and played it in real life. It was fun, but nowhere near the real game. Therefore, I decided to work on coding up a way to play the actual game in real life.

My idea was that you would pick someone's house and prepare it beforehand. The progress bar for tasks would go on a big screen visible from afar `(/)`, and each player would join `(/join)` on their own phone. Then, once the game was started, the server would automatically assign roles and tasks.
The tasks are NFC tags (or QR codes) put around the house in different locations. Each player would \[tap their phone/scan the code to\] open a task, which would they register that they completed it and add progress to the bar. I go more into detail about how it actually works in the next section.
My friends and I had a lot of fun the few times we did this, so I thought I would put it out there to grow my portfolio and let anyone else improve or use this for themselves.

### About this
The code is written in Flask (Python) because that is what I'm most comfortable with. I had concerns about Flask as a server not being very robust, being made for a development enviornment, but it doesn't really matter when you're with as small a group as this is meant for. While difficult on mobile, it is possible to spam the add progress endpoint and instantly complete the progress bar, so make sure you trust whoever you play with not to cheat. While I tried my best to make tasks disappear from your list when you complete them, I wasn't really able to figure it out. Instruct whoever is playing this to not repeat tasks once they are completed. There are global tasks (everyone has them) which should disappear when completed, but again, it's buggy.


### Setting it up for yourself
> Note: I have never actually run this project locally. Replit's development server was enough for me and my small group of friends. However, I encourage you to try it and share your results. 

The code is written in Flask (Python). You can start the app by running `gunicorn --bind 0.0.0.0:5000 --reuse-port --reload main:app` or just do `python3 main.py`. I recommend you copy all this code into a Replit project, then start the development server. Turn on the dev server whenever you want to play. The dev links are very long, so I recommend you grab the /join full path, and make it a TinyURL or a QR code.

Each player needs a phone to play. You also need a big screen like a projector or television. Players should be told not to repeat tasks. When players are "killed" by an impostor, figure out a system for how it should be acted. Example: When the impostor "stabs" a player with their hand, the player should fall down and pretend to be dead.

Endpoints (All `GET`)
- `/`: The progress bar, which should be put on a big screen.
- `/admin`: Not the actual admin panel. This screen shows the last completed task and should be put optionally somewhere around the house, so that players in that area can see 
- `/panel`: The admin panel used to start the game. Put this on your PC or a computer screen which will not be used. When you are starting the game, make sure to collapse the bottom section, because if a game is running, it shows the roles of everyone playing. When people are joining the lobby, this screen can be used to rename or kick them. The screen also has a number of other controls, including the percentage of tasks needed to be completed. This is made really weird, but this should make it easy to understand: 100% means all tasks have to be completed to win. 150% means there is a total of 150% progress bar worth of tasks distributed, so only 66% of the total assigned tasks actually have to be completed. If you are playing with people who have a high gap in age or don't really know each other, it helps to turn this number higher. It also doesn't work completely, so default it to 100%.
- `/panel/join`: The only use of this page is to allow multiple "players" to join from one client, only for debugging purposes.
- `/meetingbtn`: This can be put on an extra device or just given to the players as a link in a group chat. It has a button which when clicked, triggers an emergency meeting, blocking out the progress bar and showing big text on the screen.
- `/join`: The page where all users should go to join the game. This redirects to the `/user` page when you are WMWMMWMWMWMMWMWMWMWMWMMWMWMhewughwuoghweoighEUGHIUWHGIUEWHGIUWEHGIUEHIUGHEWIUGHWEIUGHWEOUGHOUEHGOUEHUOGWHGOUEWHGUOEWHGUOEWHGUOEWHGOUEWHGOUWEHGOUWEHGOUWEGHOUEWHGOUEHGWOUHGEIUOWHGEWIUGUIEWGUIEW
- `/task1` through `/task10` are the tasks, which you should put on either NFC tags or QR codes and put around your house. Put them in different locations and make sure your players know where all of them are. If you are willing to do a little bit of extra setup, make a map of your house with locations of where each task is. When a task is completed, the page DOES NOT automatically close, so tell players that when they see the "Task Completed" message, they should close that tab and not repeat the task. Also ask players to remain at the task area when doing the task.

API Endpoints (DO NOT GIVE THESE TO YOUR PLAYERS):
- 
