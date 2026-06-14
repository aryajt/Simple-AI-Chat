import * as fc from 'fast-check';
import { generateMockResponse, KEYWORD_RESPONSES } from './mock-response.generator';

/**
 * Feature: ai-chat-app
 * Property-based tests for MockResponseGenerator
 */

describe('MockResponseGenerator', () => {
  /**
   * Property 6: Mock generator always produces a non-empty output
   * For any input string — including empty, whitespace-only, special chars —
   * generateMockResponse(input) SHALL return a string of length >= 1.
   */
  it('Property 6: always produces a non-empty output for any input', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const result = generateMockResponse(input);
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThanOrEqual(1);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property 7: Mock generator is deterministic
   * For any input string s, calling generateMockResponse(s) twice
   * SHALL produce identical output strings.
   */
  it('Property 7: is deterministic — same input always yields same output', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        expect(generateMockResponse(input)).toBe(generateMockResponse(input));
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property 8: Keyword matching always returns the associated fixed response
   * For any keyword k in the predefined map, any input containing k
   * SHALL return the associated fixed response string.
   */
  it('Property 8: keyword matching returns the associated fixed response', () => {
    const keywords = Object.keys(KEYWORD_RESPONSES);
    fc.assert(
      fc.property(
        fc.constantFrom(...keywords),
        fc.string({ maxLength: 20 }),
        fc.string({ maxLength: 20 }),
        (keyword, prefix, suffix) => {
          // Build an input that contains the keyword (case-insensitive test: use as-is)
          // Make sure prefix/suffix don't contain higher-priority keywords
          const safePrefix = keywords.reduce((s, k) => s.replace(new RegExp(k, 'gi'), ''), prefix);
          const safeSuffix = keywords.reduce((s, k) => s.replace(new RegExp(k, 'gi'), ''), suffix);
          const input = `${safePrefix}${keyword}${safeSuffix}`;
          const result = generateMockResponse(input);
          expect(result).toBe(KEYWORD_RESPONSES[keyword]);
        },
      ),
      { numRuns: 100 },
    );
  });

  // Edge-case unit tests for empty / whitespace guard
  it('returns default greeting for empty string', () => {
    expect(generateMockResponse('')).toBe('Hello! How can I help you?');
  });

  it('returns default greeting for whitespace-only string', () => {
    expect(generateMockResponse('   ')).toBe('Hello! How can I help you?');
  });

  it('returns echo for unmatched input', () => {
    expect(generateMockResponse('something random xyz')).toBe(
      'You said: "something random xyz"',
    );
  });
});
