const INSTALL_DISMISSED_KEY = 'lattice.pwa.installDismissed';

export function readInstallDismissed(storage: Storage | undefined = safeLocalStorage()): boolean {
	if (!storage) return false;
	try {
		return storage.getItem(INSTALL_DISMISSED_KEY) === 'true';
	} catch {
		return false;
	}
}

export function writeInstallDismissed(
	dismissed: boolean,
	storage: Storage | undefined = safeLocalStorage()
): void {
	if (!storage) return;
	try {
		if (dismissed) storage.setItem(INSTALL_DISMISSED_KEY, 'true');
		else storage.removeItem(INSTALL_DISMISSED_KEY);
	} catch {
		// Private browsing/quota failures must never block normal browser use.
	}
}

function safeLocalStorage(): Storage | undefined {
	try {
		return typeof localStorage === 'undefined' ? undefined : localStorage;
	} catch {
		return undefined;
	}
}
