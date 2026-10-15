# Boss music: listen here

Each folder is one boss. Open the MP3s in VS Code (or any player). Every boss has one song per **phase**: the first five
bosses have 1, the middle ones 2, Mega Unit X and Magma Wyrm 3, and the Void 5.

- **phase N - song (as the game plays it).mp3**: the exact file the game uses. It starts with a 6.5-second
  **build-up** (it plays during the boss's VS screen, or its phase power-up) that runs straight into the song.
  FIGHT! (or the phase burst) lands on the downbeat where the song proper kicks in.
- **phase N - preview (build-up, the whole loop, then past the seam).mp3**: the build-up, the whole loop, then 20 more
  seconds after the loop jumps back. Listen around the end: that's the seam, and you shouldn't be able to hear it.

`win music.mp3` and `lose music.mp3` play when you beat a boss or lose to one. The losing music is now a short jingle composed for the game (about 5 seconds; you asked for it shorter and different). The winning music is a fanfare composed for the game too (2026-10-10, you asked for a new one): brass in C, the bright twin of the losing jingle. `story music`, `story-page music` and `story-finale music` are the story cutscenes' music, composed for the game and scored to the animation (you asked for the music to follow it): in the intro the Everbook and its rising words are C major, the Void arrives on a low diminished chord with a timpani roll at 6.4 s, everything hits at once on C minor when it tears the book (7.9 s), strings rush down as the pages scatter, an A minor adventure plays under the fifteen worlds (10.2 s), and the title card lands on a full C major (14.4 s). They replace Once Upon a Time by TAD.

**Loops re-checked (2026-10-09, you said some didn't loop nicely):** every song's seam was scored again, and the eight weakest got new loop points: King Sourgum, the Kraken, the Ringmaster, both Phantom Librarian songs, Mega Unit X and the Void's phases 2 and 5 (seams 0.60-0.76 before, 0.87-0.98 now). A few loops got shorter where that was the only clean seam (the Librarian's are 45 s and 34 s). Mega Unit X's long loop came back on 2026-10-10 (you missed its build-up to the rapid part): 1:55 from 9.3 s, with the whole build-up, seam 0.60.

This folder is just for listening (it's not in git). The game's own files are in `src/main/resources/static/audio/music`.

## What makes good boss music (the research)

- **Tempo around 130-160 BPM**, driving drums with accents and syncopation: it keeps your heart rate up.
- **A strong leitmotif** (a theme that keeps coming back, with variations): the chorus you remember.
- **Tension**: minor keys and chromatic notes.
- **Phases step up**: the next tier of a fight gets faster, bigger, louder.
- **Odd meters (5/4, 7/4) feel alien and keep you off balance.** Good for a riddling Sphinx and a broken machine.
- And from your feedback: **grand, important and epic, but still the feel of the world** (Pandemia was the model),
  a loop that loops back into itself, and **every phase more intense than the one before**.

Sources: [Game Developer: boss music](https://www.gamedeveloper.com/audio/getting-making-game-music-that-fits-classic-genre-series-boss-music),
[Game Developer: tempo](https://www.gamedeveloper.com/audio/composing-music-for-video-games---tempo),
[TV Tropes: uncommon time in games](https://www.tvtropes.org/pmwiki/pmwiki.php/UncommonTime/VideoGames).

## How the songs were picked (Claude can't hear, so it measured)

About 260 CC0 tracks on OpenGameArt were downloaded by theme and measured. **Intensity** = drum/note hits per second,
how hard they hit, and brightness, scored on each song's *finished* loop (after mastering, which softens drum hits a
little). A phase's song had to score clearly higher than the phase before it (at least +0.1; most are far more).
Loop points were lined up on the drums and the harmony, before AND after the seam, and the last 60 ms before the
jump are crossfaded; songs made by their composers to loop (Negev Fight, the climax Action Boss Battle) loop on their
own seam. Every song got the same gentle "grand" mastering: a little more low end and air, a wider stereo image, a
concert-hall reverb that rings across the loop seam, and even loudness.

**The build-up** is the last 6.5 seconds of each song's own lead-in, rising from quiet to full (a crescendo, a filter
that opens up from muffled to bright, and the downbeat's own echo played backwards so it swells into the hit). Because
it IS the music right before the downbeat, it merges into the song exactly.

| # | Boss | Phase 1 | Phase 2 | Phase 3+ |
|---|---|---|---|---|
| 1 | The Big Eraser (Notebook) | Unsolicited Trailer Music (Emma_MA) | one phase |  |
| 2 | Queen Thistle (Garden) | Boss Battle 6 (8-bit) (nene), your pick 2026-10-14 | one phase |  |
| 3 | Old Grumbleowl (Acorn Woods) | Catch Me If You Can (poinl) | one phase |  |
| 4 | King Sourgum (Candy Hills) | To the Final Step (mix) (glitchart, from Raymond1206, LSAo and migfus20; CC-BY-SA 4.0), your pick | one phase |  |
| 5 | The Kraken (Coral Reef) | Video Game Pirate (iamoneabe) | one phase |  |
| 6 | The Yeti (Snow Day) | Black Diamond (Joth) | Hard Boss Battle 2 (MintoDog) |  |
| 7 | Thunderhead (Rainy City) | A Boar in the Bushes (Gundatsch; CC-BY 3.0), your pick 2026-10-14 | Fight for Better Future (nene), measured more intense (+0.74 vs +0.37) |  |
| 8 | Sir Squall (Sky Kingdom) | The Call for Unity (vitalezzz) | Mile-High Infraskyway (Spring Spring) |  |
| 9 | The Sphinx (Desert Caravan) | King Crumble (iamoneabe) | Riddle of the Sands (7/4) (composed for this game) |  |
| 10 | The Ringmaster (Big Top Carnival) | Ring Master (Bobjt) | 8-bit Action Boss Battle (climax, 185 BPM) (MintoDog) |  |
| 11 | Glitch (Neon Arcade) | Level 2 (Retro Game Music Pack) (Juhani Junkala), the old phase 2, moved up at your request | Space Boss Battle Theme: Orbital Colossus (Matthew Pablo; CC-BY 3.0), your pick |  |
| 12 | The Phantom Librarian (Haunted Library) | The Restless Stacks, composed for the game (2026-10-14): a danse macabre waltz with no guitar (harpsichord, celesta, violin, organ, choir) | Ink and Fury, composed: an organ toccata (organ, strings, brass, choir) |  |
| 13 | Mega Unit X (Robot Factory) | Return of the Omega Droid (Umplix) | Epic Combat (Chester01) | Steel Commander (vitalezzz) |
| 14 | Magma Wyrm (Volcano Island) | Devoted Guard (vitalezzz) | Achilles (Zane Little Music), your pick 2026-10-14 | Carnage (boss battle) (glitchart (Centurion_of_war vs nene)) |
| 15 | The Void (Deep Space) | Outworld (vitalezzz) | Claimed by the Void (glitchart (vitalezzz vs tricksntraps)) | Trance Boss Battle (MintoDog) → The Final Mega Boss (Umplix) → Pandemia (nene) |
| 16 | The Cursed Angel (the secret Celestial Rift) | Boss Theme 2 (Tausdei; CC-BY 3.0), your pick | Blackmoor Colossus (Matthew Pablo; CC-BY 3.0): choir chants | Boss Battle #2 (Symphonic Metal) (nene) → Determined Pursuit (Emma_MA, epic orchestra) → Boss Battle 8 (metal) (nene) |

(The Library and the Robot Factory swapped places on the map at your request: the robot is now world 13. On 2026-10-09 you
asked for new songs for the Yeti, the Garden, Acorn Woods and the Sphinx's phase 2, and for Pandemia to be the Void's
final phase; the Void's phases 2-4 moved up one.) A few
phase songs have shorter loops (about 40-80 seconds) because the most intense tracks are short battle loops.

The composed song (the Sphinx's 7/4) was written as MIDI and played with real sampled instruments (the free GeneralUser GS
SoundFont, through FluidSynth). (Glitch's composed 5/4 song was replaced at your request.) The Phantom Librarian's two songs (2026-10-14) were composed the same way. Most other songs are CC0 (public domain); five need credit (CC-BY 3.0, one CC-BY-SA 4.0), see `static/audio/CREDITS.txt` and NOTICE.md.

**2026-10-14:** your picks (Queen Thistle, King Sourgum, Thunderhead's phase 1, Magma Wyrm's phase 2, Glitch's phases, the Cursed Angel's phase 1) were checked for their licenses and built like the rest. Thunderhead's phase 2 and the Cursed Angel's phases 2-5 were chosen by measured intensity, each phase more intense than the one before (Boss Theme 2 -1.02, Blackmoor Colossus -0.85, Endless Pain +0.36, Inferior Deity +0.68, Boss Battle 8 +1.17). Seven of the new songs loop on themselves end to start (seams 0.976-1.000). The listening copies of the Cursed Angel's five are in `16-rift (The Cursed Angel)/`. Later the same day (you: "i like grandness of songs 1 and 2 of angel, i like the final fight feel of 5 / songs of phase 3 and 4 need changes") phases 3 and 4 became Boss Battle #2 (Symphonic Metal) by nene (+0.08: the grand orchestra with guitars, leading toward the metal finale) and Determined Pursuit by Emma_MA (+0.62: an epic orchestra loop with busy drums); the old ones can still be built as `rift-p3-old`/`rift-p4-old`. Then (you: "i just want a longer loop for it") phase 3 got a chorus: the song had none (its opening is the same riff building in), so a 32-bar song was made, an orchestral chorus composed for the game over the loop (a choir on the loop's chords, horns and trumpets singing a melody, running strings, timpani and cymbals; every note taken from what the loop plays in that half bar), then the loop as it is: 53 s instead of 26 (`compose_symph.py`, measured -0.14, still between phases 2 and 4). Then (you: "much more creative and interesting") the chorus was rewritten (`compose_symph2.py`): a horn hook and the choir's answer, the hook climbing with trumpets in thirds and orchestra hits, bells ringing it at half speed over choir chords and a harp sweep, then the hook in octaves on the whole brass, a falling run and a reverse cymbal back into the riff (-0.20). Then (you: "try and write a chorus using the assets already in the song, or from the other songs used") it became all real recordings of the piece (`build_symph3.py`): the loop as the verse, the symphonic version's own opening (4 quiet bars and a 4-bar build-up, written to run into the loop) as a breakdown, and a chorus where the melody of nene's original 8-bit Boss Battle #2 (CC0; the same composition a semitone lower, shifted up with Rubber Band, its bass and drums filtered out) shines over the loop. 40 bars, 66 s, +0.33. The other angel songs were in other keys and chords (C, A, F, D minor), so none of them could be layered over this riff. The composed versions are kept as `rift-p3-chorus-v1.wav` and `-v2.wav`. The old Thunderhead songs (Storm Front, Downpour) are no longer in the game but can still be built (`rain-old` in build_songs2.py).
