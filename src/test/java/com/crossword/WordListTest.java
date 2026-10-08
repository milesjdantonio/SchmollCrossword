package com.crossword;

import static org.junit.jupiter.api.Assertions.assertEquals; // assertEquals(expected, actual): FAILS the test if they differ
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.Test; // @Test marks a method JUnit should run as one test

/*
 * ===== Step 25: JUnit =====
 *
 * These used to be PASS/FAIL lines printed by App.main. Now each check is an assert inside a @Test method:
 *   - "mvn test" runs every test class and prints a summary ("Tests run: 80, Failures: 0")
 *   - a failing assert stops THAT test and reports what was expected and what came back
 *   - the build fails if any test fails, so a broken change can't sneak through
 *
 * Steps 7, 13 and 13c: loading the word list and finding words that fit a pattern.
 */
class WordListTest {

    private final Map<Integer, List<String>> words = TestWords.everyday();

    // Step 7: findMatches with '.' wildcards
    @Test
    void findMatchesCountsWordsThatFit() {
        assertEquals(5, App.findMatches("C.T.", words).size(), "CATS, CITE, CITY, CUTE, CUTS (COTE, COTS are too hard)");
        assertEquals(1, App.findMatches("CAT", words).size(), "already a full word");
        assertEquals(2268, App.findMatches(".....", words).size(), "every everyday 5-letter word");
        assertEquals(0, App.findMatches("QZX..", words).size(), "nothing fits");
        assertEquals(0, App.findMatches("...............................", words).size(), "no words this long at all");
    }

    @Test
    void findMatchesNeverReturnsNull() {
        assertNotNull(App.findMatches("QZX..", words));
    }

    // Step 13: player-friendly word list with offensive words blocked.
    // DICK and HORNY are still in words.txt, so only the blocklist can keep them out.
    @Test
    void blocklistKeepsOffensiveWordsOut() throws IOException {
        Set<String> blocked = App.loadBlockedWords();
        assertEquals(54, blocked.size(), "keep this in sync with blocked-words.txt");
        assertTrue(blocked.contains("DICK"), "stored in UPPERCASE like the word list");
        assertEquals(0, App.findMatches("DICK", words).size());
        assertEquals(0, App.findMatches("HORNY", words).size());
        assertEquals(1, App.findMatches("DESK", words).size(), "normal words are still there");
        assertEquals(0, App.findMatches("DARB", words).size(), "obscure ENABLE words are gone");
    }

    // Step 13c: only everyday answers, with a setting to allow harder words
    @Test
    void tooHardWordsSkippedByDefault() {
        assertEquals(0, App.findMatches("OVOID", words).size());
        assertEquals(0, App.findMatches("XYLEM", words).size());
        assertEquals(1, App.findMatches("EMOJI", words).size(), "everyday words stay");
    }

    @Test
    void harderWordsSettingBringsThemBack() {
        Map<Integer, List<String>> withHardWords = TestWords.withHardWords();
        assertTrue(withHardWords.get(5).contains("OVOID"));
        assertFalse(withHardWords.get(4).contains("DICK"), "offensive words are blocked either way");
    }
}
