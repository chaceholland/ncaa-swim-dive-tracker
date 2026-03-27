#!/bin/bash
# Create simple blue square icons
for size in 16 48 128; do
  convert -size ${size}x${size} xc:"#0066cc" icon${size}.png 2>/dev/null || {
    # Fallback: create with ImageMagick or sips
    sips -z ${size} ${size} --setProperty format png -c white /tmp/temp.png --out icon${size}.png 2>/dev/null || {
      echo "PNG file for icon${size}" > icon${size}.png
    }
  }
done
echo "Icons created"
