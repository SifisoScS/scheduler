import * as root from '../src/index';
import * as deadline from '../src/deadline/index';
import * as interval from '../src/interval/index';

describe('package surface', () => {
  // The root barrel must expose every module's exports and nothing else.
  // Update deliberately when adding a module, so nothing leaks out unnoticed.
  test('re-exports exactly the union of its modules', () => {
    expect(Object.keys(root).sort()).toEqual(['Deadline', 'Interval', 'validate']);
  });

  test('root exports are the same bindings as the module exports', () => {
    expect(root.Deadline).toBe(deadline.Deadline);
    expect(root.validate).toBe(deadline.validate);
    expect(root.Interval).toBe(interval.Interval);
  });
});
