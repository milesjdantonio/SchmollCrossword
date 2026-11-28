package com.crossword;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.ByteArrayInputStream;
import java.awt.image.BufferedImage;
import javax.imageio.ImageIO;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

// Shared results: a preview page and a picture, made only from the link's numbers and the puzzle's shape
class ShareControllerTest {

    @Test
    void thePageHasPreviewTagsAndOpensThePuzzle() {
        ShareController.Result r = ShareController.parse("2026-11-02", "medium", 125, 2, 0, 0, 0);
        String html = ShareController.page(r, "https://example.com");
        assertTrue(html.contains("og:image\" content=\"https://example.com/r/2026-11-02/medium/card.png?t=125&amp;c=2&amp;r=0&amp;s=0\""));
        assertTrue(html.contains("Daily Medium · Nov 2 · Solved in 2:05"));
        assertTrue(html.contains("2 Checked"));
        assertTrue(html.contains("url=/?play=daily&amp;d=medium&amp;date=2026-11-02"));
    }

    @Test
    void noAnswersInThePageOrThePicture() throws Exception {
        ShareController.Result r = ShareController.parse("2026-11-02", "hard", 90, 0, 0, 0, 1);
        String html = ShareController.page(r, "https://example.com");
        for (String answer : PuzzleStore.answersIn(PuzzleStore.shippedDaily("2026-11-02-hard.json"))) assertFalse(html.contains(answer), answer);
        boolean[][] shape = ShareController.shape(r);
        assertEquals(5, shape.length);
        BufferedImage img = ImageIO.read(new ByteArrayInputStream(ShareController.draw(r, shape)));
        assertEquals(1200, img.getWidth());
        assertEquals(630, img.getHeight());
    }

    @Test
    void badLinksAreRefused() {
        assertEquals(HttpStatus.NOT_FOUND, assertThrows(ResponseStatusException.class, () -> ShareController.parse("2026-11-02", "banana", 1, 0, 0, 0, 0)).getStatusCode());
        assertEquals(HttpStatus.NOT_FOUND, assertThrows(ResponseStatusException.class, () -> ShareController.parse("2020-01-01", "easy", 1, 0, 0, 0, 0)).getStatusCode());
        assertEquals(HttpStatus.BAD_REQUEST, assertThrows(ResponseStatusException.class, () -> ShareController.parse("2026-11-02", "easy", -5, 0, 0, 0, 0)).getStatusCode());
        assertEquals(HttpStatus.BAD_REQUEST, assertThrows(ResponseStatusException.class, () -> ShareController.parse("yesterday", "easy", 1, 0, 0, 0, 0)).getStatusCode());
    }
}
