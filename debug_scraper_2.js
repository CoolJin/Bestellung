const fs = require('fs');

async function debugSnuzone() {
    console.log("Fetching Snuzone via corsproxy...");
    const query = "vape";
    // I use "vape" or "snus" to get a list
    const searchUrl = `https://corsproxy.io/?https://snuzone.com/search?q=${query}`;

    try {
        const res = await fetch(searchUrl);
        const html = await res.text();
        fs.writeFileSync('debug_search_2.html', html);
        console.log("Search Page Saved.");
    } catch (e) {
        console.error("Error:", e);
    }
}

debugSnuzone();
