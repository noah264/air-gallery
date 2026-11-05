# AirGallery UI concept v3

Date: 2026-11-05

Generation mode: built-in image_gen; edit using v2 as reference. First attempt failed with a service connection error; retry succeeded.

Image: [airgallery-spatial-ui-v3.png](./airgallery-spatial-ui-v3.png)

## Design intent

- Photo groups radiate from a dense middle into a sparse outer region, forming a filled horizontal elliptical cloud.
- No hollow ring or ellipse outline; the density gradient defines the shape.
- Each group displays the first image as a cover with offset photographic sheets behind it.
- Preserve organic variation, spatial depth and an image-only homepage.
- This is a static visual concept, not an interactive application.

## Final generation prompt

Use case: ui-mockup. Edit the supplied AirGallery homepage concept. Preserve the photo-only dark spatial canvas and the grouped stacks of photographs, but CHANGE THE SPATIAL DISTRIBUTION to the user's precise new layout.

PRIMARY REQUIREMENT: ALL the photo groups together form ONE large HORIZONTAL ELLIPTICAL CLOUD, radiating outward from a DENSE CENTER into a SPARSE PERIPHERY. The ellipse must be clearly legible from the overall arrangement of photographs. This is a FILLED ELLIPSE with a busy middle, NOT a hollow ring, NOT an orbital track, NOT a donut, NOT a border made of photographs. Do not draw an ellipse outline. The ellipse is approximately 2:1 width to height, centered on the canvas, with dark breathing room around it. Top and bottom edges have more empty dark margin than the sides.

Density gradient is the most important feature: ~35 distinct photo GROUPS. Put around 20 smaller-to-medium stacks closely packed in the central one third, overlapping slightly but their covers still individually legible. Put around 10 stacks at medium radii with noticeable spaces between them. Put only 5 widely separated stacks at outer elliptical radii with generous black gaps. Distribution thins smoothly from center outward, like a controlled outward burst of photographic memories. Use irregular radial directions and gentle variations, not perfect concentric rows. Do NOT spread groups evenly across the whole screen. Do NOT put one enormous central or foreground photograph obscuring the dense center. No single hero image. The dense middle must have MANY recognizable covers and layers, not one giant pile.

Every GROUP has exactly the visual language of the reference: one first-photo cover in front, with 3 to 5 thin photographic sheets slightly offset and rotated behind it. Realistic pale thin paper edges distinguish layers. These are many separate loose photo stacks, not books or bound albums, no folders. Each stack retains its own coherent shape, cannot merge into one heap. Smaller center groups, moderately bigger and more separated groups toward the outside imply spatial expansion and depth. Keep the biggest stacks below about one eighth of canvas width, so the whole elliptical distribution remains visible. Covers in horizontal and vertical aspect ratios, diverse travel photographs of lakes, mountains, forests, architecture, city lights, dunes, coastlines and waterfalls. Rich natural photographic color. Gentle irregular tilt around +/-15 degrees, subtle perspective; not wildly spun or distorted.

Visual mood: elegant near-black charcoal/navy void, tangible fine photo edges, very soft shadows and faint atmospheric depth. No floor or room. It should read as an implementable, immersive 3D PHOTO BROWSER HOME SCREEN. Flat front-facing widescreen UI screenshot, 16:10. Art-directed organic chaos inside a clearly elliptical footprint, with order in its density gradient.

Keep the homepage entirely image-only. ZERO TEXT, ZERO LOGO, ZERO UI chrome, no toolbar, buttons, labels, counters, cursor, hand, camera tile, orbit lines, circular rings, arrows, sparkles or debug overlays. The only visible objects are the separated stacked photo groups on a dark background. Priority: dense center -> increasingly open spacing -> sparse elliptical edge.
