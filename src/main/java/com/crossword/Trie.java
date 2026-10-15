package com.crossword;

import java.util.ArrayList;
import java.util.List;

/*
 * A Trie (a tree of letters) for fast pattern lookups.
 *
 * A Trie stores words by their letters, one level per letter. Words that start the same way
 * share the same path, e.g. CAT, CATS and CUTE:
 *
 *            (root)
 *              |
 *              C
 *            /   \
 *           A     U
 *           |     |
 *           T*    T
 *           |     |
 *           S*    E*        * = a word ends here
 *
 * For a pattern like "C.T." it only walks paths that can still match: at 'C' it goes straight to the C branch,
 * at '.' it tries each child, at 'T' it only follows T. Words starting with A, B, D... are never touched.
 */
public class Trie {

    // One spot in the tree. children[0] is the 'A' branch, children[1] is 'B', ... children[25] is 'Z'.
    static class Node {
        Node[] children = new Node[26];
        boolean endsWord; // true if a word ends at this node (the * in the picture)
    }

    Node root = new Node();

    // Add one UPPERCASE word (A-Z only), creating any missing nodes along its path
    void insert(String word) {
        Node node = root;
        for (int i = 0; i < word.length(); i++) {
            int letter = word.charAt(i) - 'A'; // 'A' -> 0, 'B' -> 1, ... (chars are numbers underneath)
            if (node.children[letter] == null) {
                node.children[letter] = new Node();
            }
            node = node.children[letter];
        }
        node.endsWord = true;
    }

    // Every word that fits the pattern ('.' = any letter), in alphabetical order
    List<String> match(String pattern) {
        List<String> result = new ArrayList<>();
        matchFrom(root, pattern, 0, new StringBuilder(), result);
        return result;
    }

    // Recursive helper: we've matched pattern[0..index-1] and the letters so far are in `soFar`
    private void matchFrom(Node node, String pattern, int index, StringBuilder soFar, List<String> result) {
        // Base case: used up the whole pattern. It's a match only if a word ENDS here
        // (otherwise "CAT" would match the path to "CATS" too).
        if (index == pattern.length()) {
            if (node.endsWord) {
                result.add(soFar.toString());
            }
            return;
        }

        char wanted = pattern.charAt(index);
        for (int letter = 0; letter < 26; letter++) {
            Node child = node.children[letter];
            if (child == null) continue;                          // no word goes this way
            char c = (char) ('A' + letter);
            if (wanted != '.' && wanted != c) continue;           // pattern needs a different letter here

            soFar.append(c);                                      // CHOOSE this letter
            matchFrom(child, pattern, index + 1, soFar, result);  // EXPLORE the rest of the pattern
            soFar.deleteCharAt(soFar.length() - 1);               // UNCHOOSE (same backtracking idea as solve)
        }
    }
}
