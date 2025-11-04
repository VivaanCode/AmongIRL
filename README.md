# AmongIRL
Note: This code is very badly written. AI wrote most of it and and about a quarter of the code could be rewritten to be better. If you have the time, I appreciate any help in the form of pull requests.
Before you do anything, create a `.env` file for PANEL_PASSWORD.

### Why I made this
When I was younger, I liked playing the game Among Us, so my friends and I made slips to assign roles and played it in real life. It was fun, but nowhere near the real game. Therefore, I decided to work on coding up a way to play the actual game in real life.

My idea was that you would pick someone's house and prepare it beforehand. The progress bar for tasks would go on a big screen visible from afar `(/)`, and each player would join `(/join)` on their own phone. Then, once the game was started, the server would automatically assign roles and tasks.
The tasks are NFC tags (or QR codes) put around the house in different locations. Each player would \[tap their phone/scan the code to\] open a task, which would they register that they completed it and add progress to the bar. I go more into detail about how it actually works in the next section.
My friends and I had a lot of fun the few times we did this, so I thought I would put it out there to grow my portfolio and let anyone else improve or use this for themselves.

### About this
The code is written in Flask (Python) because that is what I'm most comfortable with. I made most of it using AI, because it is faster. I had concerns about Flask as a server not being very robust, being made for a development enviornment, but it doesn't really matter when you're with as small a group as this is meant for. While difficult on mobile, it is possible to spam the add progress endpoint and instantly complete the progress bar, so make sure you trust whoever you play with not to cheat. While I tried my best to make tasks disappear from your list when you complete them, I wasn't really able to figure it out. Instruct whoever is playing this to not repeat tasks once they are completed. There are global tasks (everyone has them) which should disappear when completed, but again, it's buggy.


### Setting it up for yourself
> Note: I have never actually run this project locally. Replit's development server was enough for me and my small group of friends. However, I encourage you to try it and share your results.

The code is written in Flask (Python). You can start the app by running `gunicorn --bind 0.0.0.0:5000 --reuse-port --reload main:app` or just do `python3 main.py`.

Endpoints (I will include screenshots whenever I find the time):
- `/`: The progress bar, which should be put on a big screen.
- `/panel`: The admin panel used to start the game.
- `/task1` through `/task10` are the tasks, which you should put on either NFC tags or QR codes and put around your house.
