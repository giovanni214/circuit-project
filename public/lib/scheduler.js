export class Scheduler {
	constructor() {
		this.events = [];
	}
	/**
	 * scheduleEvent: queue a callback to run at targetTick
	 */

	scheduleEvent(targetTick, callback, description = "event") {
		this.events.push({ targetTick, callback, description });
	}
	/**
	 * consumeEventsForTick: remove and return all events for a given tick
	 */

	// This can be made more efficient by iterating over the events array only once.
	consumeEventsForTick(tick) {
		const ready = [];
		const remaining = [];
		for (const event of this.events) {
			if (event.targetTick === tick) {
				ready.push(event);
			} else {
				remaining.push(event);
			}
		}
		this.events = remaining;
		return ready;
	}
	/**
	 * hasEventsForTick: does at least one event remain for this tick?
	 */

	hasEventsForTick(tick) {
		return this.events.some((e) => e.targetTick === tick);
	}
}