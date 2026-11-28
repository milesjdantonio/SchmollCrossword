# Things to Review

Everything in the major update that needs your eyes, ears or a decision. When something is ready it moves to
**Ready for you**, with what to look at and how. Tick it off (or write your answer under it) when you're done.

## Ready for you

- [ ] **Every world, redrawn** (2026-11-27). All 16 worlds have new backgrounds and win animations, built with
      Rive and Motion to the Celestial Rift's level of detail. Look at each one in light and dark, and win a puzzle
      in each, then say which ones still feel off:
      - Garden: countryside, windmill, a Rive wreath.
      - Notebook: a lamplit desk, or a blueprint at night; Rive doodles and stars.
      - Rainy City: a café street; a Rive umbrella.
      - Desert: dunes and an oasis; a Rive treasure chest.
      - Carnival: a big top and a Ferris wheel; a Rive strength tower.
      - Robot Factory: a hall with arms and a conveyor; a Rive trophy.
      - Sky Kingdom: floating islands and a castle; a Rive balloon.
      - Volcano Island: a stratovolcano across a lagoon; two Rive tikis.
      - Neon Arcade: a synthwave drive with palm rows; a Rive neon marquee.
      - Haunted Library: a two-storey hall with a clock that tells the real time; a Rive grimoire.
      - Candy Hills: a candy castle and a chocolate waterfall; a Rive piñata.
      - Coral Reef: caustics, a shipwreck, a clam; a Rive giant clam and pearl.
      - Snow Day: alpine peaks, a frozen lake with a skater; a Rive snowman.
      - Acorn Woods: painterly autumn woods; a Rive squirrel and golden acorn.
      - Deep Space: a galaxy and asteroids by night, a sunlit solar system by day; a Rive rocket.
      - Classic: a Rive seal.

- [ ] **Louder top volume.** Master Volume now starts at 80%, which is as loud as 100% was; 100% is twice that
      (+6 dB). Your saved volume was moved to the same loudness (96% shows as 77%). Try 100% in a boss fight and say
      if it's too much or not enough.
- [ ] **The stretched background in Chrome.** Found one cause: in Chrome the background was drawn for the window
      including its scrollbar and then squeezed into the page beside it (Vivaldi's scrollbars float, so it looked
      right there). Fixed; open a page with a scrollbar (Home, Stats) in Chrome and say if it still looks stretched.
- [ ] **The black box in Deep Space's win.** You found it in the win animation: the black hole's dark backdrop was
      a rectangle that moved with the board. It's now a soft fade over the whole screen. Win a puzzle in Deep Space
      (light and dark) and say if any edge still shows.
- [ ] **Home, Stats and Settings** (2026-11-26) were redone so they don't read as AI-made: the greeting is the
      title with what's left today, each daily is a row (the small boards are gone, as you asked), the week is a row of
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

- [ ] **Offline.** Open the game once, then turn off your Wi-Fi and reload: it still opens, today's dailies and any
      puzzle or level you've opened still play, and a note in the corner says the leaderboard and new puzzles need
      a connection.

- [ ] **Standard sounds.** Typing, clicks, finished words, mistakes, coins and the win now use plain interface sounds
      (the same in every world) instead of wood taps, casino chips and glass clinks. Hear them all at
      http://localhost:8090/demo/sounds.html. Tell me which still feel wrong.

- [ ] **Daily Quests and the Collection.** Home's Quests card now has today's three small quests too (20 coins
      each; all three give a board colour). Open the Collection from that card or Settings > World: 100 board
      colours and 23 letter styles, each with a preview, to win in the quests or buy with campaign coins (the
      legendary ones only from Weekly Quests). The Beta strip's Unlock All opens all of them.

- [ ] **Weekly Quests.** On Home, under the Daily card: three quests for the week (the same for everyone, new each
      Sunday), each with a reward: a board colour (Gold, Midnight, Rose or Mint, for any world's board; pick it on
      the same card) or a new part for your hero (in the hero maker once won). Finish all three for the week's
      badge. Tell me if the quests are the right size for a week, and what else you'd like as rewards.

- [ ] **The Daily Archive.** On Home, under the Daily card, open the Daily Archive: a calendar of every earlier
      day, drawn like a crossword grid. The coloured marks on each day are its Easy, Medium, Hard and Challenge, filled
      in once you've solved them. Pick a day, play one: it's practice, so no points or streak. Surprise Me picks one
      you haven't done. A day joins the Archive once it's over everywhere in the world, so yesterday's shows up around
      7 a.m. New York time. Tell me if the calendar idea works for you.

- [ ] **Boss fights, redone.** Start any boss fight on a computer: the site's menu bar is gone, the race bar sits
      next to the title, your board is much bigger, and your three abilities are a column right beside it (keys
      1-3 still work). The clues and the boss are down the right side. Tell me what still feels off: sizes, what's
      where, anything you look for and can't find.

- [ ] **The Carnival, redrawn.** Pick Big Top Carnival in Settings and look at it by day and by night: hills
      with a little town, a wooden coaster with a train running on it, a drop tower that rises and falls, a
      detailed Ferris wheel, a big top with a curved roof and a lit marquee door, a carousel with horses going
      round, three game booths, people strolling, a popcorn cart, lamp posts and a balloon seller. At night it's
      all bulbs, searchlights and fireworks. Tell me what still looks flat.

- [ ] **Music when a secret world is found.** Each of the five secret worlds now has its own short dark piece
      that plays under the "You Found a Secret World" card: a low hit, then a slow loop that keeps going until
      you close the card. Lava Cave (taiko and low brass), Atlantis (harp and flute), the Great Hollow (pizzicato
      and clarinet), the Sunken Dunes (frame drum and shanai), the Celestial Rift (organ, choir and celesta).
      I composed them but can't hear them: tell me if one is too loud, too long, or not creepy enough. To hear
      them without finding the worlds: `src/main/resources/static/audio/music/secret-<world>.mp3`.

## Coming up

These aren't ready yet. Each one moves up when it is.

- [ ] **Difficulty slope.** A chart of how hard every campaign level is, predicted from its words, clues, grid size
      and boss speed. Tell me what the curve should be and I'll change it.
- [ ] **Music loops.** For each fixed song, a short preview of the loop point (the end running into the start).
      Listen for clicks, jumps, beats out of step or a cut-off note. Tracks: Old Grumble Owl 1, King Sourgum 1,
      Kraken 1, Yeti 1, Thunderhead 1, Sir Squall 2, Sphinx 1, Ringmaster 1, Mega Unit X 1-3, Magma Wyrm 1-3,
      Void 2-5, Cursed Angel 1, and the Cursed Angel's swapped phases 3 and 4.
- [ ] **Before the merge.** A play-through checklist of the finished update before it replaces the live site.
