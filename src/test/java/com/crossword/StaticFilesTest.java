package com.crossword;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

class StaticFilesTest {

    private static String versioned(String path) {
        int dot = path.lastIndexOf('.');
        return path.substring(0, dot) + "-0123456789abcdef0123456789abcdef" + path.substring(dot);
    }

    @Test
    void thePageLinksToVersionedFiles() {
        IndexPage page = new IndexPage(StaticFilesTest::versioned, false);
        String html = page.render("<link rel=\"stylesheet\" href=\"css/app.css\"><script src=\"js/game.js\"></script>"
                + "<script src=\"vendor/rive/rive.js\"></script><a href=\"#home\">Home</a><img src=\"https://example.com/x.png\">");
        assertTrue(html.contains("href=\"css/app-0123456789abcdef0123456789abcdef.css\""), html);
        assertTrue(html.contains("src=\"js/game-0123456789abcdef0123456789abcdef.js\""), html);
        assertTrue(html.contains("src=\"vendor/rive/rive-0123456789abcdef0123456789abcdef.js\""), html);
        assertTrue(html.contains("href=\"#home\""), html);
        assertTrue(html.contains("src=\"https://example.com/x.png\""), html);
    }

    @Test
    void linksThatCantBeVersionedStayAsTheyAre() {
        IndexPage page = new IndexPage(path -> null, false);
        assertEquals("<script src=\"js/game.js\"></script>", page.render("<script src=\"js/game.js\"></script>"));
    }

    @Test
    void theRealPageHasOnlyLocalVersionableLinks() throws Exception {
        String html = new IndexPage(StaticFilesTest::versioned, false).render(IndexPage.read());
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("(?:src|href)=\"((?:js|css|vendor)/[^\"]*)\"").matcher(html);
        int links = 0;
        while (m.find()) { links++; assertTrue(m.group(1).contains("-0123456789abcdef0123456789abcdef."), "not versioned: " + m.group(1)); }
        assertTrue(links > 40, "the page should link to the game's scripts and styles");
        assertFalse(html.contains("?v="), "no query-string versions left");
    }

    // a stand-in for Spring's file handler: it sets the site's no-cache when it serves a file
    private static MockFilterChain serving(int status) {
        return new MockFilterChain(new HttpServlet() {
            @Override protected void doGet(HttpServletRequest req, HttpServletResponse res) {
                res.setStatus(status);
                if (status == 200) res.setHeader("Cache-Control", "no-cache");
            }
        });
    }

    private static MockHttpServletResponse get(String uri, int status) throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", uri);
        MockHttpServletResponse res = new MockHttpServletResponse();
        new LongCache().doFilter(req, res, serving(status));
        return res;
    }

    @Test
    void versionedFilesAreKeptForAYear() throws Exception {
        assertEquals(LongCache.FOREVER, get("/js/game-0123456789abcdef0123456789abcdef.js", 200).getHeader("Cache-Control"));
        assertEquals(LongCache.FOREVER, get("/fonts/x-0123456789abcdef0123456789abcdef.woff2", 200).getHeader("Cache-Control"));
    }

    @Test
    void plainNamesAreStillCheckedEveryVisit() throws Exception {
        assertEquals("no-cache", get("/js/game.js", 200).getHeader("Cache-Control"));
        assertEquals("no-cache", get("/rive/sky-win.riv", 200).getHeader("Cache-Control"));
    }

    @Test
    void aStaleVersionsNotFoundIsNotKept() throws Exception {
        assertNull(get("/js/game-0123456789abcdef0123456789abcdef.js", 404).getHeader("Cache-Control"));
    }
}
