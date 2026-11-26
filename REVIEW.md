# Things to Review

Everything in the major update that needs your eyes, ears or a decision. When something is ready it moves to
**Ready for you**, with what to look at and how. Tick it off (or write your answer under it) when you're done.

## Ready for you

- [ ] **Louder top volume.** Master Volume now starts at 80%, which is as loud as 100% was; 100% is twice that
      (+6 dB). Your saved volume was moved to the same loudness (96% shows as 77%). Try 100% in a boss fight and say
      if it's too much or not enough.
- [ ] **The stretched background in Chrome.** Found one cause: in Chrome the background was drawn for the window
      including its scrollbar and then squeezed into the page beside it (Vivaldi's scrollbars float, so it looked
      right there). Fixed; open a page with a scrollbar (Home, Stats) in Chrome and say if it still looks stretched.
- [ ] **The black box behind Deep Space's black hole.** I couldn't find it (2026-11-26): the island, the Atlas and
      the scene behind Home show no box in light or dark. It was probably on the old scrolling map, which is gone.
      If you still see one, say where (which screen, light or dark, which browser).
- [ ] **Home, Stats and Settings** (2026-11-26) were redone so they don't read as AI-made: the greeting is the
      title with what's left today, each daily is a row with a small grid of its size, the week is a row of
      crossword squares, and every panel is flat in the world's own colours. Open Home, Stats and Settings in a few
      worlds and say if anything feels off.

- [x] **Pick a campaign design.** Answered (2026-11-07): a mix of A (World Stage) and B (The Everbook), combined
      as I see fit. The combined version will be at http://localhost:8080/demo before it goes into the game.
- [x] **Redesign direction.** Answered: the campaign screen gets the big redesign; Home gets a refresh, not a
      remake; options to pick go at a local /demo page.

- [x] **The live site.** It answered "503 unavailable" before any change, but it's up again and serving the update
      page (checked 2026-11-07).
- [ ] **Your API key on the host.** The shipped dailies end on November 29. The live version (the one behind the
      update page) then writes each day's puzzles with your Anthropic API key the first time someone opens them,
      about 4 cents a day. Make sure the key is set on the host and has a spending limit. The update replaces this
      with dailies made weeks ahead.

- [x] **New clue style (AI).** Approved (2026-11-07): "I like the new clue style". The clue writer now avoids bare one-word synonyms. A live test on 2026-11-07 (three
      puzzles, about 4 cents) wrote these. Say if this is the style you want before I rewrite the campaign's clues
      to match:
      - Easy: TOPS "Blouses and tees, say"; ERROR "Typo, for one"; SEVEN "Number of days in a week";
        ORDER "What you place at a diner"; RENT "Monthly payment to a landlord"
      - Medium: BOSS "Manager who signs off on your vacation days"; WHILE "Once in a ___ (occasionally)";
        LEMON "Dud of a used car, slangily"; SALON "Hair stylist's workplace"; OTHER "Alternate, as in 'every ___ day'"
      - Hard: FENCE "Receiver of stolen goods, or what a picket forms"; FACTS "Things that are stubborn, per John
        Adams"; OCEAN "Where a whale's commute takes place?"; TIFF "Minor spat between friends"
