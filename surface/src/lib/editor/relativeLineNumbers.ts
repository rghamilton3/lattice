import { gutter, gutters, GutterMarker } from '@codemirror/view';
import type { EditorView } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import { RangeSetBuilder } from '@codemirror/state';

class LineNumberMarker extends GutterMarker {
	elementClass: string;

	constructor(
		readonly label: string,
		active: boolean
	) {
		super();
		this.elementClass = active ? 'cm-activeLineGutter' : '';
	}

	toDOM() {
		return document.createTextNode(this.label);
	}

	eq(other: GutterMarker): boolean {
		return (
			other instanceof LineNumberMarker &&
			other.label === this.label &&
			other.elementClass === this.elementClass
		);
	}
}

export function relativeLineNumbers(): Extension {
	return [
		gutters(),
		gutter({
			class: 'cm-lineNumbers',
			markers(view: EditorView) {
				const builder = new RangeSetBuilder<GutterMarker>();
				const curLine = view.state.doc.lineAt(view.state.selection.main.head).number;
				for (const { from, to } of view.visibleRanges) {
					let pos = from;
					while (pos <= to) {
						const line = view.state.doc.lineAt(pos);
						const dist = Math.abs(line.number - curLine);
						builder.add(
							line.from,
							line.from,
							new LineNumberMarker(dist === 0 ? String(line.number) : String(dist), dist === 0)
						);
						pos = line.to + 1;
					}
				}
				return builder.finish();
			},
			lineMarkerChange(update) {
				return update.selectionSet || update.docChanged || update.viewportChanged;
			},
			initialSpacer(view: EditorView) {
				return new LineNumberMarker(String(view.state.doc.lines), false);
			},
			updateSpacer(spacer, update) {
				const lines = String(update.view.state.doc.lines);
				return (spacer as LineNumberMarker).label === lines
					? spacer
					: new LineNumberMarker(lines, false);
			}
		})
	];
}
