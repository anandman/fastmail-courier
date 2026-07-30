import { describe, expect, it } from 'vitest';

import {
    calAddress,
    decodeICalendarText,
    splitICalendarList,
    unfoldICalendar,
} from '../src/caldav/client.js';

/**
 * Regression tests for RFC 5545 line folding and TEXT escaping.
 *
 * Both were observed live: a real calendar returned `attendees: ["", ""]` and a
 * location reading `Community Hall\nof Example County` with the escape shown
 * literally. The parser had never unfolded lines nor decoded escapes, though it
 * had always *written* escapes.
 */

describe('line unfolding', () => {
    it('removes the CRLF and the fold marker, joining with nothing', () => {
        // The whitespace after the CRLF is the fold marker itself, not content.
        // Re-joining with a space would insert one that was never in the value.
        expect(unfoldICalendar('SUMMARY:Hello\r\n World')).toBe('SUMMARY:HelloWorld');
    });

    it('treats a tab as a fold marker too', () => {
        expect(unfoldICalendar('SUMMARY:Hello\r\n\tWorld')).toBe('SUMMARY:HelloWorld');
    });

    it('preserves a space that is genuinely part of the value', () => {
        // Folding "Hello World" after "Hello" writes CRLF + marker + the real
        // space, so exactly one space must survive.
        expect(unfoldICalendar('SUMMARY:Hello\r\n  World')).toBe('SUMMARY:Hello World');
    });

    it('handles bare LF and bare CR line endings', () => {
        expect(unfoldICalendar('SUMMARY:a\n b')).toBe('SUMMARY:ab');
        expect(unfoldICalendar('SUMMARY:a\r b')).toBe('SUMMARY:ab');
    });

    it('joins a value folded across several lines', () => {
        expect(unfoldICalendar('DESCRIPTION:one\r\n two\r\n three')).toBe(
            'DESCRIPTION:onetwothree'
        );
    });

    it('leaves real line breaks between properties alone', () => {
        // Only a newline followed by whitespace is a fold. Removing others would
        // merge separate properties into one unmatchable line.
        expect(unfoldICalendar('UID:1\r\nSUMMARY:x')).toBe('UID:1\r\nSUMMARY:x');
    });

    it('recovers an attendee folded immediately after the scheme', () => {
        // The exact shape that produced `attendees: ["", ""]`: the regex matched
        // and captured nothing, because the address was on the next line.
        const folded = 'ATTENDEE;CN=Someone;ROLE=REQ-PARTICIPANT:mailto:\r\n someone@example.com';
        const match = unfoldICalendar(folded).match(/^ATTENDEE(?:;[^\r\n:]*)?:(.*)$/im);

        expect(calAddress(match![1])).toBe('someone@example.com');
    });

    it('recovers an attendee whose parameters push the address onto a fold', () => {
        // The other failure mode: the line did not match at all, so the attendee
        // vanished silently rather than arriving empty.
        const folded =
            'ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE\r\n :mailto:someone@example.com';
        const match = unfoldICalendar(folded).match(/^ATTENDEE(?:;[^\r\n:]*)?:(.*)$/im);

        expect(match).not.toBeNull();
        expect(calAddress(match![1])).toBe('someone@example.com');
    });
});

describe('TEXT decoding', () => {
    it('turns escaped newlines into real ones', () => {
        expect(decodeICalendarText('Children\\nof Example')).toBe('Children\nof Example');
    });

    it('accepts the uppercase escape', () => {
        expect(decodeICalendarText('a\\Nb')).toBe('a\nb');
    });

    it('unescapes commas and semicolons', () => {
        expect(decodeICalendarText('Example Ln\\, Riverside\\; CA')).toBe(
            'Example Ln, Riverside; CA'
        );
    });

    it('unescapes a backslash without re-reading what follows', () => {
        // `\\n` is a literal backslash then the letter n, NOT a newline. Naive
        // sequential replaces get this wrong.
        expect(decodeICalendarText('C:\\\\path')).toBe('C:\\path');
        expect(decodeICalendarText('a\\\\nb')).toBe('a\\nb');
    });

    it('leaves a trailing lone backslash alone rather than dropping it', () => {
        expect(decodeICalendarText('trailing\\')).toBe('trailing\\');
    });

    it('passes through text with nothing to decode', () => {
        expect(decodeICalendarText('Plain summary')).toBe('Plain summary');
    });
});

describe('list splitting', () => {
    it('splits on unescaped commas', () => {
        expect(splitICalendarList('work,home,urgent')).toEqual(['work', 'home', 'urgent']);
    });

    it('keeps an escaped comma inside a single item', () => {
        // Splitting must happen before decoding, or "Riverside\, CA" becomes two
        // categories instead of one.
        expect(splitICalendarList('Riverside\\, CA,travel')).toEqual([
            'Riverside\\, CA',
            'travel',
        ]);
    });

    it('returns a single item when there is no comma', () => {
        expect(splitICalendarList('solo')).toEqual(['solo']);
    });
});

describe('CAL-ADDRESS extraction', () => {
    it('strips the mailto scheme', () => {
        expect(calAddress('mailto:a@example.com')).toBe('a@example.com');
    });

    it('is case-insensitive about the scheme', () => {
        expect(calAddress('MAILTO:a@example.com')).toBe('a@example.com');
    });

    it('keeps an address that carries no scheme', () => {
        // RFC 5545 does not mandate mailto:, and demanding it silently dropped
        // anything else.
        expect(calAddress('a@example.com')).toBe('a@example.com');
    });

    it('trims surrounding whitespace', () => {
        expect(calAddress('  mailto:a@example.com  ')).toBe('a@example.com');
    });

    it('yields an empty string for an empty value, so callers can drop it', () => {
        expect(calAddress('mailto:')).toBe('');
        expect(calAddress('   ')).toBe('');
    });
});
