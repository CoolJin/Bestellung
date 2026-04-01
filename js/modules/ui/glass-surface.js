// --- js/modules/ui/glass-surface.js ---
// Vanilla JS port of GlassSurface (react-bits) for all .btn elements.
// Uses SVG feDisplacementMap for chromatic aberration in Chrome, blur fallback elsewhere.

const GlassSurfaceManager = {
    _id: 0,
    _supported: false,

    // Check if backdrop-filter with SVG url() is supported (Chrome only)
    _checkSupport() {
        if (typeof window === 'undefined') return false;
        const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
        const isFirefox = /Firefox/.test(navigator.userAgent);
        if (isSafari || isFirefox) return false;
        const div = document.createElement('div');
        div.style.backdropFilter = 'url(#__svgtest__)';
        return div.style.backdropFilter !== '';
    },

    // Generate the displacement map SVG as a data URI
    _genMap(w, h, { borderRadius = 12, redGradId, blueGradId } = {}) {
        const edgeSize = Math.min(w, h) * 0.035; // borderWidth * 0.5
        const svg = `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="${redGradId}" x1="100%" y1="0%" x2="0%" y2="0%">
                    <stop offset="0%" stop-color="#0000"/>
                    <stop offset="100%" stop-color="red"/>
                </linearGradient>
                <linearGradient id="${blueGradId}" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#0000"/>
                    <stop offset="100%" stop-color="blue"/>
                </linearGradient>
            </defs>
            <rect x="0" y="0" width="${w}" height="${h}" fill="black"/>
            <rect x="0" y="0" width="${w}" height="${h}" rx="${borderRadius}" fill="url(#${redGradId})"/>
            <rect x="0" y="0" width="${w}" height="${h}" rx="${borderRadius}" fill="url(#${blueGradId})" style="mix-blend-mode:difference"/>
            <rect x="${edgeSize}" y="${edgeSize}"
                  width="${w - edgeSize * 2}" height="${h - edgeSize * 2}"
                  rx="${borderRadius}"
                  fill="hsl(0 0% 50% / 0.93)"
                  style="filter:blur(11px)"/>
        </svg>`;
        return `data:image/svg+xml,${encodeURIComponent(svg)}`;
    },

    // Build the SVG filter element with feDisplacementMap (chromatic aberration)
    _buildFilter(filterId, redGradId, blueGradId) {
        const ns = 'http://www.w3.org/2000/svg';

        const mk = (tag, attrs) => {
            const el = document.createElementNS(ns, tag);
            Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
            return el;
        };

        const svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('aria-hidden', 'true');
        Object.assign(svg.style, {
            position: 'absolute', width: '0', height: '0',
            overflow: 'hidden', pointerEvents: 'none', zIndex: '-1'
        });

        const filter = mk('filter', {
            id: filterId,
            colorInterpolationFilters: 'sRGB',
            x: '0%', y: '0%', width: '100%', height: '100%'
        });

        const feImg = mk('feImage', {
            x: '0', y: '0', width: '100%', height: '100%',
            preserveAspectRatio: 'none', result: 'map'
        });

        // Red channel — scale -180, no offset
        const dR = mk('feDisplacementMap', { in: 'SourceGraphic', in2: 'map', scale: '-180', xChannelSelector: 'R', yChannelSelector: 'G', result: 'dispRed' });
        const mR = mk('feColorMatrix', { in: 'dispRed', type: 'matrix', values: '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0', result: 'red' });

        // Green channel — scale -170 (+10 offset)
        const dG = mk('feDisplacementMap', { in: 'SourceGraphic', in2: 'map', scale: '-170', xChannelSelector: 'R', yChannelSelector: 'G', result: 'dispGreen' });
        const mG = mk('feColorMatrix', { in: 'dispGreen', type: 'matrix', values: '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0', result: 'green' });

        // Blue channel — scale -160 (+20 offset)
        const dB = mk('feDisplacementMap', { in: 'SourceGraphic', in2: 'map', scale: '-160', xChannelSelector: 'R', yChannelSelector: 'G', result: 'dispBlue' });
        const mB = mk('feColorMatrix', { in: 'dispBlue', type: 'matrix', values: '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0', result: 'blue' });

        // Blend RGB channels + subtle blur
        const b1 = mk('feBlend', { in: 'red', in2: 'green', mode: 'screen', result: 'rg' });
        const b2 = mk('feBlend', { in: 'rg', in2: 'blue', mode: 'screen', result: 'output' });
        const gb = mk('feGaussianBlur', { in: 'output', stdDeviation: '0.7' });

        const defs = document.createElementNS(ns, 'defs');
        filter.append(feImg, dR, mR, dG, mG, dB, mB, b1, b2, gb);
        defs.appendChild(filter);
        svg.appendChild(defs);

        return { svg, feImg };
    },

    // Apply glass surface to a single .btn element
    _apply(btn) {
        if (btn.dataset.glassInit) return;
        btn.dataset.glassInit = '1';

        if (this._supported) {
            const id = ++this._id;
            const filterId = `gs-f${id}`;
            const redGradId = `gs-r${id}`;
            const blueGradId = `gs-b${id}`;

            const { svg, feImg } = this._buildFilter(filterId, redGradId, blueGradId);
            btn.appendChild(svg);
            btn.classList.add('glass-btn--svg');
            btn.style.setProperty('--gs-filter', `url(#${filterId})`);

            const br = parseFloat(getComputedStyle(btn).borderRadius) || 12;

            const update = () => {
                const r = btn.getBoundingClientRect();
                if (r.width > 0 && r.height > 0) {
                    feImg.setAttribute('href', this._genMap(r.width, r.height, {
                        borderRadius: br, redGradId, blueGradId
                    }));
                }
            };

            requestAnimationFrame(update);
            const ro = new ResizeObserver(() => setTimeout(update, 0));
            ro.observe(btn);
        } else {
            btn.classList.add('glass-btn--fallback');
        }
    },

    init() {
        this._supported = this._checkSupport();
        console.log(`GlassSurface: SVG filter ${this._supported ? 'supported' : 'not supported (fallback)'}`);

        // Apply to all existing buttons
        document.querySelectorAll('.btn').forEach(b => this._apply(b));

        // Watch for dynamically added buttons (admin panel, etc.)
        new MutationObserver(muts => {
            muts.forEach(m => m.addedNodes.forEach(node => {
                if (node.nodeType !== 1) return;
                if (node.classList?.contains('btn')) this._apply(node);
                node.querySelectorAll?.('.btn').forEach(b => this._apply(b));
            }));
        }).observe(document.body, { childList: true, subtree: true });
    }
};

export { GlassSurfaceManager };
