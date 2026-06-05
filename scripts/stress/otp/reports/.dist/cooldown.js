export class CooldownTracker {
    cooldownMs;
    lastSentAt = new Map();
    constructor(cooldownMs) {
        this.cooldownMs = cooldownMs;
    }
    canSend(phone, now = Date.now()) {
        const last = this.lastSentAt.get(phone);
        return last === undefined || now - last >= this.cooldownMs;
    }
    markSent(phone, now = Date.now()) {
        this.lastSentAt.set(phone, now);
    }
    secondsUntilReady(phone, now = Date.now()) {
        const last = this.lastSentAt.get(phone);
        if (last === undefined)
            return 0;
        return Math.max(0, Math.ceil((this.cooldownMs - (now - last)) / 1000));
    }
    static requiredRotationSize(rps, cooldownSeconds) {
        return Math.ceil(rps * cooldownSeconds);
    }
}
export function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
