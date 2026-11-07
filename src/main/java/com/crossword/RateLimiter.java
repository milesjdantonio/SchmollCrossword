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
 * A "person" is an IPv4 address, or an IPv6 address's first 64 bits: one home or phone is usually given a whole
 * /64 block, so counting each IPv6 address apart would let one person through thousands of times.
 *
 * Memory stays small: a refused request never adds anyone, and people with nothing left in their window are
 * forgotten (checked at most once a minute, so a flood doesn't make every request scan everyone).
 *
 * The time is passed in (nowMillis) instead of read from the clock, so tests can pretend an hour went by.
 */
public class RateLimiter {

    static final long HOUR = 60 * 60 * 1000L;   // in milliseconds
    static final long DAY = 24 * HOUR;
    static final long SWEEP_EVERY = 60 * 1000L;

    private final int perPersonPerHour;     // the most one person may make inside personWindow (an hour, unless changed)
    private final long personWindow;
    private final int everyonePerDay;
    private final Map<String, Deque<Long>> recentByPerson = new HashMap<>();   // person -> times of their recent requests
    private final Deque<Long> recentForEveryone = new ArrayDeque<>();          // times of everyone's requests in the last day
    private long lastSweep = Long.MIN_VALUE / 2;

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
    synchronized int remaining(String address, long nowMillis) {
        Deque<Long> theirs = recentByPerson.get(person(address));
        if (theirs != null) dropOlderThan(theirs, nowMillis - personWindow);
        return Math.max(0, perPersonPerHour - (theirs == null ? 0 : theirs.size()));
    }

    // When they're out: seconds until their oldest one drops out of the window and they get one back (else 0)
    synchronized long secondsUntilNext(String address, long nowMillis) {
        Deque<Long> theirs = recentByPerson.get(person(address));
        if (theirs == null || theirs.isEmpty() || remaining(address, nowMillis) > 0) return 0;
        return Math.max(1, (theirs.peekFirst() + personWindow - nowMillis + 999) / 1000);
    }

    int limit() {
        return perPersonPerHour;
    }

    // true = go ahead (and the request is counted); false = over a limit (nothing is counted).
    // "synchronized" because the server answers several requests at the same time (like PuzzleStore.getDaily).
    synchronized boolean allow(String address, long nowMillis) {
        String person = person(address);
        dropOlderThan(recentForEveryone, nowMillis - DAY);
        if (nowMillis - lastSweep >= SWEEP_EVERY) {
            // forget people with nothing left in their window, so the map doesn't grow forever
            recentByPerson.values().removeIf(times -> {
                dropOlderThan(times, nowMillis - personWindow);
                return times.isEmpty();
            });
            lastSweep = nowMillis;
        }
        Deque<Long> theirs = recentByPerson.get(person);
        if (theirs != null) dropOlderThan(theirs, nowMillis - personWindow);

        if ((theirs != null && theirs.size() >= perPersonPerHour) || recentForEveryone.size() >= everyonePerDay) {
            return false;
        }
        if (theirs == null) recentByPerson.put(person, theirs = new ArrayDeque<>());
        theirs.addLast(nowMillis);
        recentForEveryone.addLast(nowMillis);
        return true;
    }

    /*
     * Who an address belongs to: an IPv4 address as it is; an IPv6 address cut to its first four groups (its /64),
     * written out in full so "2001:db8::1" and "2001:0db8:0:0::2" match; an IPv4 address written as IPv6
     * ("::ffff:1.2.3.4") as the IPv4 one. Anything else (a test's "alice") is used as it is. Never looks anything up.
     */
    static String person(String address) {
        if (address == null) return "";
        String a = address.trim();
        if (a.startsWith("[") && a.endsWith("]")) a = a.substring(1, a.length() - 1);
        int zone = a.indexOf('%');
        if (zone >= 0) a = a.substring(0, zone);
        if (a.indexOf(':') < 0) return a;
        String lower = a.toLowerCase();
        if (lower.startsWith("::ffff:") && lower.indexOf('.') > 0) return lower.substring(7);
        String[] groups = expand(lower);
        if (groups == null) return lower;
        return groups[0] + ":" + groups[1] + ":" + groups[2] + ":" + groups[3] + "::/64";
    }

    // "2001:db8::1" -> the 8 groups without leading zeros (null if it isn't an IPv6 address)
    private static String[] expand(String a) {
        if (a.indexOf('.') >= 0) return null;                      // an embedded IPv4 tail: rare, use as it is
        int gap = a.indexOf("::");
        if (gap != a.lastIndexOf("::")) return null;
        String[] head = gap < 0 ? a.split(":", -1) : (gap == 0 ? new String[0] : a.substring(0, gap).split(":", -1));
        String[] tail = gap < 0 ? new String[0] : (gap + 2 >= a.length() ? new String[0] : a.substring(gap + 2).split(":", -1));
        int missing = 8 - head.length - tail.length;
        if ((gap < 0 && head.length != 8) || (gap >= 0 && missing < 1)) return null;
        String[] out = new String[8];
        int i = 0;
        for (String g : head) out[i++] = group(g);
        for (int k = 0; k < (gap < 0 ? 0 : missing); k++) out[i++] = "0";
        for (String g : tail) out[i++] = group(g);
        for (String g : out) if (g == null) return null;
        return out;
    }

    private static String group(String g) {
        if (g.isEmpty() || g.length() > 4 || !g.matches("[0-9a-f]+")) return null;
        String s = g.replaceFirst("^0+(?=.)", "");
        return s;
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
