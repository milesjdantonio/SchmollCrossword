package com.crossword;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

// Campaign lessons (Lesson.java): every level teaches a skill, the course repeats skills harder, the prompt gets the
// lesson, and the grid builder prefers grids that suit it. Never reaches Claude.
class LessonTest {

    @Test
    void everyLevelHasALessonAndEveryBossReviewsFour() {
        for (Campaign.Section s : Campaign.SECTIONS) {
            for (int level = 1; level < Campaign.LEVELS; level++) {
                Lesson.Level lesson = Lesson.of(s.world(), level);
                assertNotNull(lesson.skill(), s.world() + " " + level);
                assertFalse(lesson.skill().clues().isBlank());
                assertTrue(List.of("par", "brisk", "fast", "nocheck", "clean").contains(lesson.skill().star()), lesson.skill().star());
            }
            Lesson.Level boss = Lesson.of(s.world(), Campaign.LEVELS);
            assertEquals(4, boss.review().size(), s.world());
            assertTrue(Lesson.clueFocus(s.world(), Campaign.LEVELS).startsWith("This is a review"));
        }
    }

    // The goal (the user's): keep improving the player by making them practise different things. So no world
    // repeats a skill, every skill in the list is used, and most skills come back later for another round.
    @Test
    void theCourseCoversEverySkillAndBringsThemBack() {
        Set<String> used = new HashSet<>();
        for (Campaign.Section s : Campaign.SECTIONS) {
            List<String> course = Lesson.COURSE.get(s.world());
            assertEquals(4, course.size(), s.world());
            assertEquals(4, new HashSet<>(course).size(), s.world() + " repeats a skill");
            used.addAll(course);
        }
        assertEquals(Lesson.SKILLS.keySet(), used, "every skill is taught somewhere");
        int comeBack = 0;
        for (String id : Lesson.SKILLS.keySet()) {
            int times = 0;
            for (List<String> course : Lesson.COURSE.values()) if (course.contains(id)) times++;
            if (times >= 2) comeBack++;
        }
        assertTrue(comeBack >= 12, comeBack + " skills come back");
        assertEquals("Wordplay and '?' clues", Lesson.of("candy", 1).name());
        assertEquals("Wordplay and '?' clues II", Lesson.of("rain", 1).name(), "the second time is round II");
        assertTrue(Lesson.clueFocus("rain", 1).contains("round 2"));
    }

    @Test
    void theThemedLessonsNameTheirWorldsTheme() {
        assertTrue(Lesson.clueFocus("squirrel", 2).contains("forests and autumn"));
        assertFalse(Lesson.clueFocus("squirrel", 2).contains("THEME"));
    }

    @Test
    void thePromptCarriesTheLesson() {
        String prompt = ClueWriter.buildPrompt(List.of("DESK", "CATS"), "easy", Lesson.clueFocus("paper", 3));
        assertTrue(prompt.contains("lesson in a crossword-solving course"));
        assertTrue(prompt.contains("plural"));
        assertTrue(prompt.indexOf("lesson") < prompt.indexOf("Answers (one per line)"), "the lesson comes before the answers");
        assertFalse(ClueWriter.buildPrompt(List.of("DESK"), "easy").contains("lesson"), "normal puzzles have no lesson");
    }

    @Test
    void favorScoreCountsWhatTheLessonWants() {
        assertEquals(2, Lesson.favorScore("plurals", List.of("CATS", "DOGS", "GRASS", "TREE")));
        assertEquals(3, Lesson.favorScore("tense", List.of("RACED", "SINGING", "BAKER", "TREE")));
        assertEquals(1, Lesson.favorScore("long", List.of("ORANGE", "CAT")));
        assertEquals(0, Lesson.favorScore("", List.of("CATS")));
    }

    // The plurals lesson's grid has at least as many plural answers as a normal grid from the same seed
    @Test
    void thePluralsLessonGetsAGridWithMorePlurals() {
        var words = TestWords.easy();
        int normal = 0, lesson = 0;
        for (long seed = 1; seed <= 4; seed++) {
            normal += plurals(PuzzleStore.buildGrid(seed, words, Set.of(), ""));
            lesson += plurals(PuzzleStore.buildGrid(seed, words, Set.of(), "plurals"));
        }
        assertTrue(lesson > normal, "lesson grids " + lesson + " vs normal " + normal);
    }
    private static int plurals(char[][] grid) {
        List<String> answers = new ArrayList<>();
        for (Slot slot : Slot.findAllSlots(PuzzleStore.SHAPE)) answers.add(slot.getPattern(grid));
        return Lesson.favorScore("plurals", answers);
    }

    @Test
    void theMapJsonHasALessonForEveryLevel() throws Exception {
        JsonNode map = new ObjectMapper().readTree(Campaign.mapJson());
        for (JsonNode s : map) {
            assertEquals(Campaign.LEVELS, s.get("lessons").size());
            assertEquals("review", s.get("lessons").get(4).get("id").asText());
            assertFalse(s.get("lessons").get(0).get("tip").asText().isBlank());
        }
    }
}
