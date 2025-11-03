# AmongIRL
Note: This code is very badly written. AI wrote most of it and and about a quarter of the code could be rewritten to be better. If you have the time, I appreciate any help in the form of pull requests.
Before you do anything, create a `.env` file for PANEL_PASSWORD.

### About this
When I was younger, I liked playing the game Among Us, so my friends and I made slips to assign roles and played it in real life. It was fun, but nowhere near the real game. Therefore, I decided to work on coding up a way to play the actual game in real life.
My idea was that you would pick someone's house and prepare it beforehand. The progress bar for tasks would go on a big screen visible from afar `(/)`, and each player would join `(/join)` on their own phone. Then, once the game was started, the server would automatically assign roles and tasks.
The tasks are NFC tags (or QR codes) put around the house in different locations. Each player would \[tap their phone/scan the code to\] open a task, which would they register that they completed it and add progress to the bar.

### Setup
> Note: I have never actually run this project locally. Replit's development server was enough for me and my small group of friends. However, I encourage you to try it and share your results.

The code is written in Flask (Python). You can start the app by running `gunicorn --bind 0.0.0.0:5000 --reuse-port --reload main:app` or just do `python3 main.py`.
The endpoints that are currently in my memory:
- `/`: The progress bar, which should be put on a big screen.
- `/panel`: The admin panel used to start the game.

  I'll probably finish this README someday.
