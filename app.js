// --- CONFIG & STATE ---
let map, markersLayer, linesLayer;
let searchCenter = { lat: 0, lon: 0 };
let properties = [];
let currentPropIndex = 0;
let amenities = [];
let apiKey = localStorage.getItem('gemini_api_key') || "";
let scrapflyKey = localStorage.getItem('scrapfly_api_key') || ""; // NEW KEY

// --- INITIALIZATION ---
window.addEventListener('DOMContentLoaded', () => {
    // loadSchoolData is in index.html or schools.js, ensure it exists
    if(window.loadSchoolData) window.loadSchoolData();
    initMap();
    if(!scrapflyKey) console.log("Scrapfly Key missing. Add in settings for live data.");
});

// --- SETTINGS LOGIC ---
window.toggleSettings = function() {
    const modal = document.getElementById('settings-modal');
    if(modal.style.display === 'flex') {
        modal.style.display = 'none';
    } else {
        modal.style.display = 'flex';
        document.getElementById('api-key-input').value = apiKey;
        document.getElementById('scrapfly-key-input').value = scrapflyKey;
    }
}

window.saveSettings = function() {
    apiKey = document.getElementById('api-key-input').value.trim();
    scrapflyKey = document.getElementById('scrapfly-key-input').value.trim();
    localStorage.setItem('gemini_api_key', apiKey);
    localStorage.setItem('scrapfly_api_key', scrapflyKey);
    toggleSettings();
    alert("Keys saved!");
}

// --- LIVE SCRAPING LOGIC ---
async function scrapeRightmove(locationStr) {
    if (!scrapflyKey) return null;
    
    // Search Config
    const baseUrl = "https://www.rightmove.co.uk/property-for-sale/search.html";
    const params = new URLSearchParams({
        searchLocation: locationStr,
        minBedrooms: window.userPrefs.minBeds,
        maxPrice: window.userPrefs.budget,
        radius: "1.0", 
        sortType: "6", // Newest
        includeSSTC: "false"
    });
    
    // Construct Scrapfly Proxy URL
    const targetUrl = `${baseUrl}?${params.toString()}`;
    const scrapflyUrl = `https://api.scrapfly.io/scrape?key=${scrapflyKey}&url=${encodeURIComponent(targetUrl)}&asp=true&country=GB`;

    try {
        console.log("Scraping Rightmove...");
        const response = await fetch(scrapflyUrl);
        const data = await response.json();

        if (data.result.status_code !== 200) {
            console.error("Scrape failed:", data.result.status_code);
            return null;
        }

        // Parse HTML
        const parser = new DOMParser();
        const doc = parser.parseFromString(data.result.content, "text/html");
        const cards = doc.querySelectorAll('.propertyCard');
        const realProps = [];

        cards.forEach((card) => {
            const priceEl = card.querySelector('.propertyCard-priceValue');
            const addrEl = card.querySelector('.propertyCard-address');
            const linkEl = card.querySelector('.propertyCard-link');
            const imgEl = card.querySelector('img[itemprop="image"]');

            if (priceEl && addrEl && linkEl) {
                // Approximate GPS: Jitter around search center since HTML doesn't have exact coords
                const latOffset = (Math.random() - 0.5) * 0.015;
                const lonOffset = (Math.random() - 0.5) * 0.02;
                
                let price = 0;
                const priceTxt = priceEl.textContent.trim().replace(/[£,]/g, '');
                if (!isNaN(priceTxt)) price = parseInt(priceTxt);

                realProps.push({
                    id: card.id.replace('property-', ''),
                    address: addrEl.textContent.trim(),
                    area: locationStr,
                    price: price,
                    beds: window.userPrefs.minBeds,
                    type: "Market Listing",
                    lat: searchCenter.lat + latOffset,
                    lon: searchCenter.lon + lonOffset,
                    url: `https://www.rightmove.co.uk${linkEl.getAttribute('href')}`,
                    img: imgEl ? imgEl.src : null,
                    color: "#3b82f6"
                });
            }
        });
        return realProps.length > 0 ? realProps : null;
    } catch (e) {
        console.error("Scraping error:", e);
        return null;
    }
}

// --- MAIN SEARCH FLOW ---
window.startSearch = async function() {
    const input = document.getElementById('postcode-input');
    const status = document.getElementById('status-msg');
    const query = input.value.trim();
    
    if(query.length < 3) { status.innerText = "Enter a location"; return; }
    
    status.innerHTML = '<div class="loading-spinner inline-block align-middle mr-2"></div> Scanning...';
    amenities = []; properties = [];
    document.getElementById('ai-result').classList.add('hidden');
    
    // 1. Resolve Location
    let loc = null;
    if (/[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2}/i.test(query)) {
        loc = await getCoordinates(query);
    } else {
        // Fallback for town names
        // In real app use OpenStreetMap Nominatim, for now default to Winnersh center if text
        // or try to fetch from OSM
        try {
            const nomRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}, UK`);
            const nomData = await nomRes.json();
            if(nomData && nomData.length > 0) {
                loc = { lat: parseFloat(nomData[0].lat), lon: parseFloat(nomData[0].lon), area: query };
            } else {
                loc = { lat: 51.41, lon: -0.85, area: query }; // Wokingham default
            }
        } catch { loc = { lat: 51.41, lon: -0.85, area: query }; }
    }
    
    if (!loc) { status.innerText = "Location not found."; return; }
    searchCenter = loc;
    document.getElementById('location-label').innerText = loc.area;

    // 2. Amenities
    const osmData = await getLiveAmenities(loc.lat, loc.lon);
    const schoolData = getNearbySchoolsFromDB(loc.lat, loc.lon);
    
    // Airport
    let nearestAp = null, minD = Infinity;
    if(window.userPrefs.airportNeeded) {
        window.AIRPORTS.forEach(ap => {
            const d = getDistanceFromLatLonInKm(loc.lat, loc.lon, ap.lat, ap.lon)*1000;
            if(d < minD) { minD = d; nearestAp = { name: ap.name, type: 'AIRPORT', lat: ap.lat, lon: ap.lon }; }
        });
    }
    
    amenities = [...osmData, ...schoolData];
    if(nearestAp) amenities.push(nearestAp);

    // 3. Properties (Live or Mock)
    status.innerText = "Checking Market...";
    const realListings = await scrapeRightmove(query);
    
    if (realListings) {
        properties = realListings;
        status.innerText = `Found ${properties.length} live listings!`;
    } else {
        properties = generateMockProperties(loc.lat, loc.lon, loc.area);
        status.innerText = "Using simulated data (Add Scrapfly Key)";
    }
    
    document.getElementById('bottom-ui').style.opacity = '1';
    window.loadProperty(0);
}

// ... Keep your existing helper functions (loadProperty, updateMapVisuals, etc) below this line ...
// (I am omitting them here to keep the answer short, but make sure they are in the file!)
// Essential ones needed: loadProperty, prevProperty, nextProperty, getCoordinates, getLiveAmenities, getNearbySchoolsFromDB, generateMockProperties, getDistanceFromLatLonInKm, calculateScore, updateMapVisuals