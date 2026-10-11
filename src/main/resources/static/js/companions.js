// The campaign's companions (written by Claude at the user's request, 2026-10-09: "significantly more text for the
// campaign, like lore stuff, when clicking on them"). Each world's mascot is your companion there, with its own
// story about its world, its page of the Lost Everbook and the boss who took it.
//
//   Companions.click()          clicking the mascot on the map or in a campaign level: the next piece of its story
//                               (saved, so it picks up where it left off), then chat once the story's told
//   Companions.greet(world)     the map scrolls to a world: the companion says hello (its intro, the first time)
//   Companions.level(world, n)  a line for the start of levels 1-4
//   Companions.boss(world, k)   k = before / win / lose / during
//
// Shown with textContent, like every line the mascot says.

const Companions = (() => {
    const C = {
        paper: {
            intro: "Oh! A solver! I'm Pip. I've been sharpening myself for weeks waiting for someone like you.",
            lore: [
                "This Notebook is where words get their first draft. Every word in the Everbook was scribbled here once.",
                "The Big Eraser used to be the nicest eraser on the desk. It fixed mistakes. Then it decided everything was a mistake.",
                "It took our page, the very first page of the Everbook. Without it, new words come out smudged.",
                "See the margins? The doodles get fainter every night. The Eraser rubs a little more while we sleep.",
                "I'm only a pencil, but I've got a whole dictionary's worth of lead left in me. Let's use it well.",
                "Grandpa Graphite said the Everbook was written by everyone who ever solved a puzzle. That includes you now.",
                "Beat the Eraser and our page goes into your book. Fourteen more after that. No pressure!",
                "Fun fact: I'm a number two pencil. We say that proudly."
            ],
            levels: ["Level one! Write the easy ones first. They're stepping stones.", "The lines on this page are crooked. The Eraser's been nibbling at them.",
                "Halfway through the Notebook. I can smell rubber shavings. It's close.", "One more page of practice, then the Eraser. Warm up those hands."],
            boss: { before: "There it is: the Big Eraser. Finish words fast so it can't scrub them!", win: "The page is back! Look, the doodles are coming back to life!",
                lose: "It rubbed us out this time. Erasers get tired too. Let's go again.", during: ["It's wobbling! Keep writing!", "Write faster than it can erase!", "Ha! It missed a spot!"] },
            idle: ["I like your handwriting. Very confident.", "Stuck? Try the shortest word. They're friendly.", "Sharpening... sharpening... okay, ready."],
            done: ["The Notebook feels full again. Thank you.", "The Eraser's back to fixing typos. Honestly, it seems happier."]
        },
        garden: {
            intro: "Bzz! I'm Bumble. The Garden used to hum. Now it barely whispers. Will you help?",
            lore: [
                "Every flower here grew from a word. Roses from 'remember', sunflowers from 'hello'. I'm not making that up.",
                "Queen Thistle came over the hedge one spring and planted the Everbook's page right in the middle bed.",
                "Now nothing grows there but thorns. She says words are weeds, and weeds should be pulled.",
                "The other bees left for the orchard. I stayed. Someone has to keep the flowers company.",
                "Thistle isn't all bad. Thistles feed goldfinches. She's just forgotten that she's part of the garden too.",
                "When the page comes back, the Garden blooms overnight. I saw it happen once, years ago. Best night of my life.",
                "My job is pollen. Yours is letters. Same idea really: carry a little bit from one place to the next.",
                "Bee tip: crossing words are like neighbouring flowers. Fill one and the next gets easier."
            ],
            levels: ["First bed! The soil's still soft here.", "Watch your step. The thorns start around here.",
                "I can see her castle of brambles from here. Keep going!", "Last patch before the Queen. Let's make it bloom."],
            boss: { before: "Queen Thistle! Stay sharp. She'll wrap your words in thorns.", win: "The page is free! Look, the buds are opening!",
                lose: "Ouch. Thorns everywhere. Let's rest and try again.", during: ["Prune her back!", "Keep the words growing!", "Bzz! You're ahead!"] },
            idle: ["I'd offer you honey, but my hands are full of pollen.", "Bzz... sorry, I hum when I think.", "Bees dance to give directions. I'm dancing now. Left a bit."],
            done: ["The Garden hums again. Hear it?", "Thistle's planting daisies now. Small ones. It's a start."]
        },
        squirrel: {
            intro: "Hi hi hi! Hazel! I lost my acorns. Also my words. Mostly the words. Help?",
            lore: [
                "Acorn Woods runs on memory. We bury nuts all autumn and find them again with the words we carve on the trees.",
                "Old Grumbleowl took our page and stuffed it in the hollow of the oldest oak. Now the trees say nothing.",
                "He hoots every clue backwards. Ever tried finding an acorn with a backwards map? Terrible.",
                "Grumbleowl wasn't always grumpy. He used to teach the owlets to read by moonlight.",
                "Then the Void's wind blew through, and he got scared someone would take the last words. So he took them first.",
                "My tail is my blanket, my umbrella and my balance. Very useful tail.",
                "Win the page and everyone in the woods finds their stash. I've got 412 acorns out there somewhere.",
                "Squirrel tip: if one spot's empty, dig somewhere else. Same with clues."
            ],
            levels: ["First tree! Climb, climb!", "I buried something under this one. Probably.",
                "Shh. Owl country starts here. Quiet paws.", "The old oak's just ahead. Let's get you sharp."],
            boss: { before: "Old Grumbleowl! Don't let him hoot your clues upside down!", win: "The page! And my acorns! All 412! Okay, 411.",
                lose: "He hooted us right out of the tree. We'll climb back up.", during: ["Faster than an owl blinks!", "Nuts to him!", "You're winning! I think!"] },
            idle: ["Is that an acorn? No. A pinecone. Rude.", "I'm not fidgeting, I'm thinking with my whole body.", "Squirrels forget most of their nuts. That's how forests grow."],
            done: ["The trees are talking again. Mostly about the weather.", "Grumbleowl teaches the owlets again. He hoots the right way round now."]
        },
        candy: {
            intro: "Hi, I'm Gummy! Sorry if I wobble. Everything's been wobbly since the syrup.",
            lore: [
                "Candy Hills used to taste like whatever word you said. 'Birthday' tasted like cake. 'Monday' tasted like plain toast.",
                "King Sourgum dissolved our page in a vat of sour syrup. Now every word tastes like vinegar.",
                "He was the sweetest king once. Then he ate one sour candy and decided sour was the only honest flavour.",
                "I'm made of gelatin and optimism. Mostly optimism.",
                "The lollipop trees are drooping. They need words to stand up straight. Same as the rest of us.",
                "Fish the page out and the Hills get their flavours back. I want to taste 'sunshine' again.",
                "Candy tip: break hard clues into small pieces. Like a jawbreaker. Lick, lick, crack.",
                "My cousins live in a jar on somebody's desk. They say hi. Probably."
            ],
            levels: ["Gumdrop path! Mind the sticky bits.", "The air's getting sour. Scrunch your nose and keep going.",
                "That's the syrup lake. Don't fall in. It's very puckery.", "The castle's next. It's made of sour gum. Ew."],
            boss: { before: "King Sourgum! Don't let him make your letters sticky!", win: "The page is out of the syrup! Everything tastes sweet again!",
                lose: "Bleh. Too sour. Let's get the taste out and try again.", during: ["Sweet moves!", "Keep it sugary!", "He's turning even greener!"] },
            idle: ["I jiggle when I'm happy. And when I'm nervous. And when I walk.", "Want a gumdrop? It's sour. Sorry.", "If you squeeze me I squeak. Please don't."],
            done: ["Sunshine tastes like lemonade. Who knew?", "Sourgum makes sweet-and-sour now. A compromise!"]
        },
        ocean: {
            intro: "Hello up there! I'm Otto. Eight arms, and all of them ready to help.",
            lore: [
                "The reef glows because of words. Every coral is a sentence that grew a little each day.",
                "The Kraken dragged our page to the deepest trench and wrapped it in eight arms. Eight! Same as me.",
                "Okay, confession: the Kraken is my uncle. Uncle Krak. He used to give the best hugs.",
                "Then the Void's cold current reached the trench, and he got scared of the dark. He's holding the page like a nightlight.",
                "Without the page the fish swim in circles. They forgot the word for 'forward'.",
                "I change colour with my mood. Right now I'm 'hopeful blue'. Earlier I was 'nervous beige'.",
                "Get the page back and I'll invite Uncle Krak up for dinner. He loves kelp lasagne.",
                "Octopus tip: use all your arms. Across and Down, both at once."
            ],
            levels: ["Shallow water! Warm and easy.", "The colours are fading here. Can you see?",
                "Deeper now. Bring a word to light the way.", "The trench is right below us. Deep breath. Well, you breathe. I'm fine."],
            boss: { before: "Uncle Krak! It's me, Otto! ...He can't hear me. Race him!", win: "The page! And Uncle Krak let go. He looks relieved, actually.",
                lose: "His arms are too long today. Let's try again. I believe in you.", during: ["Ink him back!", "Swim faster!", "You've got him on the run!"] },
            idle: ["Octopuses have three hearts. All three of mine like you.", "I'm camouflaged. That's a joke. I'm right here.", "Bloop."],
            done: ["The reef glows again. Uncle Krak's coming to dinner on Thursday.", "The fish know 'forward' again. They're showing off."]
        },
        snow: {
            intro: "Oh good, a visitor! I'm Pebble. Sorry about the cold. It's been cold for a year.",
            lore: [
                "Snow Day was supposed to be one day. One perfect day off, every winter. Now it's Snow Year.",
                "The Yeti froze our page inside a glacier, and the whole valley froze with it.",
                "Everyone thinks the Yeti is scary. He's mostly lonely. Nobody visits a glacier.",
                "I knitted this hat from leftover words. You can still read 'cozy' on the brim if you squint.",
                "The cabin up the hill keeps its fire going. That's where I warm my flippers between levels.",
                "Thaw the page and spring comes all at once. Puddles everywhere. It'll be wonderful.",
                "Penguin tip: slide when you can, waddle when you must. Easy words first, hard ones after.",
                "I can't fly, but I swim very fast. Different skills. Like Across and Down."
            ],
            levels: ["Fresh snow! Leave good footprints.", "The wind's picking up. Keep your scarf on.",
                "That's the glacier glinting up there.", "Last stretch. I'll keep the cocoa warm."],
            boss: { before: "The Yeti! Don't freeze up! Keep your fingers moving!", win: "The ice is cracking! Spring! I can hear it dripping!",
                lose: "Brr. Back to the cabin to thaw out, then again.", during: ["Melt him with speed!", "Keep sliding!", "You're warmer than he is!"] },
            idle: ["Huddle up. It's warmer that way.", "I'm not shivering, I'm vibrating with excitement.", "No two snowflakes are alike. Same with puzzles."],
            done: ["It's spring! I don't know what to do with all this sunshine.", "The Yeti came down to the cabin. He's surprisingly good at checkers."]
        },
        rain: {
            intro: "Ribbit! Puddles, at your service. Mind the gutters. The words are running.",
            lore: [
                "Rainy City loves rain. Rain makes the streets shine. But this storm doesn't stop.",
                "Thunderhead parked over the city and soaked every street sign until the words dripped right off.",
                "Our page is somewhere inside the storm. I've seen it flash between the lightning.",
                "Thunderhead plays jazz on the rooftops. Loud jazz. All night. Saxophone and thunder.",
                "I like rain. I'm a frog. But even I'd like to read a menu sometimes.",
                "This hat was my grandma's. She said a good hat keeps your thoughts dry.",
                "Win the page and the signs come back, the cafés reopen and the jazz gets quieter. A little.",
                "Frog tip: hop between words. One lily pad at a time."
            ],
            levels: ["First puddle! Jump in, it's shallow.", "The gutters are full of loose letters. Grab some.",
                "Thunder's getting closer. Count the seconds.", "Rooftop level. Thunderhead's right above us."],
            boss: { before: "Thunderhead! Don't let the flood wash your words away!", win: "The storm's breaking! The signs are coming back!",
                lose: "Washed out. Dry off and try again, friend.", during: ["Hop to it!", "Faster than lightning!", "He's running out of thunder!"] },
            idle: ["Splish. Sorry, can't help it.", "Want my jazz impression? Ribbit... bop.", "Rain is just the sky saying hello a lot."],
            done: ["Sunshine and a little drizzle. Perfect frog weather.", "Thunderhead plays at the café now. Softly. Mostly."]
        },
        sky: {
            intro: "Pip here! The bird, not the pencil. No relation. People ask.",
            lore: [
                "The Sky Kingdom carries the world's letters. Every word ever sent flew past these islands once.",
                "Sir Squall blew our page so high that it's stuck in his castle in the clouds.",
                "He used to be the royal wind. He helped every kite fly. Then he decided he was king of the air.",
                "I fly the mail route. Well, I did. You can't deliver words when the page is missing.",
                "These goggles have seen a hundred storms. Never one as grumpy as Squall.",
                "Balloon tip: let go of the heavy stuff. If a clue's dragging you down, try another one.",
                "Get the page back and the post flies again. I've got three years of birthday cards to deliver.",
                "I'm round because I'm aerodynamic. That's my story and I'm sticking to it."
            ],
            levels: ["Take-off! Easy winds today.", "Turbulence ahead. Hold on to your letters.",
                "We're above the clouds now. Lovely view, right?", "The castle's in sight. Squall's windows are rattling."],
            boss: { before: "Sir Squall! Don't get blown off course. Finish words fast!", win: "Got it! The page is drifting right into your book!",
                lose: "Blown away. Literally. Let's circle back.", during: ["Fly faster!", "Ride his wind!", "He's out of breath!"] },
            idle: ["Gliding is just resting with style.", "Some birds sleep while flying. Not me. I'd crash.", "Wind check: breezy, with a chance of words."],
            done: ["The post is flying again. Your birthday card's in the bag.", "Squall's back to flying kites. He's very good at it."]
        },
        desert: {
            intro: "Shh, listen. Hear that? Nothing. That's the problem. Hi, I'm Sandy.",
            lore: [
                "Caravans cross these dunes on stories. Every campfire, someone tells one, and stories are made of words.",
                "The Sphinx buried our page under the dunes and guards it with riddles.",
                "Every traveller who answers wrong forgets one word. My uncle forgot 'left'. He walks in circles now.",
                "These ears hear everything. I heard the Sphinx muttering riddles in its sleep. It practises.",
                "The Sphinx isn't cruel. It loves a good riddle more than anything, and it's very, very bored.",
                "Desert tip: the answer's often hiding in plain sight, like a fox in the sand.",
                "Win the page and the caravans can tell stories again. I want to hear the one about the moon.",
                "I sleep all day and run all night. Puzzles fit perfectly in between."
            ],
            levels: ["Soft sand! Easy walking.", "Oasis ahead. Or a mirage. Let's find out.",
                "Dunes everywhere. Stay on the path of letters.", "The Sphinx's shadow is huge from here."],
            boss: { before: "The Sphinx! Answer fast, and don't let it twist your clues!", win: "The page! The dunes are whispering words again!",
                lose: "The sand swallowed us. Shake it off and try again.", during: ["Quick as a fox!", "You out-riddled it!", "Keep digging!"] },
            idle: ["My ears can hear you thinking. It's a nice sound.", "Sand gets everywhere. Everywhere.", "Riddle: what has keys but no locks? A keyboard. You're using one!"],
            done: ["Campfires every night now. Stories everywhere.", "The Sphinx runs a riddle club. Wrong answers get a second try."]
        },
        carnival: {
            intro: "Step right up! Kernel's the name, popping's the game! Okay, puzzles are the game. Popping's a hobby.",
            lore: [
                "The Big Top runs on words. Every act has a name, every ride has a sign, every joke needs a punchline.",
                "The Ringmaster made our page the star of his show: shot from cannons, juggled, hidden under shells.",
                "The crowd loves it. The page is exhausted. Words need rest, you know.",
                "I was popped right here, by the Ferris wheel. Best seat in the house.",
                "The Ringmaster isn't evil. He just never knows when a show should end.",
                "Carnival tip: every trick has a secret. Watch the hands, not the hat.",
                "Win the page and the rides get their names back. The Tilt-a-Whirl is currently just 'Whirl'. It's confused.",
                "If I pop too much, I get smaller. Please don't make me nervous."
            ],
            levels: ["First ride! Keep your arms inside.", "The games booth! Every prize is a word.",
                "The tent's getting louder. Showtime's close.", "Backstage! The Ringmaster's warming up his cane."],
            boss: { before: "The Ringmaster! Steal the show! Don't let him juggle your letters!", win: "Ladies and gentlemen: the page! Take a bow!",
                lose: "Tough crowd. The show must go on. Let's try again.", during: ["Encore!", "You're the main act now!", "He's losing the crowd!"] },
            idle: ["Pop! Sorry. Pop! Sorry.", "Butter makes everything better. Except puzzles. Sticky.", "Ever been on the Ferris wheel at night? Next time."],
            done: ["The Tilt-a-Whirl has its tilt back.", "The Ringmaster gives the page a day off every week. Union rules."]
        },
        arcade: {
            intro: "PLAYER ONE DETECTED. Hi! I'm Bit. One bit, the smallest piece of data. But brave.",
            lore: [
                "The arcade's machines speak in words: GAME OVER, HIGH SCORE, INSERT COIN. Classic poetry.",
                "Glitch crawled into the cabinets and corrupted our page into garbage code.",
                "Now every screen says ERR0R. With a zero. That's how you know it's bad.",
                "Glitch used to be a tiny bug. Nobody fixed it, and it grew.",
                "I'm one bit, so I'm either 0 or 1. Today I'm a 1. Optimistic.",
                "Arcade tip: patterns repeat. Learn the pattern, beat the level.",
                "Restore the page and the high scores come back. I was fourth on the dot-eating game.",
                "Press any key to continue. Kidding. Just keep solving."
            ],
            levels: ["LEVEL 1. Tutorial vibes.", "The scanlines are getting fuzzy. Glitch is close.",
                "Bonus round! Every word is worth double. Not really. But it feels like it.", "Last level before the boss. Save your lives!"],
            boss: { before: "BOSS BATTLE: GLITCH. Don't let it scramble your squares!", win: "PAGE RESTORED. NEW HIGH SCORE!",
                lose: "GAME OVER. Insert coin? Coins are free here. Try again.", during: ["Combo!", "Frame-perfect!", "Glitch is lagging!"] },
            idle: ["01001000 01101001. That's 'Hi'.", "Beep boop. Sorry, wrong arcade.", "Old arcade games ran on less memory than this sentence."],
            done: ["HIGH SCORES RESTORED. You're at the top.", "Glitch is a speedrun trick now. Officially a feature."]
        },
        library: {
            intro: "Oh! A living reader. Welcome. I'm Boo. Please mind the floating candles.",
            lore: [
                "This library holds a copy of every book ever written. Ghosts like me keep them dusted. Forever. It's a long job.",
                "The Phantom Librarian bound our page into a book that reads itself backwards.",
                "I was his apprentice. He taught me to shelve by moonlight and never dog-ear a page.",
                "Then he decided books were too precious to read. Now anyone who reads out loud gets shushed into silence.",
                "These glasses don't help me see. Ghosts see fine. They help me look studious.",
                "Library tip: if a clue sounds strange, read it again slowly. It's usually telling you something.",
                "Free the page and the reading rooms open again. Children, noise, crumbs. I can't wait.",
                "I'm not scary. I'm a little see-through. There's a difference."
            ],
            levels: ["Front desk. Quiet please. Well, quiet-ish.", "The fiction section. The books are whispering.",
                "The restricted section. Keep a candle close.", "The Phantom's office is just past the archive."],
            boss: { before: "The Phantom Librarian! Don't let him possess your clues!", win: "The page! The books are reading forwards again!",
                lose: "Shushed. For now. We'll be back after hours.", during: ["Turn the page faster!", "Read it out loud!", "He's fading!"] },
            idle: ["Boo! Sorry. Habit.", "I've read every book here twice. The dictionary three times.", "Overdue? Don't worry. Ghosts don't charge fines."],
            done: ["The reading rooms are full. Crumbs everywhere. I love it.", "The Phantom reads bedtime stories now. Forwards."]
        },
        robot: {
            intro: "HELLO. I AM BOLT. Sorry, that was loud. Hello. I'm Bolt.",
            lore: [
                "The factory builds everything: toasters, rockets, the spring in your pen. Every machine starts as a word on a blueprint.",
                "Mega Unit X decided words were inefficient and fed our page into the shredder, one line at a time.",
                "Now the machines only beep. I'm the only one who still talks. I keep a dictionary in my chest panel.",
                "Mega Unit X built me, actually. I was its spell-checker. Then it deleted spell-check.",
                "My face is a screen. Right now it shows a smile. I picked a nice one.",
                "Robot tip: if something doesn't compute, reboot. Look away, look back, try the crossing word.",
                "Shut down Mega Unit X and the factory makes words again. I'd like a new font.",
                "I run on batteries and encouragement. You're providing both."
            ],
            levels: ["Assembly line one. Nice and steady.", "Conveyor speed increasing. Keep up.",
                "Warning lights. Normal. Probably.", "Mega Unit X's control room is next. Charging up."],
            boss: { before: "MEGA UNIT X. Its systems are strong. Your words are stronger. Go!", win: "Shutdown complete. The page is safe. Beep of joy!",
                lose: "System failure. Rebooting. Let's run that again.", during: ["Overclocked!", "Error in its favour? Not today!", "Efficiency: yours!"] },
            idle: ["Processing... processing... I like you.", "Fun fact: I'm 40% screws.", "My screen has 12 emotions. This is number 7: proud."],
            done: ["The factory hums with words now. I asked for a new font.", "Mega Unit X is a spell-checker now. A very thorough one."]
        },
        volcano: {
            intro: "Hey hey! I'm Ember. Don't touch me, I'm hot. Literally. Nice to meet you!",
            lore: [
                "Volcano Island is where words get forged. Strong words like 'brave' and 'stubborn' were hammered out right here.",
                "Magma Wyrm swallowed our page and sleeps on it in the heart of the volcano.",
                "Every time it snores, the island shakes and another word melts.",
                "The Wyrm used to guard the forge. It loved warm words. Then it fell asleep and dreamed it owned them.",
                "I'm a lava blob. I was born when a word melted. I think it was 'cheerful'.",
                "Island tip: hard clues are like rock. Heat them up and they soften.",
                "Pull out the page and the forge lights up again. The island stops shaking, too.",
                "The palm trees are my best friends. Very patient. Not very fireproof."
            ],
            levels: ["Beach level! Warm sand, easy words.", "The jungle's steaming. Keep cool.",
                "Rumble... that's the Wyrm snoring.", "The crater's edge. Very hot up here. For you. I love it."],
            boss: { before: "Magma Wyrm! Don't let the lava melt your letters!", win: "The page! It's warm, but it's whole! The island stopped shaking!",
                lose: "Melted. Cool down and try again.", during: ["Hot streak!", "You're on fire! In a good way!", "It's cooling off!"] },
            idle: ["Sizzle. Sorry. Happy sizzle.", "I could toast a marshmallow for you. Carefully.", "Lava is basically rock having a really good day."],
            done: ["The forge is lit. I made you a word: 'champion'.", "The Wyrm guards the forge again. Awake this time."]
        },
        space: {
            intro: "Nova reporting. The signal's weak out here. The Void eats everything, even radio.",
            lore: [
                "This is where it started. The Void tore the Everbook apart and threw its pages to every world you've visited.",
                "The Void isn't a monster, exactly. It's an empty space that wants to stay empty. Words fill things up.",
                "Every page you've won back is in your book. That's why the Void has been watching you.",
                "I was sent to map the stars. Every star has a name, and names are words. You can see the problem.",
                "My suit is rated for the vacuum of space. Not for a vacuum of meaning. Let's be quick.",
                "Space tip: when everything's dark, find the brightest letter and build from there.",
                "Beat the Void and the Everbook is whole again. Every word, back where it belongs.",
                "I've seen fourteen worlds through your eyes. Thank you for the view."
            ],
            levels: ["Launch! Low orbit, easy start.", "Asteroid field. Dodge the hard clues.",
                "The stars are going out ahead. The Void is close.", "Final approach. Everything you've learned, use it now."],
            boss: { before: "The Void. Every word you know against nothing at all. Let's finish the book.", win: "The Everbook is whole! The stars have their names back!",
                lose: "Lost the signal. Regroup, recharge and try again. It can be beaten.", during: ["Hold the line!", "Every word is light!", "It's shrinking!"] },
            idle: ["Beep. That's me thinking in space.", "Zero gravity makes my thoughts float off. Hold on.", "Space is silent, so I hum to keep us company."],
            done: ["Every star has its name back. I'm making a map.", "The Void's quiet now. Turns out it just needed a dictionary."]
        }
    };

    const state = () => U.store.get("companions", {});
    const setState = s => U.store.set("companions", s);
    const pick = list => list[Math.floor(Math.random() * list.length)];
    const has = world => !!C[world];
    const inCampaign = () => U.view() === "campaign" || (U.view() === "level" && typeof Campaign !== "undefined" && Campaign.playing && !Campaign.playing.special);

    // the next piece of the companion's story, then chat (and how it feels about its world once the page is back)
    function click() {
        const w = Worlds.current && Worlds.current.id;
        if (!inCampaign() || !has(w)) return null;
        const s = state(), c = C[w], seen = s[w] || 0;
        if (seen < c.lore.length) { s[w] = seen + 1; setState(s); return c.lore[seen]; }
        const won = typeof Campaign !== "undefined" && Campaign.pageWon && Campaign.pageWon(w);
        return pick([...c.idle, ...(won ? c.done : [])]);
    }
    // the map arrives at a world: hello (its intro the first time you see it)
    function greet(w) {
        if (!has(w)) return null;
        const s = state(), key = "met-" + w;
        if (!s[key]) { s[key] = 1; setState(s); return [C[w].intro, "Click me any time and I'll tell you about this place."]; }
        return Math.random() < 0.35 ? pick(C[w].idle) : null;
    }
    const level = (w, n) => (has(w) && C[w].levels[n - 1]) || null;
    const boss = (w, k) => { if (!has(w)) return null; const v = C[w].boss[k]; return Array.isArray(v) ? pick(v) : v || null; };
    const loreLeft = w => (has(w) ? Math.max(0, C[w].lore.length - (state()[w] || 0)) : 0);

    return { click, greet, level, boss, loreLeft, has, list: C };
})();
