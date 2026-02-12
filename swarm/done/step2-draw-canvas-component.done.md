# Task: Create DrawCanvas Component

## Requirements
Create `src/components/DrawCanvas.tsx` with:
- Full-area HTML Canvas element
- Pointer event handlers for freehand drawing
- Coordinate normalization (0-1 range) so drawings render on any screen size
- Reactive rendering from `getStrokes` query
- Color picker toolbar at bottom with 8-10 preset colors
- Brush width selector (thin, medium, thick)
- Clear canvas button (with confirmation)
- Eraser mode toggle
- Optimistic local rendering while drawing
- `requestAnimationFrame` for smooth drawing
- Mobile support via Pointer Events API
- Prevent scroll while drawing on canvas

## Dependencies
- step1-schema-and-backend (needs drawStrokes table and drawing.ts mutations/queries)
