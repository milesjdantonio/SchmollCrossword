# Boss music: listen here

Each folder is one boss. Open the MP3s in VS Code (or any player):

- **song (as the game plays it).mp3**: the exact file the game uses. It starts with the song's own intro.
- **preview - intro, loop, then past the loop seam.mp3**: the intro, the whole loop, then 20 more seconds after
  the loop jumps back. Listen around the end: that's the seam, and you shouldn't be able to hear it.

Folders with **(phase 2)** are the song a boss switches to in its second phase (the Sphinx, Glitch and the Void).
Every other boss plays its own song a little faster in phase 2. `win music.mp3` and `lose music.mp3` play when you
beat a boss or lose to one.

This folder is just for listening (it's not in git). The game's own files are in `src/main/resources/static/audio/music`.

## What makes good boss music (the research)

- **Tempo around 130-160 BPM**, driving drums with accents and syncopation: it keeps your heart rate up.
- **A strong leitmotif** (a theme that keeps coming back, with variations): the chorus you remember.
- **Tension**: minor keys and chromatic notes.
- **Phases step up**: the second tier of a fight gets faster, bigger, or changes key.
- **Odd meters (5/4, 7/4) feel alien and keep you off balance.** Good for a riddling Sphinx and a broken machine.
- And from your feedback: **grand, important and epic, but still the feel of the world** (Pandemia was the model),
  a 2:00-2:30 loop that loops back into itself, and an intro that's the real start of the song.

Sources: [Game Developer: boss music](https://www.gamedeveloper.com/audio/getting-making-game-music-that-fits-classic-genre-series-boss-music),
[Game Developer: tempo](https://www.gamedeveloper.com/audio/composing-music-for-video-games---tempo),
[TV Tropes: uncommon time in games](https://www.tvtropes.org/pmwiki/pmwiki.php/UncommonTime/VideoGames).

## How the songs were picked (Claude can't hear, so it measured)

Hundreds of CC0 tracks on OpenGameArt were scanned by theme. Each candidate was measured for length, tempo, key,
drum drive, how many distinct sections it has (a "chorus" test), loudness swings between sections (the epic, grand
feeling), and whether a 2:00-2:30 stretch of it loops back into itself. The loop points were then lined up on the
drums and the harmony, before AND after the seam, and the last 60 ms before the jump are crossfaded. Finally every
song got the same gentle "grand" mastering: a little more low end and air, a wider stereo image, a concert-hall
reverb that rings across the loop seam, and even loudness.

| # | Boss | Song | Artist | Why |
|---|---|---|---|---|
| 1 | The Big Eraser (Notebook) | Unsolicited Trailer Music | Emma_MA | a grand orchestral trailer: the first big fight should feel important |
| 2 | Queen Thistle (Garden) | Qazijamjam Orchestral Battle Theme | Emma_MA | orchestral, regal, 21 kinds of section |
| 3 | Old Grumbleowl (Acorn Woods) | This One Is Tough | Loyalty Freak Music | E minor, a final-boss feel, and one of the cleanest loops |
| 4 | King Sourgum (Candy Hills) | Toy Soldiers | Zane Little Music | a bouncy, royal march: candy-coloured but still a battle |
| 5 | The Kraken (Coral Reef) | Video Game Pirate | iamoneabe | high seas, C minor, 28 kinds of section |
| 6 | The Yeti (Snow Day) | Long Winter | Indieteur | wintry, D minor, big swells |
| 7 | Thunderhead (Rainy City) | Synthmetal Climax Theme | Gradoa | a storm: heavy, fast and loud |
| 8 | Sir Squall (Sky Kingdom) | The Call for Unity | vitalezzz | soaring and epic, F minor |
| 9 | The Sphinx (Desert Caravan) | Riddle of the Sands **(7/4)** | composed for this game | 2+2+3 in D Hijaz, with shanai, oud, darbuka, choir and horns |
| 9b | The Sphinx, phase 2 | Desert Settlement | vitalezzz | grand, 5 minutes, still the desert |
| 10 | The Ringmaster (Big Top Carnival) | Ring Master | Bobjt | your favourite circus showdown |
| 11 | Glitch (Neon Arcade) | Corrupted Signal **(5/4)** | composed for this game | 3+2 in E minor, chiptune, with stutters and pitch drops |
| 11b | Glitch, phase 2 | Singularity | vitalezzz | big, electronic and digital, D# minor |
| 12 | Mega Unit X (Robot Factory) | Return of the Omega Droid | Umplix | your favourite: back by request |
| 13 | The Phantom Librarian (Haunted Library) | Shadows Awaken Within | vitalezzz | dark orchestral metal for a haunting |
| 14 | Magma Wyrm (Volcano Island) | Devoted Guard | vitalezzz | guitar-led metal (your pick), F# minor |
| 15 | The Void (Deep Space) | Outworld | vitalezzz | orchestral and electronic, the strongest seam of all |
| 15b | The Void, phase 2 | Pandemia | nene | the final boss's finale: long, huge, the model for the rest |

The two composed songs were written as MIDI and played with real sampled instruments (the free GeneralUser GS
SoundFont, through FluidSynth). Every other song is CC0 (public domain); see `static/audio/CREDITS.txt`.
