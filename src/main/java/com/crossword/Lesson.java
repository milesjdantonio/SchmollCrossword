package com.crossword;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/*
 * Campaign lessons (written by Claude at the user's request, 2026-10-09): the campaign is a course. Its goal is to
 * keep improving the player's skill, making them practise something different on every level until they solve like
 * a professional. So every level is a LESSON in one crossword skill:
 *   - its clues are written to train that skill (the instructions below go into Claude's prompt, see ClueWriter)
 *   - its grid is picked to suit it where that makes sense (more plurals for the plurals lesson, see favorScore)
 *   - its third star is a goal that fits the skill (a speed lesson wants speed, a clean-solve lesson few wrong letters)
 * Skills come back in later worlds, harder each time (Wordplay I, II, III), and each boss is a review of its
 * world's four lessons.
 */
public class Lesson {

    // A skill: its id, its name, what you practise, a tip, the instructions for the clue writer, what the grid
    // should favor ("" = nothing special) and the goal for the third star:
    //   par = under the par time, brisk = under 3/4 of par, fast = under 60% of par,
    //   nocheck = 4 wrong letters typed or fewer, clean = 1 at most (the campaign has no Check or Reveal)
    record Skill(String id, String name, String practise, String tip, String clues, String favors, String star) {}

    static final Map<String, Skill> SKILLS = new LinkedHashMap<>();
    private static void skill(String id, String name, String practise, String tip, String clues, String favors, String star) {
        SKILLS.put(id, new Skill(id, name, practise, tip, clues, favors, star));
    }
    static {
        skill("definitions", "Straight definitions", "Turning a plain definition into its word.",
            "Say the clue in your head and ask: what is the one word for exactly that?",
            "Every clue is a straight, exact definition of the answer (no wordplay, no fill-in-the-blanks).", "", "par");
        skill("blanks", "Fill in the blank", "Finishing well-known phrases and sayings.",
            "Say the whole phrase out loud with a hum for the gap. The missing word usually pops right out.",
            "At least half of the clues are fill-in-the-blanks (___) of very well-known phrases, sayings or titles, where only the answer fits the blank.", "", "nocheck");
        skill("plurals", "Plurals", "Spotting plural clues and plural answers.",
            "A plural clue ('Pets', 'They bark') means a plural answer, often ending in S. Pencil in the S first.",
            "Make the grammar do the teaching: clue every plural answer with a clearly plural clue, and every singular answer with a clearly singular one.", "plurals", "par");
        skill("tense", "Tenses and word forms", "Matching the clue's tense and form (-ED, -ING, -ER).",
            "Read the clue's verb: 'Ran' wants a past tense (-ED, or a word like SAT), 'Running' wants -ING.",
            "Make the grammar do the teaching: past-tense answers get past-tense clues, -ING answers -ING clues, -ER answers clues for a person or thing that does something.", "tense", "par");
        skill("crossings", "Use the crossings", "Solving a hard word with the easy words that cross it.",
            "Stuck on an Across? Fill in the Downs that cross it first, then read the letters you have.",
            "Make the Across clues on the harder side for this difficulty and the Down clues very easy, so the solver learns to use the Downs to crack the Acrosses.", "", "clean");
        skill("synonyms", "Synonyms", "Finding a word that means the same thing.",
            "Short clue, short answer: look for a word with the same meaning AND the same part of speech.",
            "Most clues are one or two words long and are synonyms of the answer, in the same part of speech ('Huge' for GIANT).", "", "brisk");
        skill("categories", "Examples and categories", "Reading 'e.g.', 'for one' and 'Kind of...' clues.",
            "'Oak, for one' points UP to the group (TREE). 'Tree, e.g.' points DOWN to an example. 'Kind of...' wants one type.",
            "Use many example and category clues: 'X, for one', 'X, e.g.', 'Kind of X', 'One of the X'. Vary which direction they point.", "", "nocheck");
        skill("speech", "Things people say", "Answers that are something said out loud.",
            "Quotation marks mean the answer is something you would SAY in that moment: \"Me too!\" could be SAME.",
            "Clue as many answers as you can as something a person would say, inside quotation marks ('\"Me too!\"' for SAME).", "", "par");
        skill("speed", "Speed solving", "Solving fast: fill what you know, keep moving.",
            "Don't stare at one clue. Fill every answer you know right away, then the crossings fill the gaps.",
            "Keep every clue direct and quick to read, so the challenge is speed. Short clues.", "", "fast");
        skill("wordplay", "Wordplay and '?' clues", "Puns and clues that aren't meant literally.",
            "A question mark means don't take it literally: think puns, jokes and second meanings.",
            "About a third of the clues are puns or wordplay, each ending with '?'. They must still point to one answer.", "", "nocheck");
        skill("double", "Double meanings", "Words with more than one meaning.",
            "If the obvious meaning doesn't fit, try the word's other meaning: a BAT can be a flyer or a swinger.",
            "Clue several common answers by a less obvious but well-known meaning (BAT as the flying animal in a sports-looking clue), fairly, without '?'.", "", "par");
        skill("misdirection", "Misdirection", "Clues that make you think of the wrong thing.",
            "Every clue starts with a capital, so 'Polish' might just be 'polish'. And a noun in the clue might really be a verb.",
            "Use fair misdirection: words that work as noun and verb, a capitalized first word that hides an everyday word, a misleading but true reading. No '?'.", "", "nocheck");
        skill("parts", "Parts of speech", "Reading the clue's grammar: verb, noun or describing word.",
            "Swap the answer into the clue's sentence. 'To run quickly' wants a verb; 'Quick' wants a describing word.",
            "Mix verbs, nouns and adjectives, and make each clue's grammar show the answer's part of speech clearly.", "", "brisk");
        skill("theme", "Themed puzzles", "Using a shared topic to guess faster.",
            "Themed puzzles share a topic. Once you spot it, think of words from that topic.",
            "Connect as many clues as you naturally can to the world's theme (THEME), without forcing any.", "", "par");
        skill("long", "Long answers", "Cracking the long answers that hold a big grid together.",
            "Get a few letters into a long answer from the short words crossing it. Long words often show themselves early.",
            "Give the long answers (6 letters or more) clear clues: they are the key to the grid.", "long", "par");
        skill("clean", "Clean solve", "Solving cleanly: trusting letters that work both ways.",
            "Before you type, read each letter across AND down. Only trust letters that make sense in both words.",
            "Mix every clue type fairly, so a careful solver can finish without help.", "", "clean");
        skill("mixed", "Everything at once", "Using every trick you've learned.",
            "Use every tool: crossings, grammar, '?' puns, quotes, examples and second meanings.",
            "Mix every clue type: definitions, fill-in-the-blanks, examples, quotes, puns with '?', double meanings and fair misdirection.", "", "clean");
    }

