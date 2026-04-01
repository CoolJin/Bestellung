sed -i 's/this.filterId = `glass-filter-${this.uniqueId}`/this.filterId = "glass-filter-" + this.uniqueId/g' js/modules/glass-surface.js
sed -i 's/this.redGradId = `red-grad-${this.uniqueId}`/this.redGradId = "red-grad-" + this.uniqueId/g' js/modules/glass-surface.js
sed -i 's/this.blueGradId = `blue-grad-${this.uniqueId}`/this.blueGradId = "blue-grad-" + this.uniqueId/g' js/modules/glass-surface.js
sed -i "s/\\\`\\\${this.glassWidth}px\\\`/\`\${this.glassWidth}px\`/g" js/modules/glass-surface.js
sed -i "s/\\\`\\\${this.glassHeight}px\\\`/\`\${this.glassHeight}px\`/g" js/modules/glass-surface.js
sed -i "s/\\\`\\\${this.borderRadius}px\\\`/\`\${this.borderRadius}px\`/g" js/modules/glass-surface.js
