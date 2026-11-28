package com.crossword;

import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Font;
import java.awt.FontMetrics;
import java.awt.GradientPaint;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.geom.RoundRectangle2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import javax.imageio.ImageIO;

import org.springframework.core.io.ClassPathResource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

/*
 * Shared results: a link that shows a picture and a line of text when it's pasted into a chat, and opens the puzzle.
 *
 *   /r/2026-11-27/medium?t=125&c=0&r=0         a page for link previews (title, description, picture) that sends a
 *                                              person on to that daily (today's, or that day in the Daily Archive)
 *   /r/2026-11-27/medium/card.png?t=125&...    the picture: the puzzle's shape (its black squares only, never a
 *                                              letter), the day, the difficulty, the time and the hints used
 *
 * Everything on them comes from the link's numbers and the puzzle's shape: no answers, no names, nothing typed by a
 * player. Only saved or shipped dailies are read (a share never makes a puzzle). t = seconds, c = squares checked,
 * r = squares revealed, s = the Daily Boss's stars, p = 1 for practice (the Daily Archive).
 */
@RestController
public class ShareController {

    static final List<String> KINDS = List.of("easy", "medium", "hard", "challenge", "boss");
    static final int W = 1200, H = 630;
    private static final Map<String, Color> ACCENT = Map.of(
            "easy", new Color(0x2f9e63), "medium", new Color(0xd9941a), "hard", new Color(0xd2413f),
            "challenge", new Color(0x6a55d6), "boss", new Color(0x7a2a8a));

    // a few hundred pictures kept, newest last (the same link always draws the same picture)
    private final Map<String, byte[]> cards = new LinkedHashMap<>(64, 0.75f, true) {
        @Override protected boolean removeEldestEntry(Map.Entry<String, byte[]> e) { return size() > 300; }
    };

    record Result(LocalDate date, String kind, int seconds, int checked, int revealed, int stars, boolean practice) {
        String timeText() { return seconds / 60 + ":" + String.format("%02d", seconds % 60); }
        String kindName() { return Character.toUpperCase(kind.charAt(0)) + kind.substring(1); }
        String hintsText() {
            if (kind.equals("boss")) return stars + (stars == 1 ? " Star" : " Stars");
            if (checked == 0 && revealed == 0) return "No Hints";
            List<String> parts = new ArrayList<>();
            if (checked > 0) parts.add(checked + " Checked");
            if (revealed > 0) parts.add(revealed + " Revealed");
            return String.join(" · ", parts);
        }
        String key() { return date + "/" + kind + "/" + seconds + "/" + checked + "/" + revealed + "/" + stars + "/" + practice; }
    }

