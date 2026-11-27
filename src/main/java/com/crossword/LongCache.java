package com.crossword;

import java.io.IOException;
import java.util.regex.Pattern;

import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpServletResponseWrapper;

/*
 * Files asked for by their versioned name ("js/game-<md5>.js", see IndexPage) never change: a new version of the
 * file gets a new name. So browsers may keep them for a year without checking again. Every other file keeps the
 * site's usual "check each visit" rule (no-cache in application.properties).
 */
@Component
public class LongCache extends OncePerRequestFilter {

    static final Pattern VERSIONED = Pattern.compile(".*-[0-9a-f]{32}\\.[A-Za-z0-9]+$");
    static final String FOREVER = "public, max-age=31536000, immutable";

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain) throws ServletException, IOException {
        if (!"GET".equals(req.getMethod()) && !"HEAD".equals(req.getMethod()) || !VERSIONED.matcher(req.getRequestURI()).matches()) {
            chain.doFilter(req, res);
            return;
        }
        // the file handler sets its no-cache only when it found the file, so a stale name's 404 is never kept
        chain.doFilter(req, new HttpServletResponseWrapper(res) {
            @Override public void setHeader(String name, String value) { super.setHeader(name, "Cache-Control".equalsIgnoreCase(name) ? FOREVER : value); }
            @Override public void addHeader(String name, String value) { if ("Cache-Control".equalsIgnoreCase(name)) super.setHeader(name, FOREVER); else super.addHeader(name, value); }
        });
    }
}
