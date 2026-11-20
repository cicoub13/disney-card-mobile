import { describe, expect, it } from 'vitest';
import { parseCardNumber } from './parse';

describe('parseCardNumber', () => {
  it.each([
    ['#039', 39],
    ['# 001\n', 1],
    ['#108', 108],
    ['#0314', 31],
    ['#O39', 39],
    ['039', 39],
    ['1O8', 108],
    ['abc 007 xyz', 7],
    ['4039', 39],
    ['24038', 38],
  ])('%j -> %d', (input, expected) => {
    expect(parseCardNumber(input)).toBe(expected);
  });

  it.each(['', '#', 'abc', '5', '42', '000', '#000', '109', '#999', '7152'])('%j -> null', (input) => {
    expect(parseCardNumber(input)).toBeNull();
  });
});
