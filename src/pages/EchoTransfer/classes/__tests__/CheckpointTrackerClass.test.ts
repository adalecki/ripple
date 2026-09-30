import { CheckpointTracker } from '../CheckpointTrackerClass';

describe('CheckpointTracker', () => {
  test('updateCheckpoint appends messages so separate callers can each report into one checkpoint', () => {
    const tracker = new CheckpointTracker();
    tracker.updateCheckpoint('Step', 'Warning', ['first']);
    tracker.updateCheckpoint('Step', 'Warning', ['second']);
    expect(tracker.getCheckpoint('Step')).toEqual({ status: 'Warning', message: ['first', 'second'] });
  });

  test('updateCheckpoint takes the latest status while keeping earlier messages', () => {
    const tracker = new CheckpointTracker();
    tracker.updateCheckpoint('Step', 'Pending', ['note']);
    tracker.updateCheckpoint('Step', 'Passed');
    expect(tracker.getCheckpoint('Step')).toEqual({ status: 'Passed', message: ['note'] });
  });

  test('addCheckpoint resets an existing checkpoint to Pending with no messages so reruns start clean', () => {
    const tracker = new CheckpointTracker();
    tracker.updateCheckpoint('Step', 'Failed', ['boom']);
    tracker.addCheckpoint('Step');
    expect(tracker.getCheckpoint('Step')).toEqual({ status: 'Pending', message: [] });
  });

  test('clone copies message arrays so appending to the clone leaves the original untouched', () => {
    const tracker = new CheckpointTracker();
    tracker.updateCheckpoint('Step', 'Warning', ['first']);
    const clone = tracker.clone();
    clone.updateCheckpoint('Step', 'Warning', ['second']);
    expect(tracker.getCheckpoint('Step')!.message).toEqual(['first']);
  });
});