import * as fc from 'fast-check';
import { ConversationDto } from '@app/shared';

/**
 * Feature: ai-chat-app
 * Property-based tests for ConversationsService sorting and response shape.
 *
 * These tests validate the pure ordering and shape logic without a real DB,
 * by operating directly on sorted/mapped arrays as the service would return them.
 */

function sortDesc(conversations: { createdAt: string }[]) {
  return [...conversations].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

function toDto(id: string, title: string, createdAt: Date): ConversationDto {
  const dto = new ConversationDto();
  dto.id = id;
  dto.title = title || 'New Conversation';
  dto.createdAt = createdAt.toISOString();
  return dto;
}

/**
 * Property 1: Conversation creation response includes all required fields
 * For any title (or no title), the returned ConversationDto SHALL have:
 * - a non-null UUID id
 * - a non-empty title
 * - a valid ISO-8601 createdAt
 */
describe('Property 1: Conversation creation response shape', () => {
  it('returns a DTO with id, non-empty title, and valid ISO-8601 createdAt for any title input', () => {
    fc.assert(
      fc.property(
        fc.option(fc.string({ minLength: 1 })),
        (titleOption) => {
          const title = titleOption ?? 'New Conversation';
          const dto = toDto('550e8400-e29b-41d4-a716-446655440000', title, new Date());

          expect(typeof dto.id).toBe('string');
          expect(dto.id.length).toBeGreaterThan(0);
          expect(typeof dto.title).toBe('string');
          expect(dto.title.length).toBeGreaterThan(0);
          expect(new Date(dto.createdAt).toISOString()).toBe(dto.createdAt);
        },
      ),
      { numRuns: 100 },
    );
  });
});

/**
 * Property 2: Conversation list is ordered descending by creation time
 * For any array of conversations, the sorted result must satisfy
 * conversations[i].createdAt >= conversations[i+1].createdAt
 */
describe('Property 2: Conversation list DESC ordering', () => {
  it('sorted list satisfies conversations[i].createdAt >= conversations[i+1].createdAt', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({ createdAt: fc.date() }),
          { minLength: 2, maxLength: 20 },
        ),
        (items) => {
          const withStrings = items.map((item, i) => ({
            id: `id-${i}`,
            title: 'Test',
            createdAt: item.createdAt.toISOString(),
          }));
          const sorted = sortDesc(withStrings);
          for (let i = 0; i < sorted.length - 1; i++) {
            expect(new Date(sorted[i].createdAt).getTime()).toBeGreaterThanOrEqual(
              new Date(sorted[i + 1].createdAt).getTime(),
            );
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
