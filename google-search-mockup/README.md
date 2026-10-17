# Google Images mockup — Halloween scare

A static, pixel-matched copy of the Google Images results page for "teletubbies".
Visitors can only scroll. Clicking any image glitches the tile into the clip, which plays
inside the tile. While the characters are still cute it "crashes": a glitch, Chrome's "Aw, Snap!"
crash page (3 s, or until the visitor clicks — that click also turns the sound on),
a glitch back to the page where the tile keeps playing, a glitch into a Google loading
screen (3 s), and a final glitch into the clip at full screen: half a second of cute (12 frames),
then the morph to creepy, hit with a violent visual shock (flash, strobe, camera punch,
torn RGB channels) and a synthesised horror stinger, preceded by a reverse swell. Every glitch has a synthesised glitch sound; input is locked from the
crash on.

If 30 s pass without a click (scrolling does not count; a click anywhere restarts
the countdown), auto mode starts: every visible thumbnail
glitches into the clip one after another and starts playing; when the first one
reaches the crash point, the same crash sequence follows. Browsers block
sound until the visitor has interacted with the page, so in auto mode the clip
starts muted and the sound comes in on the first key press or tap.

## Add the video

Put the clip at `media/scare.mp4` (H.264/AAC MP4 plays everywhere) and its first frame
at `media/first-frame.jpg` (`ffmpeg -i media/scare.mp4 -frames:v 1 -q:v 3 media/first-frame.jpg`).
Then open `app.js` and set `CRASH_AT` / `REBOOT_AT` to clip times before the creepy cut.

## Run it

    python3 scripts/serve-google-mockup.py

and open http://localhost:8080. It supports HTTP Range requests, which the video needs
for seeking (`python3 -m http.server` does not). Any static host with Range support
works too (Render does).

## Rehearsal overrides (URL params)

- `?crash=2.5` — clip time (s) where the crash starts
- `?reboot=4` — clip time (s) where the tile glitches into the loading screen
- `?cut=6` / `?fps=24` — where the clip cuts to creepy, and its frame rate
- `?revealFrames=12` — cute frames shown at full screen before the cut (12 = 0.5 s at 24 fps)
- `?freeze=2` — how long to hold the first frame, in ms (default 2)
- `?video=media/other.mp4` — try a different clip
- `?glitchVol=0.5` — volume of the glitch sound at the takeover (0–1, default 0.9)
- `?auto=30000` — ms without a click before auto mode starts (`0` disables it)
- `?stagger=90` — ms between one thumbnail and the next in auto mode
- `?autoFreeze=2` — first-frame hold per thumbnail in auto mode, in ms (default 2)
- `?error=3000` — how long the crash page stays up without a click, in ms
- `?loading=3000` — how long the Google loading screen stays up, in ms
- `?morphFx=500` — length of the visual shock on the morph, in ms
- `?morphVol=0.9` — volume of the morph stinger (0–1)
- `?swell=0` — turn off the reverse swell before the morph
- `?loop=1` — loop the clip after the takeover instead of holding the last frame

Thumbnails are loaded from Google's image CDN, so the viewing machine needs
internet access. Reload the page to reset.
