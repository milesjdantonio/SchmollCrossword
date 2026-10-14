package com.crossword;

import java.io.IOException;

import org.springframework.stereotype.Component;

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/*
 * ===== Security headers =====   (written by Claude at the user's request, 2026-10-09: "make sure anything the
 * player can input couldn't run code and it's very secure")
 *
 * A "filter" runs on every request before Spring's controllers see it. This one:
 *
 *  1. Adds a Content-Security-Policy to every page. It tells the browser where code may come from: scripts only
 *     from this site's own files (no inline <script>, no eval), styles from here and Google Fonts, fonts from Google
 *     Fonts, nothing in frames. So even if someone managed to get HTML into the page (a name, a report), the browser
 *     would refuse to run it. The page never inserts player text as HTML anyway; this is the second lock.
 *  2. Adds the usual protective headers: no MIME sniffing, no framing (clickjacking), a strict referrer, and no
 *     camera/microphone/location.
 *  3. Refuses POST bodies bigger than 16 KB (a report or a leaderboard entry is well under 2 KB), before anything
 *     reads them.
 *
 * @Component makes Spring find it and put it in front of every request automatically.
 */
@Component
public class SecurityHeaders implements Filter {

    static final int MAX_POST_BYTES = 16 * 1024;

    static final String CSP = String.join("; ",
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self' 'unsafe-inline'",   // inline style="" attributes drive the animations
            "font-src 'self'",                                              // the fonts are served from this site (fonts.css)
            "img-src 'self' data: blob:",
            "media-src 'self' blob:",
            "connect-src 'self'",
            "object-src 'none'",
            "base-uri 'none'",
            "form-action 'self'",
            "frame-ancestors 'none'");

    @Override
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain) throws IOException, ServletException {
        HttpServletRequest request = (HttpServletRequest) req;
        HttpServletResponse response = (HttpServletResponse) res;
        response.setHeader("Content-Security-Policy", CSP);
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setHeader("X-Frame-Options", "DENY");
        response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
        response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
        response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
        if ("POST".equalsIgnoreCase(request.getMethod())) {
            long length = request.getContentLengthLong();
            if (length < 0 || length > MAX_POST_BYTES) {          // unknown or too big: refuse before reading it
                response.sendError(length < 0 ? HttpServletResponse.SC_LENGTH_REQUIRED : HttpServletResponse.SC_REQUEST_ENTITY_TOO_LARGE);
                return;
            }
        }
        chain.doFilter(req, res);
    }
}
