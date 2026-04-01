class GlassSurface extends HTMLElement {
  constructor() {
    super();
    this.uniqueId = 'glass-' + Math.random().toString(36).substr(2, 9);
    this.filterId = `glass-filter-${this.uniqueId}`;
    this.redGradId = `red-grad-${this.uniqueId}`;
    this.blueGradId = `blue-grad-${this.uniqueId}`;
    this.resizeObserver = null;
  }

  connectedCallback() {
    // Read attributes or set defaults (using the React defaults)
    this.glassWidth = this.getAttribute('width') || 'auto';
    this.glassHeight = this.getAttribute('height') || 'auto';
    this.borderRadius = parseFloat(this.getAttribute('border-radius')) || 20;
    this.borderWidth = parseFloat(this.getAttribute('border-width')) || 0.07;
    this.brightness = parseFloat(this.getAttribute('brightness')) || 50;
    this.glassOpacity = parseFloat(this.getAttribute('opacity')) || 0.93;
    this.blur = parseFloat(this.getAttribute('blur')) || 11;
    this.displace = parseFloat(this.getAttribute('displace')) || 0.5; // Changed from 0 to 0.5 to match the advanced look requested
    this.backgroundOpacity = parseFloat(this.getAttribute('background-opacity')) || 0;
    this.saturation = parseFloat(this.getAttribute('saturation')) || 1;
    this.distortionScale = parseFloat(this.getAttribute('distortion-scale')) || -180;
    this.redOffset = parseFloat(this.getAttribute('red-offset')) || 0;
    this.greenOffset = parseFloat(this.getAttribute('green-offset')) || 10;
    this.blueOffset = parseFloat(this.getAttribute('blue-offset')) || 20;
    this.xChannel = this.getAttribute('x-channel') || 'R';
    this.yChannel = this.getAttribute('y-channel') || 'G';
    this.mixBlendMode = this.getAttribute('mix-blend-mode') || 'screen';

    // Original children content
    const contentHtml = this.innerHTML;
    this.innerHTML = ''; // Clear contents

    // Setup basic styles
    this.classList.add('glass-surface');
    if (this.supportsSVGFilters()) {
      this.classList.add('glass-surface--svg');
    } else {
      this.classList.add('glass-surface--fallback');
    }

    this.style.width = typeof this.glassWidth === 'number' ? `${this.glassWidth}px` : this.glassWidth;
    this.style.height = typeof this.glassHeight === 'number' ? `${this.glassHeight}px` : this.glassHeight;
    this.style.borderRadius = `${this.borderRadius}px`;
    this.style.setProperty('--glass-frost', this.backgroundOpacity);
    this.style.setProperty('--glass-saturation', this.saturation);
    this.style.setProperty('--filter-id', `url(#${this.filterId})`);

    // Render inner structure
    const filterHtml = `
      <svg class="glass-surface__filter" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="${this.filterId}" colorInterpolationFilters="sRGB" x="0%" y="0%" width="100%" height="100%">
            <feImage id="fe-image-${this.uniqueId}" x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="map" />

            <feDisplacementMap id="red-channel-${this.uniqueId}" in="SourceGraphic" in2="map" result="dispRed"
              scale="${this.distortionScale + this.redOffset}" xChannelSelector="${this.xChannel}" yChannelSelector="${this.yChannel}" />
            <feColorMatrix
              in="dispRed"
              type="matrix"
              values="1 0 0 0 0
                      0 0 0 0 0
                      0 0 0 0 0
                      0 0 0 1 0"
              result="red"
            />

            <feDisplacementMap id="green-channel-${this.uniqueId}" in="SourceGraphic" in2="map" result="dispGreen"
              scale="${this.distortionScale + this.greenOffset}" xChannelSelector="${this.xChannel}" yChannelSelector="${this.yChannel}" />
            <feColorMatrix
              in="dispGreen"
              type="matrix"
              values="0 0 0 0 0
                      0 1 0 0 0
                      0 0 0 0 0
                      0 0 0 1 0"
              result="green"
            />

            <feDisplacementMap id="blue-channel-${this.uniqueId}" in="SourceGraphic" in2="map" result="dispBlue"
              scale="${this.distortionScale + this.blueOffset}" xChannelSelector="${this.xChannel}" yChannelSelector="${this.yChannel}" />
            <feColorMatrix
              in="dispBlue"
              type="matrix"
              values="0 0 0 0 0
                      0 0 0 0 0
                      0 0 1 0 0
                      0 0 0 1 0"
              result="blue"
            />

            <feBlend in="red" in2="green" mode="screen" result="rg" />
            <feBlend in="rg" in2="blue" mode="screen" result="output" />
            <feGaussianBlur id="gaussian-blur-${this.uniqueId}" in="output" stdDeviation="${this.displace}" />
          </filter>
        </defs>
      </svg>
    `;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'glass-surface__content';
    contentDiv.innerHTML = contentHtml;

    this.insertAdjacentHTML('beforeend', filterHtml);
    this.appendChild(contentDiv);

    this.feImage = this.querySelector(`#fe-image-${this.uniqueId}`);

    // Setup ResizeObserver
    this.resizeObserver = new ResizeObserver(() => {
      this.updateDisplacementMap();
    });
    this.resizeObserver.observe(this);

    // Initial update
    setTimeout(() => this.updateDisplacementMap(), 0);

    // Add click handler to submit forms if type is submit
    this.addEventListener('click', (e) => {
        if (this.getAttribute('type') === 'submit') {
            const form = this.closest('form');
            if (form) {
                // Some forms require actual submit buttons to trigger listeners correctly
                const hiddenBtn = document.createElement('button');
                hiddenBtn.type = 'submit';
                hiddenBtn.style.display = 'none';
                form.appendChild(hiddenBtn);
                hiddenBtn.click();
                form.removeChild(hiddenBtn);
            }
        }
    });
  }

  disconnectedCallback() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }

  supportsSVGFilters() {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return false;
    }
    const isWebkit = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
    const isFirefox = /Firefox/.test(navigator.userAgent);
    if (isWebkit || isFirefox) return false;

    const div = document.createElement('div');
    div.style.backdropFilter = `url(#${this.filterId})`;
    return div.style.backdropFilter !== '';
  }

  generateDisplacementMap() {
    const rect = this.getBoundingClientRect();
    const actualWidth = rect.width || 400;
    const actualHeight = rect.height || 200;
    const edgeSize = Math.min(actualWidth, actualHeight) * (this.borderWidth * 0.5);

    const svgContent = `
      <svg viewBox="0 0 ${actualWidth} ${actualHeight}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="${this.redGradId}" x1="100%" y1="0%" x2="0%" y2="0%">
            <stop offset="0%" stop-color="#0000"/>
            <stop offset="100%" stop-color="red"/>
          </linearGradient>
          <linearGradient id="${this.blueGradId}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#0000"/>
            <stop offset="100%" stop-color="blue"/>
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="${actualWidth}" height="${actualHeight}" fill="black"></rect>
        <rect x="0" y="0" width="${actualWidth}" height="${actualHeight}" rx="${this.borderRadius}" fill="url(#${this.redGradId})" />
        <rect x="0" y="0" width="${actualWidth}" height="${actualHeight}" rx="${this.borderRadius}" fill="url(#${this.blueGradId})" style="mix-blend-mode: ${this.mixBlendMode}" />
        <rect x="${edgeSize}" y="${edgeSize}" width="${actualWidth - edgeSize * 2}" height="${actualHeight - edgeSize * 2}" rx="${this.borderRadius}" fill="hsl(0 0% ${this.brightness}% / ${this.glassOpacity})" style="filter:blur(${this.blur}px)" />
      </svg>
    `;

    return `data:image/svg+xml,${encodeURIComponent(svgContent)}`;
  }

  updateDisplacementMap() {
    if (this.feImage) {
      this.feImage.setAttribute('href', this.generateDisplacementMap());
    }
  }
}

if (!customElements.get('glass-surface')) {
  customElements.define('glass-surface', GlassSurface);
}