- [x] **Fix the live site's next three weeks of dailies?** Yes (2026-11-07: "you may push to main the fix to the
      next 3 weeks of dailies"). The dailies shipped for November 7 to 29 are the ones
      players get on the live site now. Seven of them repeat an earlier puzzle (Easy on Nov 11, 12, 14, 19, 26, 27
      and the Boss on Nov 9), and many of their clues are the bare synonyms you didn't like. Changing them on the
      update branch would do nothing (the branch isn't live), so it would mean a small push to `main`. Reply "fix
      the live dailies" if you want that; otherwise they stay as they are.

- [x] **The family word list.** Approved as it is (2026-11-07). Answers that never appear now, at any difficulty (`src/main/resources/family-words.txt`):
      sex and nudity words (SEX, SEXY, NAKED, NUDE...), drinking (BEER, BOOZE, DRUNK, VODKA, TIPSY...), crude words
      (CRAP, DAMN) and playground insults (MORON, SISSY, PANSY). 77 campaign puzzles that used them were taken out
      (every level still has 20 to 25). PEE and BRA stay, with clean clues ("Letter between O and Q", "Support group
      member?"). Tell me any word to add or take off.

- [ ] **Daily email and the admin page** (built; they switch on when you set these in the host's environment
      settings, not in chat, once the update is live). For schmollcrossword@gmail.com: turn on 2-Step Verification,
      make an App Password, then:

      | Name | Value |
      |---|---|
      | `SPRING_MAIL_HOST` | `smtp.gmail.com` |
      | `SPRING_MAIL_PORT` | `587` |
      | `SPRING_MAIL_USERNAME` | `schmollcrossword@gmail.com` |
      | `SPRING_MAIL_PASSWORD` | the App Password |
      | `REPORT_EMAIL_TO` | where the summary goes (any address) |
      | `ADMIN_KEY` | a long random password for `/admin.html` (your old `REPORTS_KEY` also works) |
      | `MAKE_DAILIES_AHEAD` | `7` (keeps a week of dailies ready; each day is a few cents) |

      The email comes at 8:00 each morning: dailies ready, failures, what Claude cost, players, reports.
      `/admin.html` shows the same, lists reports, and can switch off a bad daily or hide a name.
- [x] **The Beta strip** stays on (2026-11-25: "leave it on").
- [ ] **The four secret worlds.** Turn on Unlock All in the Beta strip; each sits in the dock right after its parent
      world (the Great Hollow after Acorn Woods, Atlantis after Coral Reef, the Sunken Dunes after Desert Caravan, the
      Lava Cave after Volcano Island). Each now has its own scene, board decorations, boss, arena, arrival scene,
      hero gifts, music, 4 abilities and 6 boss moves (none copies of another world's), each with its own animation.
      Still borrowed from the parent: the title card, screen transition and sounds. Tell me what to change first.
- [ ] **The secret worlds' music.** Poseidon's phases 1-2, all three of the Sandworm's and all five of the Lava Beast's
      are now composed for the game (2026-11-26). Listen in `boss-music/18-atlantis (Poseidon)`, `19-dunes (The Sandworm)`
      and `20-cave (The Lava Beast)` ("as the game plays it", and "whole loop, then past the seam" to check the loop).
      The level songs and the Giant Squirrel's are still the CC0 picks in `17-hollow...` and `levels (secret worlds)`.
- [ ] **The Celestial Rift is now a secret like the others.** After the Void: four fallen stars on Deep Space blink in
      turn (repeat the order), then a riddle, then a gate.
- [x] **The live site closes on November 29** (pushed to `main`): a countdown until then, then a "sorry, under
      development" page with no way in; no paid Claude calls from that day.
- [ ] **"Giant Steps but Smooth"** (Rainy City level 3, `src/main/resources/static/audio/music/level-rain-3.mp3`).
      It may be an arrangement of John Coltrane's "Giant Steps", which is still under copyright. Only listening can
      tell; if it is, it gets replaced.

## Coming up

These aren't ready yet. Each one moves up when it is.

- [ ] **Difficulty slope.** A chart of how hard every campaign level is, predicted from its words, clues, grid size
      and boss speed. Tell me what the curve should be and I'll change it.
- [ ] **Music loops.** For each fixed song, a short preview of the loop point (the end running into the start).
      Listen for clicks, jumps, beats out of step or a cut-off note. Tracks: Old Grumble Owl 1, King Sourgum 1,
      Kraken 1, Yeti 1, Thunderhead 1, Sir Squall 2, Sphinx 1, Ringmaster 1, Mega Unit X 1-3, Magma Wyrm 1-3,
      Void 2-5, Cursed Angel 1, and the Cursed Angel's swapped phases 3 and 4.
- [ ] **Before the merge.** A play-through checklist of the finished update before it replaces the live site.
