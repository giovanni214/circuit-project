export function arraysEqual(a, b) {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) return false;
	}
	return true;
}

export function createDefaultContext() {
		return {
			// This cache is the key to preventing infinite recursion in toString().
			nodeStringCache: new Map()
		};
	}