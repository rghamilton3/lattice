/* Mock corpus for the Lattice Surface redesign prototype.
   Modeled after the spine API shapes in surface/src/lib/types.ts:
   - captures, local files, working docs, search results, clusters.
*/

window.LATTICE_DATA = (function () {
	const today = new Date('2026-05-21T14:30:00Z');
	const minutesAgo = (m) => new Date(today.getTime() - m * 60000).toISOString();
	const daysAgo = (d) => new Date(today.getTime() - d * 86400000).toISOString();

	const captures = [
		{
			id: 412,
			source: 'signal',
			text: 'idea: surface a "what was I doing" panel after >2 hour gap — restore last pane, scroll, query, cursor. Probably small and quiet, not a modal.',
			captured_at: minutesAgo(8),
			ingested_at: minutesAgo(8)
		},
		{
			id: 411,
			source: 'signal',
			text: 'Hollifield: "where am I as compared with where I should be?" — embedded trends, not raw values. Apply this to QMD search confidence too?',
			captured_at: minutesAgo(47),
			ingested_at: minutesAgo(47)
		},
		{
			id: 410,
			source: 'desktop-hotkey',
			text: 'try greyscale baseline w/ semantic color only — alarm = red, caution = amber, info = blue, ok = green. nothing else gets color.',
			captured_at: minutesAgo(132),
			ingested_at: minutesAgo(132)
		},
		{
			id: 409,
			source: 'signal',
			text: 'voice memo on the train about the relay attachment path — need to bind-mount /var/lib/signal-cli/data/attachments to /signal-cli-attachments:ro for it to actually pick up the .ogg.',
			captured_at: daysAgo(1),
			ingested_at: daysAgo(1)
		},
		{
			id: 408,
			source: 'desktop-hotkey',
			text: 'Cecchinato 2023 finding: "I feel all tools are there I just need to remember to use them." \u2192 capture must be sub-200ms, no fields.',
			captured_at: daysAgo(2),
			ingested_at: daysAgo(2)
		},
		{
			id: 407,
			source: 'signal',
			text: 'shopping: replace USB-C cable on the desk machine (the one that flakes when you bend it). also: K-cups.',
			captured_at: daysAgo(3),
			ingested_at: daysAgo(3)
		},
		{
			id: 406,
			source: 'web',
			text: 'arxiv.org/abs/2603.17258 — emerging HCI work on ADHD task tools, design implications: rhythm, mood, user control, no surveillance. Read this.',
			captured_at: daysAgo(4),
			ingested_at: daysAgo(4)
		}
	];

	const localFiles = [
		{
			id: 73,
			machine_id: 'personal-laptop',
			path: '/home/rich/notes/lattice/qmd-tuning.md',
			mime_type: 'text/markdown',
			modified_at: daysAgo(2),
			size_bytes: 4823
		},
		{
			id: 41,
			machine_id: 'personal-laptop',
			path: '/home/rich/Documents/papers/leroy-2009-attention-residue.pdf',
			mime_type: 'application/pdf',
			modified_at: daysAgo(12),
			size_bytes: 482001
		},
		{
			id: 102,
			machine_id: 'workstation',
			path: '/srv/data/argus/handoff-template.md',
			mime_type: 'text/markdown',
			modified_at: daysAgo(6),
			size_bytes: 2210
		}
	];

	const workingDocs = [
		{
			slug: 'surface-redesign',
			title: 'Surface redesign — ADHD constraints',
			modified_at: minutesAgo(22),
			content: `# Surface redesign — ADHD constraints

The current Surface is a thin two-pane workbench. It works, but it assumes I will type into a search box to begin. That is one of the load-bearing assumptions the research most consistently warns against.

## Three things to change first

1. **Capture before retrieval.** Global \u2318N opens a focused textarea anywhere — no required fields, no destination.
2. **Home is not search.** Default landing is *Now / Inbox / Resurfaced / Working*. Search is one keystroke away.
3. **Calm by default.** Greyscale baseline; color reserved for genuine signal. Inter for body, mono only for code/IDs.

## Why these three and not others

Cecchinato (2023, N=49) found the loudest pain points were not feature gaps — they were **prioritisation, task-switching cost, and time estimation**. Of those, the surface can only directly help with task-switching cost. That means: persistent session, single capture target, no modal interrupts, focus mode, related-notes inline.

## Open questions

- Does the cluster-facet pattern hold up against real QMD output, or do clusters wobble too much day-to-day?
- Is "two-bucket" (Active / Everything Else) too coarse, or just coarse enough?
- Should the Inbox count be hidden under a posture toggle ("Active duty" shows it; "Quiet" doesn't)?`
		},
		{
			slug: 'argus-handoff-shape',
			title: 'ARGUS handoff packet shape',
			modified_at: daysAgo(1),
			content: `# ARGUS handoff packet shape

What goes in the auto-assembled packet:

- Open anomalies (with current state + last decision)
- Pinned items the outgoing operator marked
- Recent decisions with rationale (last 4h)
- Planned events in the next shift window

This is the "where was I" pattern at organizational scale.`
		},
		{
			slug: 'qmd-tuning-log',
			title: 'QMD tuning log',
			modified_at: daysAgo(3),
			content: `# QMD tuning log\n\nRecording every parameter pass against my actual corpus. Cosine threshold currently 0.62.`
		},
		{
			slug: 'reading-queue',
			title: 'Reading queue',
			modified_at: daysAgo(5),
			content: `# Reading queue\n\n- Leroy 2009\n- Marinus et al. 2016\n- COGA gap analysis (ADHD section)`
		}
	];

	const resurfaced = [
		{
			kind: 'capture',
			id: 198,
			reason: 'You wrote this 6 months ago',
			snippet:
				'the inbox should never feel like a backlog failure. \u201Cclear 10 items in 5 minutes\u201D mode beats a guilt counter.'
		},
		{
			kind: 'working',
			slug: 'cluster-naming-experiments',
			reason: 'You opened this often, then stopped',
			snippet:
				'experiments with LLM-labeled HDBSCAN clusters \u2014 first labels were too long; centroid + 2-3 keywords is the sweet spot.'
		},
		{
			kind: 'capture',
			id: 233,
			reason: 'Tagged in a doc you wrote yesterday',
			snippet:
				'ASM Consortium grey-background paper \u2014 \u201Csalience must be allocated, not spent everywhere.\u201D'
		}
	];

	const clusters = [
		{ id: 'c1', label: 'ADHD UX research', count: 18, color: 'oklch(58% 0.10 245)' },
		{ id: 'c2', label: 'QMD tuning + retrieval', count: 11, color: 'oklch(54% 0.10 155)' },
		{ id: 'c3', label: 'HMI / mission ops', count: 9, color: 'oklch(60% 0.10 28)' },
		{ id: 'c4', label: 'Surface chrome decisions', count: 7, color: 'oklch(56% 0.10 295)' },
		{ id: 'c5', label: 'Capture path infra', count: 5, color: 'oklch(62% 0.10 78)' }
	];

	const searchResults = {
		'attention residue': [
			{
				kind: 'local-file',
				id: 41,
				machine_id: 'personal-laptop',
				path: 'papers/leroy-2009-attention-residue.pdf',
				score: 0.91,
				snippet:
					'\u2026defined as the cognitive remnant that stays with Task A after the user has moved to Task B. Effect is largest when Task A was unfinished or time-pressured\u2026',
				cluster: 'c1'
			},
			{
				kind: 'capture',
				id: 411,
				score: 0.83,
				snippet:
					'Hollifield: \u201Cwhere am I as compared with where I should be?\u201D \u2014 embedded trends, not raw values. Apply this to QMD search confidence too?',
				cluster: 'c3'
			},
			{
				kind: 'working',
				slug: 'surface-redesign',
				score: 0.78,
				snippet:
					'\u2026that means: persistent session, single capture target, no modal interrupts, focus mode, related-notes inline.',
				cluster: 'c4'
			},
			{
				kind: 'capture',
				id: 408,
				score: 0.71,
				snippet:
					'Cecchinato 2023 finding: \u201CI feel all tools are there I just need to remember to use them.\u201D \u2192 capture must be sub-200ms, no fields.',
				cluster: 'c1'
			},
			{
				kind: 'local-file',
				id: 73,
				machine_id: 'personal-laptop',
				path: 'notes/lattice/qmd-tuning.md',
				score: 0.62,
				snippet:
					'\u2026residue means an unfinished search hurts the next one. Bias the result list toward closing the loop \u2014 if a result is opened, predict the follow-up\u2026',
				cluster: 'c2'
			}
		]
	};

	const related = {
		'surface-redesign': [
			{
				kind: 'capture',
				id: 408,
				snippet: 'Cecchinato 2023 \u2014 capture must be sub-200ms, no fields.'
			},
			{
				kind: 'capture',
				id: 410,
				snippet: 'greyscale baseline w/ semantic color only \u2014 alarm/caution/info/ok.'
			},
			{
				kind: 'local-file',
				id: 41,
				snippet: 'Leroy 2009 \u2014 attention residue from unfinished tasks.',
				machine_id: 'personal-laptop'
			},
			{
				kind: 'working',
				slug: 'qmd-tuning-log',
				snippet: 'recording every parameter pass against my actual corpus.'
			}
		]
	};

	// Lateral movement payloads — used by the doc toolbar's Similar/Mentions/Nearby.
	// Each has a header explaining the relationship, plus a ranked list.
	const lateral = {
		similar: {
			'surface-redesign': {
				title: 'Similar to "Surface redesign — ADHD constraints"',
				sub: 'semantic neighbors via QMD cosine · top 6',
				results: [
					{
						kind: 'local-file',
						id: 41,
						machine_id: 'personal-laptop',
						path: 'papers/leroy-2009-attention-residue.pdf',
						score: 0.86,
						snippet:
							'\u2026defined as the cognitive remnant that stays with Task A after the user has moved to Task B.'
					},
					{
						kind: 'capture',
						id: 408,
						score: 0.78,
						snippet:
							'Cecchinato 2023 finding: \u201CI feel all tools are there I just need to remember to use them.\u201D'
					},
					{
						kind: 'capture',
						id: 410,
						score: 0.74,
						snippet:
							'try greyscale baseline w/ semantic color only \u2014 alarm = red, caution = amber, info = blue, ok = green.'
					},
					{
						kind: 'working',
						slug: 'qmd-tuning-log',
						score: 0.69,
						snippet: 'recording every parameter pass against my actual corpus.'
					},
					{
						kind: 'capture',
						id: 411,
						score: 0.61,
						snippet:
							'Hollifield: \u201Cwhere am I as compared with where I should be?\u201D \u2014 embedded trends, not raw values.'
					},
					{
						kind: 'capture',
						id: 406,
						score: 0.52,
						snippet: 'arxiv.org/abs/2603.17258 \u2014 emerging HCI work on ADHD task tools.'
					}
				]
			}
		},
		mentions: {
			'attention residue': {
				title: 'Mentions of "attention residue"',
				sub: 'literal text matches across captures, files, working docs',
				results: [
					{
						kind: 'local-file',
						id: 41,
						machine_id: 'personal-laptop',
						path: 'papers/leroy-2009-attention-residue.pdf',
						score: 1.0,
						snippet:
							'\u2026defined as **attention residue**, the cognitive remnant that stays with Task A after the user has moved to Task B.'
					},
					{
						kind: 'working',
						slug: 'surface-redesign',
						score: 1.0,
						snippet:
							'\u2026Leroy 2009 \u2014 **attention residue** from unfinished tasks. Bias the result list toward closing the loop.'
					},
					{
						kind: 'local-file',
						id: 73,
						machine_id: 'personal-laptop',
						path: 'notes/lattice/qmd-tuning.md',
						score: 1.0,
						snippet:
							'\u2026**residue** means an unfinished search hurts the next one. Bias the result list toward closing the loop\u2026'
					}
				]
			}
		},
		nearby: {
			'surface-redesign': {
				title: 'Around this in time',
				sub: 'captures and files within \u00b172h of edit timestamp',
				results: [
					{
						kind: 'capture',
						id: 412,
						score: 0,
						snippet: 'idea: surface a "what was I doing" panel after >2 hour gap.'
					},
					{
						kind: 'capture',
						id: 411,
						score: 0,
						snippet: 'Hollifield: "where am I as compared with where I should be?"'
					},
					{
						kind: 'capture',
						id: 410,
						score: 0,
						snippet: 'try greyscale baseline w/ semantic color only \u2014 alarm/caution/info/ok.'
					},
					{
						kind: 'local-file',
						id: 73,
						machine_id: 'personal-laptop',
						path: 'notes/lattice/qmd-tuning.md',
						score: 0,
						snippet:
							'cosine threshold currently 0.62. raising to 0.68 dropped recall too much\u2026'
					},
					{
						kind: 'capture',
						id: 409,
						score: 0,
						snippet: 'voice memo on the train about the relay attachment path.'
					}
				]
			}
		}
	};

	return {
		captures,
		localFiles,
		workingDocs,
		resurfaced,
		clusters,
		searchResults,
		related,
		lateral,
		today
	};
})();
