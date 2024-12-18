type CheckStatus = 'Pending' | 'Passed' | 'Failed' | 'Warning';

interface CheckResult {
  status: CheckStatus;
  message: string[];
}

export class CheckpointTracker {
  checkpoints: Map<string, CheckResult>;

  constructor() {
    this.checkpoints = new Map();
  }

  addCheckpoint(name: string) {
    this.checkpoints.set(name, { status: 'Pending', message: [] });
  }

  updateCheckpoint(name: string, status: CheckStatus, message: string[] = []) {
    if (!this.checkpoints.has(name)) {
      this.addCheckpoint(name);
    }
    this.checkpoints.set(name, { status, message });
  }

  getCheckpoint(name: string): CheckResult | undefined {
    return this.checkpoints.get(name)
  }

  getCheckpoints(): Map<string, CheckResult> {
    return this.checkpoints;
  }

  hasFailures(): boolean {
    return Array.from(this.checkpoints.values()).some(check => check.status === 'Failed');
  }

  clone(): CheckpointTracker {
    const clonedData = structuredClone(this);
    const clonedTracker = Object.create(CheckpointTracker.prototype);
    Object.assign(clonedTracker, clonedData);
    return clonedTracker
  }
}