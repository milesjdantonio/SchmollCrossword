package com.crossword;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.function.UnaryOperator;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.resource.ResourceUrlProvider;

/*
 * The game's page (index.html), with every script and stylesheet it links to named by its content:
 * "js/game.js" becomes "js/game-<md5>.js". Those names change whenever a file changes, so browsers may keep them
 * for a year (LongCache) and a visit after an update fetches only what changed. The page itself is always checked
 * for a newer version (no-cache), and files the code loads later by their plain name stay no-cache too.
 * The versions come from Spring's resource chain (spring.web.resources.chain.* in application.properties).
 */
@RestController
public class IndexPage {

    // src="js/..." and href="css/..." (also vendor/ and fonts/), relative, with no query string
    static final Pattern LINK = Pattern.compile("(src|href)=\"((?:js|css|vendor|fonts)/[^\"?#]+)\"");

    private final UnaryOperator<String> versionOf;
    private final boolean keep;
    private volatile String page;

    @Autowired
    public IndexPage(ResourceUrlProvider urls, @Value("${spring.web.resources.chain.cache:true}") boolean keep) {
        this(path -> urls.getForLookupPath(path), keep);
    }

    // versionOf: "/js/x.js" -> "/js/x-<md5>.js" (or null when it isn't versioned)
    IndexPage(UnaryOperator<String> versionOf, boolean keep) {
        this.versionOf = versionOf;
        this.keep = keep;
    }

    @GetMapping(value = { "/", "/index.html" }, produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> index() throws IOException {
        String html = page;
        if (html == null || !keep) {
            html = render(read());
            if (keep) page = html;
        }
        return ResponseEntity.ok().cacheControl(CacheControl.noCache()).contentType(MediaType.TEXT_HTML).body(html);
    }

    static String read() throws IOException {
        try (InputStream in = new ClassPathResource("static/index.html").getInputStream()) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    // Swaps each local script/stylesheet link for its versioned name (links it can't version stay as they are)
    String render(String html) {
        Matcher m = LINK.matcher(html);
        StringBuilder out = new StringBuilder(html.length() + 4096);
        while (m.find()) {
            String versioned = versionOf.apply("/" + m.group(2));
            String path = versioned == null ? m.group(2) : versioned.substring(1);
            m.appendReplacement(out, Matcher.quoteReplacement(m.group(1) + "=\"" + path + "\""));
        }
        m.appendTail(out);
        return out.toString();
    }
}