    // Each world's theme, for the themed lessons
    static final Map<String, String> THEMES = Map.ofEntries(
        Map.entry("paper", "school and notebooks"), Map.entry("garden", "gardens, plants and bugs"), Map.entry("squirrel", "forests and autumn"),
        Map.entry("candy", "sweets and treats"), Map.entry("ocean", "the sea"), Map.entry("snow", "winter and snow"),
        Map.entry("rain", "rainy weather and the city"), Map.entry("sky", "flight and the sky"), Map.entry("desert", "deserts and travel"),
        Map.entry("carnival", "circuses and fairs"), Map.entry("arcade", "video games"), Map.entry("robot", "machines and technology"),
        Map.entry("library", "books and ghost stories"), Map.entry("volcano", "fire and the earth"), Map.entry("space", "outer space"),
        Map.entry("rift", "angels, heaven and the stars"));

    // The course: each world's four lessons (levels 1-4), easiest skills first. Skills come back later, harder,
    // in bigger grids with tougher words. Level 5 (the boss) reviews the world's four.
    static final Map<String, List<String>> COURSE = Map.ofEntries(
        Map.entry("paper",    List.of("definitions", "blanks", "plurals", "speed")),
        Map.entry("garden",   List.of("synonyms", "tense", "categories", "crossings")),
        Map.entry("squirrel", List.of("speech", "theme", "double", "speed")),
        Map.entry("candy",    List.of("wordplay", "parts", "blanks", "clean")),
        Map.entry("ocean",    List.of("long", "crossings", "theme", "double")),
        Map.entry("snow",     List.of("misdirection", "synonyms", "tense", "speed")),
        Map.entry("rain",     List.of("wordplay", "categories", "long", "clean")),
        Map.entry("sky",      List.of("double", "speech", "theme", "parts")),
        Map.entry("desert",   List.of("misdirection", "crossings", "long", "speed")),
        Map.entry("carnival", List.of("wordplay", "double", "theme", "clean")),
        Map.entry("arcade",   List.of("misdirection", "speech", "parts", "speed")),
        Map.entry("library",  List.of("long", "crossings", "wordplay", "clean")),       // world 12 (swapped with the robot)
        Map.entry("robot",    List.of("theme", "misdirection", "double", "mixed")),     // world 13
        Map.entry("volcano",  List.of("long", "wordplay", "speed", "clean")),
        Map.entry("space",    List.of("mixed", "misdirection", "theme", "clean")),
        // the secret world (2026-10-14): only 3 levels, the hardest of the course, and the angel reviews them
        Map.entry("rift",     List.of("double", "misdirection", "mixed")));

