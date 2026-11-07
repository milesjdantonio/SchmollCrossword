# Things to Review

Everything in the major update that needs your eyes, ears or a decision. When something is ready it moves to
**Ready for you**, with what to look at and how. Tick it off (or write your answer under it) when you're done.

## Ready for you

- [ ] **Pick a redesign direction.** https://claude.ai/artifact/LzQzyKbpcskqALsXQzCaAM (private to you).
      Three directions: **A Passport** (tickets and stamps), **B Transit** (a departures board and a line diagram;
      my pick, for clarity) and **C Storybook** (the Everbook as the app). The first board explains them; each row
      below it has Home, a puzzle and the campaign on a computer, then the same three on a phone. Press Play on a
      board to use it: on the puzzles, click a square, click it again to switch Across and Down, click clues, open
      Check or Reveal; on the phones the keys type. Each board's World tweak swaps Garden for Deep Space.
      Reply with A, B or C (or a mix, like "B with A's stamps") and anything you'd change. Or say "standard" for a
      plain, familiar puzzle-app look. The redesign isn't built until you choose; I'm working on the fixes meanwhile.

- [x] **The live site.** It answered "503 unavailable" before any change, but it's up again and serving the update
      page (checked 2026-11-07).
- [ ] **Your API key on the host.** The shipped dailies end on November 29. The live version (the one behind the
      update page) then writes each day's puzzles with your Anthropic API key the first time someone opens them,
      about 4 cents a day. Make sure the key is set on the host and has a spending limit. The update replaces this
      with dailies made weeks ahead.

## Coming up

These aren't ready yet. Each one moves up when it is.

- [ ] **Difficulty slope.** A chart of how hard every campaign level is, predicted from its words, clues, grid size
      and boss speed. Tell me what the curve should be and I'll change it.
- [ ] **Music loops.** For each fixed song, a short preview of the loop point (the end running into the start).
      Listen for clicks, jumps, beats out of step or a cut-off note. Tracks: Old Grumble Owl 1, King Sourgum 1,
      Kraken 1, Yeti 1, Thunderhead 1, Sir Squall 2, Sphinx 1, Ringmaster 1, Mega Unit X 1-3, Magma Wyrm 1-3,
      Void 2-5, Cursed Angel 1, and the Cursed Angel's swapped phases 3 and 4.
- [ ] **New music.** The songs picked or composed for the four secret worlds (boss phases and levels).
- [ ] **"Giant Steps but Smooth"** (Rainy City level 3). It may be an arrangement of John Coltrane's "Giant Steps",
      which is still under copyright. Only listening can tell; if it is, it should be replaced.
- [ ] **Daily email.** It needs an email account to send from. For schmollcrossword@gmail.com: turn on 2-Step
      Verification, make an App Password, and put it in your host's settings as environment variables (names to
      come). Never paste the password into chat.
- [ ] **Clue samples.** Examples of the new clue style (fewer bare synonyms) from the AI prompt, before the
      campaign's clues are rewritten in that style.
- [ ] **Secret worlds.** Each one's look, boss, story scene and arrival animation, as they're finished.
- [ ] **The Beta strip** (+500 Coins, Unlock All, on the campaign map). Keep it for the relaunch or switch it off?
- [ ] **Before the merge.** A play-through checklist of the finished update before it replaces the live site.
