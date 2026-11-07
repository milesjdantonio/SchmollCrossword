package com.crossword;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/*
 * Design options to pick from, at http://localhost:8080/demo (files in src/main/resources/demo/). Served only when
 * SHOW_DEMO is on: it is by default, for a local server, and the Dockerfile turns it off, so the live site never
 * shows them. Never cached, so a new option shows up on the next reload.
 */
@Configuration
public class DemoPages implements WebMvcConfigurer {

    private final boolean on;

    public DemoPages(@Value("${schmoll.demo}") boolean on) {
        this.on = on;
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        if (on) registry.addResourceHandler("/demo/**").addResourceLocations("classpath:/demo/").setCacheControl(CacheControl.noCache());
    }

    @Override
    public void addViewControllers(ViewControllerRegistry registry) {
        if (!on) return;
        registry.addRedirectViewController("/demo", "/demo/");
        registry.addViewController("/demo/").setViewName("forward:/demo/index.html");
    }
}
