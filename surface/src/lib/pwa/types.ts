export type PwaDisplayMode = 'browser' | 'standalone' | 'unknown';
export type PwaNetworkState = 'online' | 'offline' | 'unknown';
export type PwaServiceState =
	| 'live'
	| 'unavailable'
	| 'authorization-required'
	| 'missing-resource'
	| 'unknown';
export type PwaUpdateState = 'current' | 'available' | 'pending' | 'failed' | 'unknown';

export type DegradedKind =
	| 'offline'
	| 'service-unavailable'
	| 'authorization-required'
	| 'missing-resource'
	| 'generic';

export interface BeforeInstallPromptEvent extends Event {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export interface PwaNoticeAction {
	label: string;
	onclick: () => void;
	variant?: 'primary' | 'secondary';
}

export interface PwaNoticeModel {
	kind: 'install' | 'unsupported' | 'degraded' | 'update';
	tone: 'info' | 'warn' | 'success';
	title: string;
	message: string;
	actions: PwaNoticeAction[];
	ondismiss?: () => void;
}
