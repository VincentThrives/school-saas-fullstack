/**
 * Class-name sort helper.
 *
 * <p>Indian schools mix pre-primary classes (Pre-Nursery, Nursery, LKG,
 * UKG) with numbered grades (1st through 12th). A plain {@code localeCompare}
 * (even with {@code numeric: true}) puts every alphabetic class AFTER the
 * numbered ones, so a dropdown ends up reading "1st, 2nd, …, 12th, LKG,
 * UKG" — exactly backwards from what schools expect.</p>
 *
 * <p>This helper produces a tuple key that sorts cleanly:</p>
 * <ol>
 *   <li>Pre-primary block first, in canonical order
 *       (Pre-Nursery → Playgroup → Nursery → LKG → UKG)</li>
 *   <li>Numbered grades next (1st, 2nd, …, 12th — numeric, not string)</li>
 *   <li>Anything else (KG-1, custom labels) alphabetised at the end</li>
 * </ol>
 *
 * <p>Pass into any {@code Array.sort} where the items have a class-name
 * field; see {@link sortClassesByName} for the common shape.</p>
 */

/** Canonical pre-primary order. UPPERCASE — names are upper-cased before
 *  the lookup so "lkg" / "Lkg" / "LKG" all match. Extend here if a school
 *  uses something exotic (e.g. "PG" for Playgroup). */
const PRE_PRIMARY_ORDER: ReadonlyArray<string> = [
  'PRE-NURSERY', 'PRE NURSERY', 'PRENURSERY',
  'PLAYGROUP', 'PLAY GROUP', 'PLAY-GROUP',
  'NURSERY',
  'PRE-KG', 'PRE KG', 'PREKG',
  'LKG', 'L.K.G', 'L.K.G.',
  'UKG', 'U.K.G', 'U.K.G.',
];

/**
 * Sort key for a class name. Returns a tuple compared lexicographically
 * by {@code Array.sort}:
 *   {@code [bucket, ordinalInBucket, fallbackName]}
 * where:
 *   bucket 0 = pre-primary, 1 = numbered grade, 2 = other.
 */
export function classSortKey(name: string | null | undefined): [number, number, string] {
  const n = (name ?? '').trim().toUpperCase();
  if (!n) return [3, 0, ''];                        // empty/missing — sinks to the bottom

  const preIdx = PRE_PRIMARY_ORDER.indexOf(n);
  if (preIdx >= 0) return [0, preIdx, n];           // pre-primary in canonical order

  // Numbered grades: "1", "10", "1st", "10th", "Class 5" all extract their number.
  const numMatch = n.match(/^(?:CLASS\s*)?(\d+)(?:ST|ND|RD|TH)?$/);
  if (numMatch) return [1, parseInt(numMatch[1], 10), n];

  return [2, 0, n];                                  // anything else, alphabetical at the end
}

/** Compare two class names by the canonical school order. Returns a
 *  number compatible with {@code Array.sort} — negative if a < b, etc. */
export function compareClassNames(a: string | null | undefined,
                                  b: string | null | undefined): number {
  const ka = classSortKey(a);
  const kb = classSortKey(b);
  if (ka[0] !== kb[0]) return ka[0] - kb[0];
  if (ka[1] !== kb[1]) return ka[1] - kb[1];
  return ka[2].localeCompare(kb[2]);
}

/** Sort an array of objects in place by their class-name field. Default
 *  field is {@code name} (matches {@link SchoolClass}); pass a different
 *  selector for objects like {@code {className: string}}. Returns the
 *  same array for chaining. */
export function sortClassesByName<T>(items: T[],
                                     selector: (item: T) => string | null | undefined = (it: any) => it?.name): T[] {
  items.sort((a, b) => compareClassNames(selector(a), selector(b)));
  return items;
}
