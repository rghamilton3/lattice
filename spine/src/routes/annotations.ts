import { Elysia, t } from 'elysia';
import type { Database } from 'bun:sqlite';
import {
	AnnotationNotFoundError,
	AnnotationTargetNotFoundError,
	AnnotationValidationError,
	createAnnotation,
	deleteAnnotation,
	listAnnotations,
	updateAnnotation,
} from '../annotations';

export const annotationsRoutes = (db: Database) =>
	new Elysia()
		.get(
			'/api/annotations',
			({ query, set }) => {
				try {
					if (!query.target_kind) throw new AnnotationValidationError('Target kind is required');
					if (!query.target_id) throw new AnnotationValidationError('Target id is required');
					return {
						annotations: listAnnotations(db, query.target_kind, query.target_id),
					};
				} catch (e) {
					if (e instanceof AnnotationValidationError) {
						set.status = 400;
						return { error: e.message };
					}
					throw e;
				}
			},
			{
				query: t.Object({ target_kind: t.Optional(t.String()), target_id: t.Optional(t.String()) }),
			},
		)
		.post(
			'/api/annotations',
			({ body, set }) => {
				try {
					const annotation = createAnnotation(db, body);
					set.status = 201;
					return { annotation };
				} catch (e) {
					if (e instanceof AnnotationValidationError) {
						set.status = 400;
						return { error: e.message };
					}
					if (e instanceof AnnotationTargetNotFoundError) {
						set.status = 404;
						return { error: e.message };
					}
					throw e;
				}
			},
			{
				body: t.Object({
					target_kind: t.String(),
					target_id: t.String(),
					selection_start: t.Optional(t.Nullable(t.Integer())),
					selection_end: t.Optional(t.Nullable(t.Integer())),
					selection_text: t.Optional(t.Nullable(t.String())),
					comment: t.String(),
				}),
			},
		)
		.patch(
			'/api/annotations/:id',
			({ params, body, set }) => {
				try {
					return { annotation: updateAnnotation(db, params.id, body) };
				} catch (e) {
					if (e instanceof AnnotationValidationError) {
						set.status = 400;
						return { error: e.message };
					}
					if (e instanceof AnnotationNotFoundError) {
						set.status = 404;
						return { error: e.message };
					}
					throw e;
				}
			},
			{
				params: t.Object({ id: t.String({ minLength: 1 }) }),
				body: t.Object({ comment: t.String() }),
			},
		)
		.delete(
			'/api/annotations/:id',
			({ params, set }) => {
				try {
					deleteAnnotation(db, params.id);
					set.status = 204;
					return undefined;
				} catch (e) {
					if (e instanceof AnnotationNotFoundError) {
						set.status = 404;
						return { error: e.message };
					}
					throw e;
				}
			},
			{ params: t.Object({ id: t.String({ minLength: 1 }) }) },
		);
