# Adding ads to Schmoll Crossword

What it would take to show ads, what stands in the way today, where they would go, and what else changes. Nothing
here is built yet. This is research to decide from. It isn't legal advice: read each license yourself before
deciding.

## Short version

- **Right now the game can't show ads.** The word list is licensed **CC BY-NC-SA 4.0**. "NC" means NonCommercial,
  and running ads is commercial use. That's why the About card says the game is free with no ads.
- **To allow ads, the word list has to be rebuilt** without Spread the Wordlist. Everything else (code, fonts,
  music, sounds, clues) already allows commercial use.
- **Ads also bring work you don't have today:**
  - a privacy policy
  - a cookie consent banner for Europe and the UK
  - opt-outs for California
  - a looser security policy, because ad networks run their own scripts in your page
- **Revenue would be small** at hobby traffic: roughly $1–5 per 1,000 page views for casual games. That's often
  less than the server and Claude API costs.

## 1. License problems

| Part | License | Ads allowed? | What to do |
|---|---|---|---|
| Word list (`words.txt`) | **CC BY-NC-SA 4.0**, because it's SCOWL ∩ Spread the Wordlist | **No** | Rebuild it from sources that allow commercial use (below) |
| Difficulty tiers (`too-hard-words.txt`, `not-easy-words.txt`, `very-hard-words.txt`) | Made by hand for this game from SCOWL levels | Probably yes, but they were picked from the NC list | Re-check them against the new list |
| SCOWL itself | Permissive (see `SCOWL-Copyright.txt`) | Yes | Keep it, with its notice |
| Code | MIT (yours) | Yes | Nothing |
| Fonts (Google Fonts) | SIL Open Font License | Yes | Keep the credits |
| Boss music and sounds (OpenGameArt, Kenney) | CC0 | Yes | Nothing (credits are optional but kind) |
| The composed song's instruments (GeneralUser GS SoundFont) | Free for music made with it | Yes, but check its current terms | Re-read the license page |
| Clues written by Claude | Anthropic's commercial terms: you own the outputs | Yes | Nothing; costs grow with players |
| The name and look | Your own (not NYT's) | Yes | Keep avoiding NYT names, puzzles and look (see CLAUDE.md) |

**The word list is the only blocker.** Ways to replace it:

1. **SCOWL alone**, without Spread the Wordlist. SCOWL already gives each word a commonness level, and every 3–7
   letter answer here was reviewed by hand into Easy / Medium / Hard / Excluded tiers. Rebuild `words.txt` from
   SCOWL's levels, then do a cleanup pass for crossword-unfriendly words. That's the work Spread the Wordlist's
   scores were doing.
2. **Public-domain lists** such as ENABLE or Moby, filtered by SCOWL levels, then the same hand review.
3. **A commercial crossword list** (paid license). Check the terms before using one.

Whatever you pick, record it in WORDLISTS.md, update `WORDLIST-NOTICE.txt`, and re-run the word list tests (their
counts are tied to the list).

**Other things that change once the game is commercial:**

- The About card's "free, with no ads" and "which is why the game stays non-commercial" lines.
- The rule in CLAUDE.md that the game must stay free with no ads.
- **Donations** (Ko-fi, GitHub Sponsors) are a grey area under NC licenses. Rebuilding the word list makes this a
  non-issue.

## 2. Where ads would go

The rule: **never while someone is solving.** No ads on or near the board, during a boss fight, over the intro, or
on the campaign map. Players hate losing focus, and an ad that shifts the board under a click would make them
mistype.

| Place | Kind | Notes |
|---|---|---|
| Home, between the Daily/Unlimited row and the Worlds card | One banner | Low friction; reserve its height so nothing jumps |
| Results screen, under the score and leaderboard box | One banner | The most-seen spot, and the player has just finished |
| Unlimited, between puzzles | An interstitial every 3rd or 4th "New Puzzle" | Only between puzzles, skippable, never twice in a row |
| Stats page, below the leaderboard | One banner | Low value, low annoyance |
| **Rewarded ads** (optional, opt-in) | "Watch an ad for +1 Unlimited puzzle" or "+50 coins" | Fits the game's economy. The player chooses, so it feels fair. Don't sell abilities that make bosses trivial |
| **Never** | | The board, clue lists, boss fights, the intro, the campaign map, the story cinematics, Settings |

Keep a **"no ads" setting** off the table, unless you add a paid "remove ads" option. That would be a paid feature,
and only allowed once the word list is replaced.

## 3. How it would be built

1. **Pick a network.**
   - **Google AdSense** is the usual choice for websites. It needs:
     - site approval, with real content and a privacy policy
     - an `ads.txt` file at the site root
     - enough traffic to be worthwhile
   - **Alternatives:** Ezoic, Media.net, Carbon Ads (fewer, nicer ads).
2. **Ad slots.** Add an empty `<div class="ad-slot">` to each place above, with a fixed size so the layout doesn't
   shift. Fill it only after the page has loaded. Show nothing if an ad blocker stops it, and never nag about
   blockers.
3. **The security policy.** `SecurityHeaders.java` currently only allows the site's own scripts. Ads need the
   network's domains:
   - `script-src` and `frame-src` (e.g. `https://pagead2.googlesyndication.com`, `https://googleads.g.doubleclick.net`)
   - wider `img-src` and `connect-src`

   This is the real cost. Ad scripts are someone else's code running in your page ("malvertising" happens). Keep the
   ads in their iframes, and never let an ad script near the leaderboard or report forms.
4. **Consent before any ad loads (privacy law):**
   - **Europe and the UK (GDPR / ePrivacy):** a cookie consent banner. For AdSense in the EEA and UK, Google requires
     a Google-certified consent tool (CMP).
   - **California (CCPA/CPRA)** and other US states: a "Do Not Sell or Share" option.
   - **Children (COPPA):** the Easy level is kid-friendly. If the site could be seen as aimed at under-13s,
     personalised ads aren't allowed. The simplest safe setting is to mark the site as not child-directed and use
     non-personalised ads, or child-directed treatment if kids are an intended audience.
5. **A privacy policy page.** It must cover:
   - what's saved in the browser (progress, scores, settings)
   - what the server keeps: leaderboard names (first name + last initial), report messages
   - the ad network's cookies and tracking
6. **Performance.** Ad scripts are heavy. Load them after the game, never during a boss fight. Test on a slow phone,
   because the world backgrounds and boss effects already use the processor.

## 4. Other important things

- **Costs vs revenue.** Every new Unlimited puzzle, campaign level and reroll is a paid Claude call, and more players
  means more calls. Ads can pay for some of it, but only if the Unlimited limit (10 a day) and the rate limits stay
  in place.
- **The leaderboard.** If ads bring more players, they bring more names. Name checks and blocked words are in
  place, but a public board may also need a way to remove a name (a moderator key, like `/api/reports?key=`).
- **Hosting (Render).** The leaderboard, reports and daily puzzles are saved to disk (`PUZZLE_DIR`). On Render this
  needs a persistent disk, or they vanish on every deploy.
- **App stores.** Ads in a phone app (AdMob) have their own rules and the same license problem.
- **Taxes and payouts.** AdSense pays out above a threshold and needs tax details (a W-9 in the US). If you're
  under 18, a parent or guardian has to hold the account.

## 5. A possible order

1. Decide: ads, donations, or neither.
2. Rebuild the word list from commercially usable sources, re-review the tiers, and update WORDLISTS.md, the
   notices and the tests.
3. Write the privacy policy page, add the consent tool, and add `ads.txt`.
4. Add the ad slots (Home, results, between Unlimited puzzles), with fixed sizes and no ads during play.
5. Loosen the CSP only for the ad network's domains.
6. Apply to the ad network once the site is live with real players.
7. Update the About card and CLAUDE.md.
