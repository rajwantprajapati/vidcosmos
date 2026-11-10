# VideoCard

A video in the library or a gallery: thumbnail, title, type and status. The thumbnail is drawn in the video's own theme (midnight, paper, ocean or sunset) on the `stage`, so the library shows real variety.

- `aspect` follows the video (9:16, 16:9, 1:1); keep cards in one row the same aspect.
- `status` sets the badge: `generating` also shows a progress line on the thumbnail.
- Titles are one line and truncate; the full title is in the editor.
- Pass `href` to make the whole card a link to the editor.
