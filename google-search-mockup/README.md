# Google Images mockup — Halloween scare

A static, pixel-matched copy of the Google Images results page for "teletubbies".
Visitors can only scroll. Clicking any image glitches the tile to the first frame of
the clip, holds it for 2 s, plays it inside the tile, and once the scene turns
it glitches to full screen with a synthesised glitch sound and locks all input.

## Add the video

Put the clip at `media/scare.mp4` (H.264/AAC MP4 plays everywhere). Then open
`app.js` and set `CREEPY_AT` to the second at which the scene starts to change.

## Run it

    python3 -m http.server 8080 --directory google-search-mockup

and open http://localhost:8080. Any static host works too.

## Rehearsal overrides (URL params)

- `?creepy=7.5` — the second at which the clip goes full screen
- `?freeze=2000` — how long to hold the first frame, in ms
- `?video=media/other.mp4` — try a different clip
- `?glitchVol=0.5` — volume of the glitch sound at the takeover (0–1, default 0.9)
- `?loop=1` — loop the clip after the takeover instead of holding the last frame

Thumbnails are loaded from Google's image CDN, so the viewing machine needs
internet access. Reload the page to reset.
