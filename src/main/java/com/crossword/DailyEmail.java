package com.crossword;

import java.time.LocalDate;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/*
 * One email a day to the developer with the HealthReport: dailies in stock, failed jobs, what Claude cost, players
 * and reports. Sent only when the host sets the mail server (SPRING_MAIL_HOST, SPRING_MAIL_USERNAME,
 * SPRING_MAIL_PASSWORD) and REPORT_EMAIL_TO; otherwise it does nothing. A failed send is logged and never affects
 * players.
 */
@Component
public class DailyEmail {

    private static final Logger LOG = LoggerFactory.getLogger(DailyEmail.class);

    private final ObjectProvider<JavaMailSender> mail;
    private final HealthReport health;
    private final String to;
    private final String from;

    public DailyEmail(ObjectProvider<JavaMailSender> mail, HealthReport health,
                      @Value("${schmoll.email.to:}") String to, @Value("${schmoll.email.from:}") String from) {
        this.mail = mail;
        this.health = health;
        this.to = to == null ? "" : to.trim();
        this.from = from == null ? "" : from.trim();
    }

    @Scheduled(cron = "${schmoll.email.cron}")
    public void send() {
        JavaMailSender sender = mail.getIfAvailable();
        if (sender == null || to.isEmpty()) return;
        LocalDate today = LocalDate.now();
        try {
            SimpleMailMessage m = new SimpleMailMessage();
            m.setTo(to);
            if (!from.isEmpty()) m.setFrom(from);
            m.setSubject("Schmoll Crossword: daily summary for " + today);
            m.setText(health.text(today));
            sender.send(m);
            LOG.info("Daily summary emailed");
        } catch (Exception e) {
            LOG.warn("Couldn't send the daily summary ({})", e.getMessage());
        }
    }
}
