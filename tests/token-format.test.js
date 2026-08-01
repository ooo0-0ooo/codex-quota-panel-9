import test from 'node:test';
import assert from 'node:assert/strict';
import { compactTokenCount } from '../src/token-format.js';

test('compactTokenCount keeps enough precision for official billion-scale totals', () => {
  assert.equal(compactTokenCount(1232139599), '1.23B');
  assert.equal(compactTokenCount(141206413), '141.2M');
  assert.equal(compactTokenCount(424584), '424.6K');
});
