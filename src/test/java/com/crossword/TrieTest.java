package com.crossword;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

// Step 13b-3: the letter tree, tested on a tiny word list
class TrieTest {

    private Trie trie;

    @BeforeEach
    void buildTinyTrie() {
        trie = new Trie();
        trie.insert("CAT");
        trie.insert("CATS");
        trie.insert("CUTE");
    }

    @Test
    void wildcardsMatchAnyLetter() {
        assertEquals(List.of("CATS", "CUTE"), trie.match("C.T."));
    }

    @Test
    void exactWord() {
        assertEquals(List.of("CAT"), trie.match("CAT"));
    }

    @Test
    void theStartOfAWordIsNotAWord() {
        assertEquals(List.of(), trie.match("CA"));
    }

    @Test
    void onlyWordsOfTheRightLength() {
        assertEquals(List.of("CAT"), trie.match("..."));
    }
}
