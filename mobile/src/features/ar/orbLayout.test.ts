import { MAX_ORB_EXTENT, ORB_HIT, PLACE_HIT, orbLabel, orbLayout, plotPosition, truncateName } from './orbLayout';

type Box = { l: number; t: number; r: number; b: number };
const box = (cx: number, cy: number, size: number): Box => ({
  l: cx - size / 2,
  t: cy - size / 2,
  r: cx + size / 2,
  b: cy + size / 2,
});
const overlap = (a: Box, b: Box) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;

describe('orbLayout', () => {
  for (const aura of [6, 20]) {
    for (let count = 1; count <= 8; count++) {
      it(`keeps orb and place hit boxes apart for ${count} orbs, aura ${aura}px`, () => {
        const layout = orbLayout(aura, count);
        expect(layout.orbs).toHaveLength(count);
        expect(layout.ring).toBeGreaterThanOrEqual(44);
        const place = box(0, 0, PLACE_HIT);
        const boxes = layout.orbs.map((o) => box(o.dx, o.dy, layout.hit));
        boxes.forEach((b) => expect(overlap(b, place)).toBe(false));
        for (let i = 0; i < boxes.length; i++)
          for (let j = i + 1; j < boxes.length; j++) expect(overlap(boxes[i]!, boxes[j]!)).toBe(false);
      });
    }
  }

  it('uses the shared orb hit size', () => {
    expect(orbLayout(10, 3).hit).toBe(ORB_HIT);
  });
});

describe('orbLabel', () => {
  it('uses the first 40 characters of the text', () => {
    expect(orbLabel({ text: 'x'.repeat(60), media: null })).toBe(`Memory: ${'x'.repeat(40)}`);
  });
  it('falls back to the media kind, then to plain Memory', () => {
    expect(orbLabel({ text: '  ', media: 'photo' })).toBe('Memory: photo');
    expect(orbLabel({ text: '', media: 'voice note' })).toBe('Memory: voice note');
    expect(orbLabel({ text: '', media: null })).toBe('Memory');
  });
});

describe('truncateName', () => {
  it('truncates long names with an ellipsis', () => {
    expect(truncateName('UB City')).toBe('UB City');
    expect(truncateName('Sree Kanteerava Stadium')).toBe('Sree Kanteerava…');
  });
});

describe('radar bounds', () => {
  const size = 328;
  for (const aura of [6, 20]) {
    for (const count of [1, 8]) {
      for (const bearing of [0, 45, 90, 180, 270]) {
        it(`keeps a 1000 m place with ${count} orbs inside the radar (aura ${aura}px, bearing ${bearing})`, () => {
          const pos = plotPosition(size, 1000, bearing, 0);
          const inside = (b: Box) => b.l >= 0 && b.t >= 0 && b.r <= size && b.b <= size;
          expect(inside(box(pos.x, pos.y, PLACE_HIT))).toBe(true);
          const layout = orbLayout(aura, count);
          layout.orbs.forEach((o) => expect(inside(box(pos.x + o.dx, pos.y + o.dy, layout.hit))).toBe(true));
        });
      }
    }
  }

  it('reserves the largest possible orb extent as padding', () => {
    expect(MAX_ORB_EXTENT).toBeGreaterThanOrEqual(orbLayout(20, 8).ring + ORB_HIT / 2);
  });
});
