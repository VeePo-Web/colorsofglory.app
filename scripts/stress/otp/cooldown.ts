export class CooldownTracker {
  private readonly lastSentAt = new Map<string, number>();

  constructor(private readonly cooldownMs: number) {}

  canSend(phone: string, now = Date.now()): boolean {
    const last = this.lastSentAt.get(phone);
    return last === undefined || now - last >= this.cooldownMs;
  }

  markSent(phone: string, now = Date.now()): void {
    this.lastSentAt.set(phone, now);
  }

  secondsUntilReady(phone: string, now = Date.now()): number {
    const last = this.lastSentAt.get(phone);
    if (last === undefined) return 0;
    return Math.max(0, Math.ceil((this.cooldownMs - (now - last)) / 1000));
  }

  static requiredRotationSize(rps: number, cooldownSeconds: number): number {
    return Math.ceil(rps * cooldownSeconds);
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
