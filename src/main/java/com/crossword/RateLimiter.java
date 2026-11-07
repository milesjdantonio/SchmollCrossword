package com.crossword;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashMap;
import java.util.Map;

/*
 * Rate limits for anything a player can send many times (reports, leaderboard posts), so one person (or a bot)
 * can't flood the server. Two limits:
 *
 *   - per person: at most `perPersonPerHour` requests in any 60 minutes (a "person" is an IP address)
 *   - everyone together: at most `everyonePerDay` requests in any 24 hours, a hard cap
 *
 * It's a "sliding window":
 * keep the times of recent requests in a queue, drop the ones older than the window from the front,
 * and allow a new request only if the queue is still shorter than the limit.
 *
 * The time is passed in (nowMillis) instead of read from the clock, so tests can pretend an hour went by.
 */
public class RateLimiter {

    static final long HOUR = 60 * 60 * 1000L;   // in milliseconds
    static final long DAY = 24 * HOUR;

    private final int perPersonPerHour;     // the most one person may make inside personWindow (an hour, unless changed)
    private final long personWindow;
    private final int everyonePerDay;
    private final Map<String, Deque<Long>> recentByPerson = new HashMap<>();   // IP address -> times of their recent puzzles
    private final Deque<Long> recentForEveryone = new ArrayDeque<>();          // times of everyone's puzzles in the last day

    RateLimiter(int perPersonPerHour, int everyonePerDay) {
        this(perPersonPerHour, HOUR, everyonePerDay);
    }

    // The per-person window can be longer, e.g. 10 a day
    RateLimiter(int perPerson, long personWindowMillis, int everyonePerDay) {
        this.perPersonPerHour = perPerson;
        this.personWindow = personWindowMillis;
        this.everyonePerDay = everyonePerDay;
    }

    // How many more this person may make right now (for the website's "7 of 10 left" message)
    synchronized int remaining(String person, long nowMillis) {
        Deque<Long> theirs = recentByPerson.get(person);
        if (theirs != null) dropOlderThan(theirs, nowMillis - personWindow);
        return Math.max(0, perPersonPerHour - (theirs == null ? 0 : theirs.size()));
    }

    // When they're out: seconds until their oldest one drops out of the window and they get one back (else 0)
    synchronized long secondsUntilNext(String person, long nowMillis) {
        Deque<Long> theirs = recentByPerson.get(person);
        if (theirs == null || theirs.isEmpty() || remaining(person, nowMillis) > 0) return 0;
        return Math.max(1, (theirs.peekFirst() + personWindow - nowMillis + 999) / 1000);
    }

    int limit() {
        return perPersonPerHour;
    }

    // true = go ahead (and the request is counted); false = over a limit (nothing is counted).
    // "synchronized" because the server answers several requests at the same time (like PuzzleStore.getDaily).
    synchronized boolean allow(String person, long nowMillis) {
        dropOlderThan(recentForEveryone, nowMillis - DAY);
        Deque<Long> theirs = recentByPerson.computeIfAbsent(person, p -> new ArrayDeque<>());
        dropOlderThan(theirs, nowMillis - personWindow);

        if (theirs.size() >= perPersonPerHour || recentForEveryone.size() >= everyonePerDay) {
            return false;
        }
        theirs.addLast(nowMillis);
        recentForEveryone.addLast(nowMillis);

        // Forget people with nothing in the last hour, so the map doesn't grow forever
        recentByPerson.values().removeIf(times -> {
            dropOlderThan(times, nowMillis - personWindow);
            return times.isEmpty();
        });
        return true;
    }

    // Times are added in order, so the oldest is always at the front
    private static void dropOlderThan(Deque<Long> times, long cutoff) {
        while (!times.isEmpty() && times.peekFirst() <= cutoff) {
            times.removeFirst();
        }
    }

    // How many people the limiter is tracking right now (for the tests)
    synchronized int peopleTracked() {
        return recentByPerson.size();
    }
}
