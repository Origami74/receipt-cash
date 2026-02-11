# Image Optimization Guide for Receipt.Cash

## Current Problem
The onboarding images in `public/onboard/` are ~1MB each (PNG format), totaling ~25-30MB. This bloats the build and hurts load times, especially on mobile.

## Solution: vite-imagetools

### 1. Install Dependencies

```bash
npm install -D vite-imagetools
```

### 2. Update vite.config.js

```javascript
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';
import { imagetools } from 'vite-imagetools'; // Add this
import fs from 'fs';
import path from 'path';

export default defineConfig({
  plugins: [
    vue(),
    imagetools({                          // Add this plugin
      defaultDirectives: (url) => {
        // Auto-compress all images
        return new URLSearchParams({
          format: 'webp',                 // Convert to WebP (better compression)
          quality: '80',                  // Good balance of quality/size
          w: '800',                       // Max width for onboarding images
        });
      },
    }),
    VitePWA({
      // ... existing PWA config
    })
  ],
  // ... rest of config
});
```

### 3. Move Images to src/assets

vite-imagetools only processes images in the source tree, not `public/`.

```bash
mkdir -p src/assets/images/onboard
mv public/onboard/* src/assets/images/onboard/
```

### 4. Update Component Imports

Instead of referencing images directly in templates, import them:

**Before:**
```vue
<img src="/onboard/host/01-the-problem.png" />
```

**After:**
```vue
<script setup>
import problemImg from '@/assets/images/onboard/host/01-the-problem.png?w=800&format=webp';
</script>

<img :src="problemImg" />
```

### 5. Alternative: Keep Images in public/ with Manual Optimization

If you prefer keeping images in `public/` (for direct URL access), manually convert them:

```bash
# Install sharp CLI
npm install -g sharp-cli

# Convert all PNGs to WebP with compression
mkdir -p public/onboard-optimized
for img in public/onboard/**/*.png; do
  filename=$(basename "$img" .png)
  sharp -i "$img" -o "public/onboard-optimized/${filename}.webp" --format webp --quality 80 --resize 800
done
```

## Expected Results

| Format | Original Size | Optimized Size | Savings |
|--------|--------------|----------------|---------|
| PNG    | ~1.0 MB      | ~1.0 MB        | 0%      |
| WebP   | ~1.0 MB      | ~80-150 KB     | 85-90%  |

**Total image size: ~25MB → ~3MB**

## Additional Optimizations

### Lazy Loading for Below-Fold Images

```vue
<img 
  :src="imageSrc" 
  loading="lazy" 
  decoding="async"
  alt="Onboarding step"
/>
```

### Use srcset for Responsive Images

```vue
<script setup>
import img400 from '@/assets/onboard/01.png?w=400&format=webp';
import img800 from '@/assets/onboard/01.png?w=800&format=webp';
</script>

<img 
  :src="img800"
  :srcset="`${img400} 400w, ${img800} 800w`"
  sizes="(max-width: 600px) 400px, 800px"
  alt="Onboarding"
/>
```

### Preload Critical Images

For the first onboarding image that appears immediately:

```html
<!-- In index.html -->
<link rel="preload" as="image" href="/onboard/host/01-the-problem.webp" type="image/webp">
```

## Build-Time Verification

Add a build check to ensure images stay optimized:

```javascript
// scripts/check-image-sizes.js
import fs from 'fs';
import path from 'path';

const MAX_SIZE_KB = 200;
const imagesDir = './dist/assets';

function checkImages(dir) {
  const files = fs.readdirSync(dir);
  let hasLargeImages = false;
  
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      checkImages(fullPath);
    } else if (/\.(png|jpg|jpeg|webp|gif)$/i.test(file)) {
      const sizeKB = stat.size / 1024;
      if (sizeKB > MAX_SIZE_KB) {
        console.warn(`⚠️  Large image: ${file} (${sizeKB.toFixed(1)} KB)`);
        hasLargeImages = true;
      }
    }
  }
  
  return hasLargeImages;
}

const hasLarge = checkImages(imagesDir);
process.exit(hasLarge ? 1 : 0);
```

Then add to package.json:
```json
"scripts": {
  "build": "vite build && cp dist/index.html dist/404.html && node scripts/check-image-sizes.js"
}
```

## Quick Win: Immediate Implementation

If you want the fastest fix **right now**, manually convert your existing PNGs to WebP:

```bash
# Install cwebp (WebP converter)
# macOS: brew install webp
# Ubuntu: sudo apt-get install webp

# Convert all onboarding images
for img in public/onboard/**/*.png; do
  cwebp -q 80 "$img" -o "${img%.png}.webp"
done

# Update your code to use .webp extension
```

Then update references from `.png` to `.webp` in your components.