    // A level's lesson. Level 5 is the boss's review: null skill, and the four lessons in `review`.
    record Level(Skill skill, int round, List<Skill> review) {
        String name() {
            if (skill == null) return "Boss review";
            return skill.name() + (round > 1 ? " " + "I".repeat(Math.min(round, 3)) : "");      // Wordplay II, Wordplay III
        }
    }

    // The lesson for a world's level (null for an unknown world)
    static Level of(String world, int level) {
        List<String> course = COURSE.get(world);
        if (course == null) return null;
        Campaign.Section section = Campaign.section(world);
        if (section != null && !Campaign.hasLevel(section, level)) return null;     // the rift has no level 4
        if (level >= Campaign.LEVELS) {
            List<Skill> review = new ArrayList<>();
            for (String id : course) review.add(SKILLS.get(id));
            return new Level(null, 0, review);
        }
        String id = course.get(level - 1);
        return new Level(SKILLS.get(id), round(world, level), List.of());
    }

    // Which time this skill comes up in the course (1 = the first time); later rounds are harder
    static int round(String world, int level) {
        String id = COURSE.get(world).get(level - 1);
        int n = 0;
        for (Campaign.Section s : Campaign.ALL) {
            List<String> course = COURSE.get(s.world());
            for (int l = 1; l <= course.size(); l++) {
                if (course.get(l - 1).equals(id)) n++;
                if (s.world().equals(world) && l == level) return n;
            }
        }
        return n;
    }

    // What the clue writer should do for this level ("" = nothing special)
    static String clueFocus(String world, int level) {
        Level lesson = of(world, level);
        if (lesson == null) return "";
        String theme = THEMES.getOrDefault(world, "the world");
        if (lesson.skill() == null) {
            StringBuilder sb = new StringBuilder("This is a review of four skills. Spread these across the clues:\n");
            for (Skill s : lesson.review()) sb.append("- ").append(s.clues().replace("THEME", theme)).append("\n");
            return sb.toString();
        }
        String focus = lesson.skill().clues().replace("THEME", theme);
        if (lesson.round() >= 2) focus += " This skill comes back for round " + lesson.round() + ", so make these clues a step trickier than an introduction would be (still fair).";
        else focus += " This is the first time the solver practises this, so keep the examples clear and teachable.";
        return focus;
    }

    // How well a grid's answers suit a lesson (higher = better); the grid builder keeps the best of several grids
    static int favorScore(String favors, List<String> answers) {
        int score = 0;
        for (String a : answers) {
            switch (favors) {
                case "plurals" -> { if (a.endsWith("S") && !a.endsWith("SS")) score++; }
                case "tense" -> { if (a.endsWith("ED") || a.endsWith("ING") || a.endsWith("ER")) score++; }
                case "long" -> { if (a.length() >= 6) score++; }
                default -> { }
            }
        }
        return score;
    }
    static String favors(String world, int level) {
        Level lesson = of(world, level);
        return lesson == null || lesson.skill() == null ? "" : lesson.skill().favors();
    }

    // The lessons as JSON for the map: {"name":..,"practise":..,"tip":..,"star":..,"id":..}
    static String json(String world, int level) {
        Level lesson = of(world, level);
        if (lesson == null) return "null";
        if (lesson.skill() == null) {
            StringBuilder names = new StringBuilder();
            for (Skill s : lesson.review()) names.append(names.length() > 0 ? ", " : "").append(s.name());
            return "{\"id\":\"review\",\"name\":\"Boss review\",\"practise\":" + quote("Everything from this world: " + names + ".")
                + ",\"tip\":" + quote("Each word you finish hits the boss. Use the skills from this world's " + (lesson.review().size() == 3 ? "three" : "four") + " levels.") + ",\"star\":\"boss\"}";
        }
        Skill s = lesson.skill();
        return "{\"id\":" + quote(s.id()) + ",\"name\":" + quote(lesson.name()) + ",\"round\":" + lesson.round() + ",\"practise\":" + quote(s.practise())
            + ",\"tip\":" + quote(s.tip()) + ",\"star\":" + quote(s.star()) + "}";
    }
    static String quote(String s) {
        return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
    }
}
