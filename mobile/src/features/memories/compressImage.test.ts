import { compressImage } from './compressImage';

describe('compressImage', () => {
  it('compresses until under the upload limit', async () => {
    const sizes = [4_000_000, 1_500_000, 900_000];
    const manipulate = jest.fn(async (_uri: string, _o: { width: number; quality: number }) => ({ uri: 'out.jpg' }));
    const sizeOf = jest.fn(async () => sizes.shift() ?? 0);
    await expect(compressImage('in.jpg', { manipulate, sizeOf })).resolves.toBe('out.jpg');
    expect(manipulate).toHaveBeenCalledTimes(3);
    expect(manipulate.mock.calls[0]![1]).toEqual({ width: 1600, quality: 0.7 });
    expect(manipulate.mock.calls[1]![1].quality).toBeCloseTo(0.55);
  });

  it('throws when never under the limit', async () => {
    const manipulate = jest.fn(async () => ({ uri: 'out.jpg' }));
    const sizeOf = async () => 9_000_000;
    await expect(compressImage('in.jpg', { manipulate, sizeOf })).rejects.toThrow('Photo is too large to upload.');
    expect(manipulate.mock.calls.length).toBeLessThan(30);
  });
});
