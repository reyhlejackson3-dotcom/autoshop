ADVANCED VEHICLE DYNAMICS — WEBSITE
===================================

OPEN IT
  Double-click index.html to preview. (Needs internet for the Google font and map.)

PUT IT ONLINE (easiest)
  Drag this whole folder onto https://app.netlify.com/drop  — it gives you a live link in seconds.
  Or upload the folder to Vercel / Cloudflare Pages / GitHub Pages. No build step.

THINGS TO FILL IN
  1. js/config.js
     - formEndpoint: make a free form at formspree.io (or web3forms.com), paste its URL here.
       Messages then go straight to the shop's inbox.
     - email: used only if no endpoint is set.
     - If both are empty, the form opens a pre-filled TEXT to 720-383-2490 instead.
  2. assets/work/  — add job photos named work-1.jpg ... work-6.jpg (any size, landscape works best).
     Empty slots show a clean placeholder tile until you do.
  3. Reviews — the section invites a Google review. When real reviews exist, replace it with them.

HOW THE CAR WORKS
  The scroll animation is a frame sequence (assets/frames-lg for desktop, frames-sm for phones),
  drawn on a canvas and scrubbed by scroll position. To swap the video later:
     ffmpeg -i new.mp4 -vf scale=1280:720 -c:v libwebp -quality 74 assets/frames-lg/f%03d.webp
     ffmpeg -i new.mp4 -vf scale=800:450  -c:v libwebp -quality 70 assets/frames-sm/f%03d.webp
  then set FRAME_COUNT at the top of the car section in js/main.js to the new number of frames.
  The original clip is in source/.

STORY CARD TIMING
  In index.html each card in the car section has data-in / data-out values (0 to 1 = scroll progress
  through the car story). Nudge those numbers to make a card appear earlier or later.

NOTES
  - Colors live at the top of css/style.css (:root). Every corner radius is a --r-* variable.
  - The expired "$35 off" new-customer coupon from the flyer is intentionally NOT on the site.
  - ASE: the site says "ASE Certified" in text only. Use the official ASE seal only if the shop
    is licensed to display it.