    // the link's numbers, checked: a bad one is HTTP 400, an unknown day or kind 404
    static Result parse(String date, String kind, int t, int c, int r, int s, int p) {
        LocalDate day;
        try {
            day = LocalDate.parse(date);
        } catch (java.time.format.DateTimeParseException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "date must look like 2026-10-08");
        }
        if (!KINDS.contains(kind)) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "no such puzzle");
        if (day.isBefore(ArchiveController.FIRST_DAY) || day.isAfter(LocalDate.now().plusDays(1))) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "no such day");
        if (t < 0 || t > 86_399 || c < 0 || c > 400 || r < 0 || r > 400 || s < 0 || s > 3) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "bad numbers");
        return new Result(day, kind, t, c, r, s, p == 1);
    }

    @GetMapping(value = "/r/{date}/{kind}", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> page(@PathVariable String date, @PathVariable String kind,
                                       @RequestParam(defaultValue = "0") int t, @RequestParam(defaultValue = "0") int c, @RequestParam(defaultValue = "0") int r,
                                       @RequestParam(defaultValue = "0") int s, @RequestParam(defaultValue = "0") int p) {
        Result res = parse(date, kind, t, c, r, s, p);
        String base = ServletUriComponentsBuilder.fromCurrentContextPath().build().toUriString();
        return ResponseEntity.ok().cacheControl(CacheControl.noCache()).contentType(MediaType.TEXT_HTML).body(page(res, base));
    }

    static String page(Result res, String base) {
        String day = res.date.format(DateTimeFormatter.ofPattern("EEEE, MMMM d", Locale.US));
        String title = (res.kind.equals("boss") ? "Daily Boss" : "Daily " + res.kindName()) + " · " + res.date.format(DateTimeFormatter.ofPattern("MMM d", Locale.US)) + " · Solved in " + res.timeText();
        String desc = res.hintsText() + (res.practice ? " (practice, from the Daily Archive)" : "") + ". " + day + "'s puzzle on Schmoll Crossword, free every day. Can you beat it?";
        String query = "t=" + res.seconds + "&c=" + res.checked + "&r=" + res.revealed + "&s=" + res.stars + (res.practice ? "&p=1" : "");
        String image = base + "/r/" + res.date + "/" + res.kind + "/card.png?" + query;
        String open = "/?play=" + (res.kind.equals("boss") ? "boss" : "daily") + "&d=" + res.kind + "&date=" + res.date;
        return "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">"
                + "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
                + "<title>" + esc(title) + "</title>"
                + "<meta name=\"description\" content=\"" + esc(desc) + "\">"
                + "<meta property=\"og:type\" content=\"website\"><meta property=\"og:site_name\" content=\"Schmoll Crossword\">"
                + "<meta property=\"og:title\" content=\"" + esc(title) + "\"><meta property=\"og:description\" content=\"" + esc(desc) + "\">"
                + "<meta property=\"og:image\" content=\"" + esc(image) + "\"><meta property=\"og:image:width\" content=\"" + W + "\"><meta property=\"og:image:height\" content=\"" + H + "\">"
                + "<meta property=\"og:image:alt\" content=\"" + esc(title + ". " + res.hintsText()) + "\">"
                + "<meta name=\"twitter:card\" content=\"summary_large_image\"><meta name=\"twitter:title\" content=\"" + esc(title) + "\">"
                + "<meta name=\"twitter:description\" content=\"" + esc(desc) + "\"><meta name=\"twitter:image\" content=\"" + esc(image) + "\">"
                + "<meta http-equiv=\"refresh\" content=\"0; url=" + esc(open) + "\">"
                + "</head><body style=\"font-family:sans-serif;text-align:center;padding:40px\"><p>" + esc(title) + "</p>"
                + "<p><a href=\"" + esc(open) + "\">Play this puzzle</a></p></body></html>";
    }
    static String esc(String s) { return s.replace("&", "&amp;").replace("\"", "&quot;").replace("<", "&lt;").replace(">", "&gt;"); }

    @GetMapping(value = "/r/{date}/{kind}/card.png", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> card(@PathVariable String date, @PathVariable String kind,
                                       @RequestParam(defaultValue = "0") int t, @RequestParam(defaultValue = "0") int c, @RequestParam(defaultValue = "0") int r,
                                       @RequestParam(defaultValue = "0") int s, @RequestParam(defaultValue = "0") int p) throws IOException {
        Result res = parse(date, kind, t, c, r, s, p);
        byte[] png;
        synchronized (cards) { png = cards.get(res.key()); }
        if (png == null) {
            png = draw(res, shape(res));
            synchronized (cards) { cards.put(res.key(), png); }
        }
        return ResponseEntity.ok().cacheControl(CacheControl.maxAge(java.time.Duration.ofDays(30)).cachePublic()).contentType(MediaType.IMAGE_PNG).body(png);
    }

    // the puzzle's black squares (true), from its saved or shipped file; null if there's none (the Daily Boss, or a
    // day without that puzzle): the card then shows a plain grid
    static boolean[][] shape(Result res) throws IOException {
        if (res.kind.equals("boss")) return null;
        String file = PuzzleStore.dailyFile(PuzzleStore.DAILY_FOLDER, res.date, res.kind).getFileName().toString();
        String json = PuzzleStore.readSaved(PuzzleStore.DAILY_FOLDER.resolve(file));
        if (json == null) json = PuzzleStore.shippedDaily(file);
        if (json == null) return null;
        Matcher m = Pattern.compile("\"solution\"\\s*:\\s*\\[([^\\]]*)\\]").matcher(json);
        if (!m.find()) return null;
        List<String> rows = new ArrayList<>();
        Matcher row = Pattern.compile("\"([A-Z.]+)\"").matcher(m.group(1));
        while (row.find()) rows.add(row.group(1));
        if (rows.isEmpty()) return null;
        boolean[][] out = new boolean[rows.size()][];
        for (int i = 0; i < rows.size(); i++) {
            String line = rows.get(i);
            out[i] = new boolean[line.length()];
            for (int j = 0; j < line.length(); j++) out[i][j] = line.charAt(j) == '.';
        }
        return out;
    }

    // ---- the picture ----
    private static Font headFont, bodyFont;
    private static synchronized Font font(boolean head, float size) {
        try {
            if (head && headFont == null) headFont = load("static/fonts/LilitaOne-Regular.ttf");
            if (!head && bodyFont == null) bodyFont = load("static/fonts/Quicksandwght.ttf");
        } catch (Exception e) { /* the system's sans-serif instead */ }
        Font f = head ? headFont : bodyFont;
        return f == null ? new Font(Font.SANS_SERIF, head ? Font.BOLD : Font.PLAIN, Math.round(size)) : f.deriveFont(head ? Font.PLAIN : Font.BOLD, size);
    }
    private static Font load(String path) throws Exception {
        try (InputStream in = new ClassPathResource(path).getInputStream()) { return Font.createFont(Font.TRUETYPE_FONT, in); }
    }

    static byte[] draw(Result res, boolean[][] shape) throws IOException {
        BufferedImage img = new BufferedImage(W, H, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_FRACTIONALMETRICS, RenderingHints.VALUE_FRACTIONALMETRICS_ON);
        Color accent = ACCENT.get(res.kind), ink = new Color(0x2b2233), paper = new Color(0xfbf6ee);
        g.setColor(paper);
        g.fillRect(0, 0, W, H);
        // the left panel in the difficulty's colour, with the grid on it
        g.setPaint(new GradientPaint(0, 0, accent.brighter(), 0, H, accent));
        g.fillRect(0, 0, 520, H);
        int n = shape != null ? shape.length : (res.kind.equals("challenge") ? 7 : 5);
        int size = 380, gap = 6, x0 = 70, y0 = (H - size) / 2, cell = (size - gap * (n + 1)) / n;
        g.setColor(new Color(0x1f1a26));
        g.fill(new RoundRectangle2D.Double(x0 - 8, y0 - 8, size + 16, size + 16, 26, 26));
        for (int i = 0; i < n; i++) for (int j = 0; j < n; j++) {
            boolean block = shape != null && i < shape.length && j < shape[i].length && shape[i][j];
            int x = x0 + gap + j * (cell + gap), y = y0 + gap + i * (cell + gap);
            if (block) continue;
            g.setColor(res.revealed > 0 && (i * n + j) % 7 == 3 ? new Color(0xd8e6ff) : new Color(0xfffdf8));
            g.fill(new RoundRectangle2D.Double(x, y, cell, cell, 8, 8));
            g.setColor(new Color(accent.getRed(), accent.getGreen(), accent.getBlue(), 150));
            g.setStroke(new BasicStroke(Math.max(3, cell / 12f), BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
            int cx = x + cell / 2, cy = y + cell / 2, k = cell / 5;
            g.drawPolyline(new int[] { cx - k, cx - k / 4, cx + k }, new int[] { cy, cy + k * 3 / 4, cy - k * 3 / 4 }, 3);
        }
        // the words on the right
        int tx = 580;
        g.setColor(ink);
        g.setFont(font(false, 28));
        g.drawString("SCHMOLL CROSSWORD", tx, 120);
        g.setColor(accent.darker());
        g.setFont(font(true, 76));
        g.drawString(res.kind.equals("boss") ? "Daily Boss" : res.kindName(), tx, 205);
        g.setColor(ink);
        g.setFont(font(false, 34));
        g.drawString(res.date.format(DateTimeFormatter.ofPattern("EEEE, MMMM d", Locale.US)), tx, 255);
        g.setFont(font(true, 120));
        g.drawString(res.timeText(), tx, 395);
        g.setFont(font(false, 36));
        String line = res.hintsText() + (res.practice ? " · Practice" : "");
        FontMetrics fm = g.getFontMetrics();
        int pw = fm.stringWidth(line) + 44;
        g.setColor(new Color(accent.getRed(), accent.getGreen(), accent.getBlue(), 40));
        g.fill(new RoundRectangle2D.Double(tx, 425, pw, 60, 60, 60));
        g.setColor(accent.darker());
        g.drawString(line, tx + 22, 467);
        g.setColor(new Color(0x6b6178));
        g.setFont(font(false, 28));
        g.drawString("Free puzzles every day. Can you beat it?", tx, 560);
        g.dispose();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(img, "png", out);
        return out.toByteArray();
    }
}
