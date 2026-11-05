# AirGallery UI concept v5

Status: historical layout reference. Product requirements v1.1 replace this image's opaque black backdrop with translucent frosted glass. See [v6](./airgallery-spatial-ui-v6.png) for the new glass concept; the original prompt below is preserved as generation history.

Date: 2026-11-05

Generation mode: built-in image_gen; edit using v4 as reference.

Image: [airgallery-spatial-ui-v5.png](./airgallery-spatial-ui-v5.png)

## Design intent

- Add the selected album's folder name just above the central stack, centered in translucent soft-white text.
- Sample folder name in the concept: 阿尔卑斯之旅. The implementation will display the actual folder name.
- Keep other albums unlabeled and preserve the enlarged center, clear margins, photographic stacks and elliptical layout.
- This is a static concept. Text clearance, opacity and long folder names need responsive verification in the implementation.

## Final generation prompt

Use case: ui-mockup. Make one precise minimal edit to the attached AirGallery UI concept v4.

KEEP the composition, photography, near-black background, all photo groups, enlarged selected central alpine lake photo stack, all spacing and the overall elliptical arrangement unchanged.

ONLY ADD: a subtle semi-transparent FOLDER NAME just ABOVE THE SELECTED CENTER ALBUM.
- The selected album is the large alpine lake photo stack in the middle of the image.
- Place the folder name horizontally centered above that album's FULL upper edge, including all the offset back sheets.
- Use the EXACT simplified Chinese text: "阿尔卑斯之旅".
- One line only, modern refined sans-serif typography, medium size, approximately 24–28 px in a 1600px-wide screenshot.
- Text color is translucent soft white, roughly 65% opacity. It should be legible but understated.
- Keep a clear small vertical gap between this name and the topmost photo sheet.
- The name floats on the existing dark background; no filled badge, no pill, no panel, no icon, no underline, no glow.
- Fit the label entirely within the existing negative-space gap above the selected album, not over any photograph or surrounding group.
- Only the SELECTED album has a name. All other stacks remain unlabeled.

Do not move or enlarge other elements. Do not add any other text, buttons, folder icons, UI toolbars, selection outlines, camera preview, metadata or counters. Preserve the clear empty margins around the selected album. The result remains a clean 16:10 full-screen spatial photo browser UI screenshot, not a presentation board.
