// --- CONFIGURATION ---
const STATION_CONNECTIONS = {
    "Wokingham": ["Waterloo (65m)", "Reading (10m)", "Gatwick (55m)", "Guildford (35m)"],
    "Winnersh": ["Waterloo (60m)", "Reading (10m)", "Richmond (50m)"],
    "Winnersh Triangle": ["Waterloo (58m)", "Reading (6m)"],
    "Earley": ["Waterloo (55m)", "Reading (5m)"],
    "Bracknell": ["Waterloo (55m)", "Reading (20m)"],
    "Crowthorne": ["Reading (15m)", "Gatwick (50m)"],
    "Twyford": ["Paddington (25m)", "Reading (7m)", "Elizabeth Line"]
};

const AIRPORTS = [
    { name: "London Heathrow", lat: 51.4700, lon: -0.4543 },
    { name: "London Gatwick", lat: 51.1537, lon: -0.1821 },
    { name: "London Stansted", lat: 51.8860, lon: 0.2389 },
    { name: "London Luton", lat: 51.8763, lon: -0.3717 },
    { name: "Southampton", lat: 50.9515, lon: -1.3568 }
];

const TYPES = {
    SCHOOL_OUTSTANDING: { color: '#22c55e', baseWeight: 40, icon: 'graduation-cap', range: 1500, label: 'Schools' }, 
    SCHOOL_GOOD: { color: '#eab308', baseWeight: 15, icon: 'school', range: 1200, label: 'Schools' },
    TRANSPORT: { color: '#a855f7', baseWeight: 30, icon: 'train', range: 2500, label: 'Transportation' },
    AIRPORT: { color: '#a855f7', baseWeight: 20, icon: 'plane', range: 100000, label: 'Transportation' }, 
    PUB: { color: '#3b82f6', baseWeight: 20, icon: 'beer-mug-empty', range: 1200, label: 'Pubs' },
    CAFE: { color: '#f97316', baseWeight: 15, icon: 'mug-hot', range: 1000, label: 'Cafes' },
    RESTAURANT: { color: '#ef4444', baseWeight: 15, icon: 'utensils', range: 1500, label: 'Restaurants' },
    SUPERMARKET: { color: '#10b981', baseWeight: 20, icon: 'cart-shopping', range: 2000, label: 'Supermarkets' }
};

const OFSTED_CACHE = [
    { key: "holt", name: "The Holt School", rating: "Outstanding", type: "Secondary", date: "15 Nov 2023", nursery: false, lat: 51.413, lon: -0.845 },
    { key: "st paul", name: "St Paul's Junior", rating: "Outstanding", type: "Primary", date: "12 Mar 2022", nursery: false, lat: 51.415, lon: -0.840 },
    { key: "walter", name: "Walter Infant", rating: "Outstanding", type: "Primary", date: "05 Jun 2024", nursery: true, lat: 51.408, lon: -0.835 },
    { key: "evendons", name: "Evendons Primary", rating: "Outstanding", type: "Primary", date: "22 Oct 2022", nursery: false, lat: 51.400, lon: -0.845 },
    { key: "winnersh primary", name: "Winnersh Primary", rating: "Good", type: "Primary", date: "18 May 2022", nursery: true, lat: 51.435, lon: -0.885 }
];

// --- STATE ---
let map, markersLayer, linesLayer;
let searchCenter = { lat: 0, lon: 0 };
let properties = [];
let currentPropIndex = 0;
let amenities = [];
let apiKey = localStorage.getItem('gemini_api_key') || "";
let scrapflyKey = localStorage.getItem('scrapfly_api_key') || "";

// --- INIT ---
window.addEventListener('DOMContentLoaded', () => {
    loadSchoolData();
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

async function loadSchoolData() {
    const status = document.getElementById('status-msg');
    const footer = document.getElementById('data-footer');
    try {
        status.innerText = "Connecting to Data...";
        const response = await fetch('all_schools.json');
        if(!response.ok) throw new Error("Data file pending");
        const data = await response.json();
        window.SCHOOL_DATABASE = data.schools; 
        status.innerText = `Ready. Loaded ${data.schools.length.toLocaleString()} UK schools.`;
        footer.innerHTML = `<i class="fa-solid fa-database mr-1"></i> Data updated: <span class="text-slate-300 font-bold">${data.metadata.last_updated}</span>`;
        setTimeout(() => status.innerText = "", 3000);
    } catch (e) {
        console.warn(e);
        status.innerText = "Using Offline Cache (Gov Data Pending)";
        window.SCHOOL_DATABASE = OFSTED_CACHE; 
        footer.innerText = "Using Offline Data Mode";
    }
}

function initMap() {
    map = L.map('map', { 
        zoomControl: false, 
        attributionControl: false,
        zoomAnimation: true 
    }).setView([51.41, -0.85], 14); 

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd'
    }).addTo(map);

    markersLayer = L.layerGroup().addTo(map);
    linesLayer = L.layerGroup().addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
}

// --- SCRAPING & API CALLS ---
async function scrapeRightmove(locationStr) {
    if (!scrapflyKey) return null;
    
    // Check user prefs from survey.js
    const minBeds = window.userPrefs?.minBeds || 3;
    const maxPrice = window.userPrefs?.budget || 800000;

    const baseUrl = "https://www.rightmove.co.uk/property-for-sale/search.html";
    const params = new URLSearchParams({
        searchLocation: locationStr,
        minBedrooms: minBeds,
        maxPrice: maxPrice,
        radius: "1.0", 
        sortType: "6", // Newest
        includeSSTC: "false"
    });
    
    const targetUrl = `${baseUrl}?${params.toString()}`;
    const scrapflyUrl = `https://api.scrapfly.io/scrape?key=${scrapflyKey}&url=${encodeURIComponent(targetUrl)}&asp=true&country=GB`;

    try {
        console.log("Scraping Rightmove...");
        const response = await fetch(scrapflyUrl);
        const data = await response.json();

        if (data.result.status_code !== 200) return null;

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
                const id = card.id.replace('property-', '');
                let price = 0;
                const priceTxt = priceEl.textContent.trim().replace(/[£,]/g, '');
                if (!isNaN(priceTxt)) price = parseInt(priceTxt);

                // Scatter GPS slightly around search center for visualization
                const latOffset = (Math.random() - 0.5) * 0.015;
                const lonOffset = (Math.random() - 0.5) * 0.02;

                realProps.push({
                    id: id,
                    address: addrEl.textContent.trim(),
                    area: locationStr,
                    price: price,
                    beds: minBeds,
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
        console.error(e);
        return null;
    }
}

// --- MAIN SEARCH ---
window.startSearch = async function() {
    const input = document.getElementById('postcode-input');
    const status = document.getElementById('status-msg');
    const query = input.value.trim();
    
    if(query.length < 3) { status.innerText = "Enter a location"; return; }
    
    status.innerHTML = '<div class="loading-spinner inline-block align-middle mr-2"></div> Scanning...';
    amenities = []; properties = [];
    document.getElementById('ai-result').classList.add('hidden');
    
    // 1. Geocode
    let loc = await getCoordinates(query);
    if (!loc) { 
        // Fallback for town names via OSM
        try {
            const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}, UK`);
            const d = await r.json();
            if(d && d.length > 0) loc = { lat: parseFloat(d[0].lat), lon: parseFloat(d[0].lon), area: query };
        } catch {}
    }

    if (!loc) { status.innerText = "Location not found."; return; }
    searchCenter = loc;
    document.getElementById('location-label').innerText = loc.area;

    // 2. Amenities
    const osmData = await getLiveAmenities(loc.lat, loc.lon);
    const schoolData = getNearbySchoolsFromDB(loc.lat, loc.lon);
    
    // Airport check
    let nearestAp = null, minD = Infinity;
    if(window.userPrefs.airportNeeded) {
        AIRPORTS.forEach(ap => {
            const d = getDistanceFromLatLonInKm(loc.lat, loc.lon, ap.lat, ap.lon)*1000;
            if(d < minD) { minD = d; nearestAp = { name: ap.name, type: 'AIRPORT', lat: ap.lat, lon: ap.lon }; }
        });
    }
    
    amenities = [...osmData, ...schoolData];
    if(nearestAp) amenities.push(nearestAp);

    // 3. Properties
    status.innerText = "Checking Market...";
    const realListings = await scrapeRightmove(query);
    
    if (realListings) {
        properties = realListings;
        status.innerText = `Found ${properties.length} live listings!`;
    } else {
        properties = generateMockProperties(loc.lat, loc.lon, loc.area);
        status.innerText = `Using simulated data (Add Scrapfly Key)`;
    }
    
    document.getElementById('bottom-ui').style.opacity = '1';
    window.loadProperty(0);
}

// ... Helpers ...
async function getCoordinates(postcode) {
    if (/[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2}/i.test(postcode)) {
        try {
            const r = await fetch(`https://api.postcodes.io/postcodes/${postcode}`);
            const d = await r.json();
            return d.status === 200 ? { lat: d.result.latitude, lon: d.result.longitude, area: d.result.admin_ward } : null;
        } catch { return null; }
    }
    return null;
}

async function getLiveAmenities(lat, lon) {
    const query = `[out:json][timeout:25];(
        nwr["amenity"="pub"](around:1500, ${lat}, ${lon});
        nwr["amenity"="cafe"](around:1200, ${lat}, ${lon});
        nwr["amenity"="restaurant"](around:1500, ${lat}, ${lon});
        nwr["amenity"="fast_food"](around:1500, ${lat}, ${lon});
        nwr["shop"="supermarket"](around:2500, ${lat}, ${lon});
        nwr["shop"="convenience"](around:1500, ${lat}, ${lon});
        nwr["railway"="station"](around:3000, ${lat}, ${lon});
    );out center;`;
    try {
        const r = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
        const d = await r.json();
        return d.elements.map(el => {
            const lat = el.lat || el.center?.lat;
            const lon = el.lon || el.center?.lon;
            const tags = el.tags || {};
            let type = 'UNKNOWN';
            if (tags.railway === 'station') type = 'TRANSPORT';
            else if (tags.amenity === 'pub') type = 'PUB';
            else if (tags.amenity === 'cafe') type = 'CAFE';
            else if (tags.amenity === 'restaurant' || tags.amenity === 'fast_food') type = 'RESTAURANT';
            else if (tags.shop === 'supermarket' || tags.shop === 'convenience') type = 'SUPERMARKET';
            return { id: el.id, name: tags.name || "Unnamed", type, lat, lon };
        }).filter(i => i.lat && i.name !== "Unnamed");
    } catch { return []; }
}

function getNearbySchoolsFromDB(lat, lon) {
    if(!window.SCHOOL_DATABASE) return [];
    return window.SCHOOL_DATABASE.map(s => {
        const dist = getDistanceFromLatLonInKm(lat, lon, s.lat, s.lon) * 1000;
        if(dist <= 3000) {
            let cat = 'SCHOOL_GOOD';
            if(s.rating === 'Outstanding') cat = 'SCHOOL_OUTSTANDING';
            return { name: s.name, type: cat, schoolType: s.type, rating: s.rating, date: s.date, nursery: s.nursery, lat: s.lat, lon: s.lon, dist: dist };
        }
        return null;
    }).filter(s => s !== null);
}

function generateMockProperties(lat, lon, areaName) {
    const mockProps = [];
    const streets = ["Woodward Close", "Reading Road", "Robin Hood Lane", "King Street", "Forest Road", "Church Lane"];
    for (let i = 0; i < 5; i++) {
        const latOffset = (Math.random() - 0.5) * 0.008; 
        const lonOffset = (Math.random() - 0.5) * 0.012;
        mockProps.push({
            id: 100 + i, address: streets[i%streets.length], area: areaName || "Wokingham",
            price: window.userPrefs.budget - (i * 20000), 
            beds: window.userPrefs.minBeds, baths: 2, type: "Detached",
            lat: lat + latOffset, lon: lon + lonOffset, 
            color: ["#475569", "#334155", "#1e293b", "#0f172a"][i%4], url: '#'
        });
    }
    return mockProps;
}

window.loadProperty = function(index) {
    if(index < 0) index = properties.length - 1;
    if(index >= properties.length) index = 0;
    currentPropIndex = index;
    const prop = properties[index];

    document.getElementById('prop-address').innerText = prop.address;
    document.getElementById('prop-price').innerText = '£' + (prop.price/1000).toFixed(0) + 'k';
    document.getElementById('prop-id').innerText = `#${index+1}`;
    document.getElementById('prop-img').style.backgroundColor = prop.color;
    if(prop.img) document.getElementById('prop-img').style.backgroundImage = `url('${prop.img}')`;
    
    amenities.forEach(a => a.dist = getDistanceFromLatLonInKm(prop.lat, prop.lon, a.lat, a.lon) * 1000);
    calculateScore();
    updateMapVisuals(prop);
}

window.prevProperty = function() { loadProperty(currentPropIndex - 1); }
window.nextProperty = function() { loadProperty(currentPropIndex + 1); }

// --- UI HELPERS ---
window.toggleDetails = function(id) { document.getElementById(id).classList.toggle('hidden'); }
window.toggleCategory = function(id) { 
    document.getElementById(id).classList.toggle('open'); 
    document.getElementById('icon-'+id).classList.toggle('rotate-180');
}

function calculateScore() {
    let total = 0;
    let matches = [];
    amenities.forEach(a => {
        const conf = TYPES[a.type];
        if(!conf) return;
        let mult = 1;
        
        if(a.type.includes('SCHOOL')) mult = window.userPrefs.schoolWeight/5;
        else if(a.type.includes('TRANSPORT') || a.type === 'AIRPORT') mult = window.userPrefs.commuteWeight/5;
        else mult = window.userPrefs.socialWeight/5;
        if(a.type === 'CAFE') mult = window.userPrefs.coffeeWeight/5;

        let score = 0;
        if(a.type === 'AIRPORT') {
            if(a.dist < 50000) score = conf.baseWeight * mult;
        } else if (a.dist < conf.range) {
            score = Math.round(conf.baseWeight * mult * (1 - a.dist/conf.range));
        }
        if(score > 0) { total += score; matches.push({...a, score, ...conf}); }
    });

    const final = Math.min(100, total);
    document.getElementById('score-text').innerText = final + '%';
    document.getElementById('score-circle').style.strokeDashoffset = (2*Math.PI*40)*(1-final/100);
    renderResults(matches);
}

function renderResults(matches) {
    const groups = { 'Schools': [], 'Transportation': [], 'Supermarkets': [], 'Pubs': [], 'Cafes': [], 'Restaurants': [] };
    matches.sort((a,b) => a.dist - b.dist);
    matches.forEach(m => { if(m.label && groups[m.label]) groups[m.label].push(m); });
    
    const list = document.getElementById('amenities-list');
    list.innerHTML = "";
    
    for(const [label, items] of Object.entries(groups)) {
        if(items.length === 0) continue;
        const id = label.toLowerCase();
        let catIcon = 'circle';
        if(label === 'Schools') catIcon = 'graduation-cap';
        if(label === 'Transportation') catIcon = 'train';
        if(label === 'Pubs') catIcon = 'beer-mug-empty';
        if(label === 'Cafes') catIcon = 'mug-hot';
        if(label === 'Restaurants') catIcon = 'utensils';
        if(label === 'Supermarkets') catIcon = 'cart-shopping';
        
        const itemsHtml = items.map((m, i) => {
            let extra = "";
            let btn = "";
            const did = `det-${id}-${i}`;
            
            if(m.type === 'TRANSPORT') {
                const conns = (m.name in STATION_CONNECTIONS) ? STATION_CONNECTIONS[m.name] : null; // Fuzzy match fix needed?
                // Reuse existing fuzzy match logic if needed
                if(!conns) {
                     for(const [k,v] of Object.entries(STATION_CONNECTIONS)) if(m.name.includes(k)) { btn=`<button onclick="window.toggleDetails('${did}')" class="ml-2 text-[9px] text-blue-300 border border-blue-500/50 px-1 rounded"><i class="fa-solid fa-route"></i></button>`; extra=`<div id="${did}" class="hidden mt-1 ml-6 p-2 bg-slate-900/80 rounded text-[10px] text-slate-300 border-l-2 border-purple-500">Direct: ${v.join(', ')}</div>`; break; }
                }
            } else if(m.type.includes('SCHOOL')) {
                const cached = m.rating !== "Unknown";
                btn = `<button onclick="window.toggleDetails('${did}')" class="ml-2 text-[9px] text-blue-300 border border-blue-500/50 px-1 rounded"><i class="fa-solid fa-circle-info"></i></button>`;
                const ratingClass = m.rating === 'Outstanding' ? 'text-green-400' : 'text-yellow-400';
                const nurseryHtml = m.nursery ? `<span class="bg-pink-900/50 text-pink-300 px-1.5 py-0.5 rounded text-[9px] border border-pink-500/30 ml-2">👶 Nursery</span>` : '';
                extra = `<div id="${did}" class="hidden mt-1 ml-6 p-2 bg-slate-900/80 rounded text-[10px] text-slate-300 border-l-2 border-slate-500"><div class="flex items-center mb-1"><span class="text-slate-400 mr-1">Type:</span> <span class="font-semibold text-white">${m.schoolType}</span>${nurseryHtml}</div><div class="text-slate-400">Rating: <span class="font-bold ${ratingClass}">${m.rating}</span></div></div>`;
            }

            let dStr = Math.round(m.dist) + "m";
            if(m.dist > 1000) dStr = (m.dist/1000).toFixed(1) + "km";

            return `<div class="mb-2"><div class="flex justify-between text-xs"><div class="flex-1 min-w-0 flex items-center"><div class="w-4 mr-2 text-[8px] text-slate-500"><i class="fa-solid fa-${catIcon}"></i></div><div class="truncate" title="${m.name}">${m.name}</div>${btn}</div><div class="flex gap-2 text-[10px]"><span class="text-slate-500">${dStr}</span><span class="font-bold text-green-400">+${m.score}</span></div></div>${extra}</div>`;
        }).join('');

        list.innerHTML += `<div class="border-b border-slate-700/50"><button onclick="window.toggleCategory('${id}')" class="w-full flex justify-between items-center py-3 px-1 text-xs font-bold text-slate-200 hover:bg-white/5 rounded"><div class="flex items-center gap-2"><i class="fa-solid fa-${catIcon} w-4 text-slate-400"></i><span>${label}</span><span class="bg-slate-700 text-slate-300 text-[9px] px-1.5 rounded-full">${items.length}</span></div><i class="fa-solid fa-chevron-down text-slate-500 transition" id="icon-${id}"></i></button><div id="${id}" class="accordion-content px-2 bg-black/10 rounded-b"><div class="py-2 space-y-1">${itemsHtml}</div></div></div>`;
    }
}

function updateMapVisuals(prop) {
    if(!map) return;
    map.flyTo([prop.lat, prop.lon], 15, { animate: true, duration: 1.5 });
    markersLayer.clearLayers();
    linesLayer.clearLayers();

    const houseIcon = L.divIcon({ className: 'house-marker-wrapper', html: `<div class="house-pin w-4 h-4 rounded-full"></div>`, iconSize: [16, 16] });
    L.marker([prop.lat, prop.lon], { icon: houseIcon }).addTo(markersLayer);

    amenities.forEach(a => {
        if(a.type === 'AIRPORT' || a.dist > 3000) return;
        const conf = TYPES[a.type] || {color:'#64748b', icon:'circle'};
        const amenityIcon = L.divIcon({ className: 'custom-icon-wrapper', html: `<div class="custom-pin w-6 h-6 bg-slate-900/80" style="color: ${conf.color}; border-color: ${conf.color}"><i class="fa-solid fa-${conf.icon} text-[10px]"></i></div>`, iconSize: [24, 24] });
        const marker = L.marker([a.lat, a.lon], { icon: amenityIcon }).bindPopup(`<b>${a.name}</b><br>${Math.round(a.dist)}m`);
        marker.addTo(markersLayer);
        if(a.score > 0) {
            L.polyline([[prop.lat, prop.lon], [a.lat, a.lon]], { color: conf.color, weight: 1, opacity: 0.3, dashArray: '5, 5' }).addTo(linesLayer);
        }
    });
}

function getDistanceFromLatLonInKm(lat1,lon1,lat2,lon2) {
    const R = 6371; const dLat = (lat2-lat1)*Math.PI/180; const dLon = (lon2-lon1)*Math.PI/180;
    const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// --- AI ---
window.generateAIVibe = async function() {
    if(!apiKey) { toggleSettings(); alert("Please enter API Key."); return; }
    const btn = document.getElementById('ai-btn');
    const output = document.getElementById('ai-result');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Analyzing...';
    btn.disabled = true;
    output.classList.remove('hidden');
    output.innerText = "Consulting Gemini AI...";
    
    const area = document.getElementById('location-label').innerText;
    const score = document.getElementById('score-text').innerText;
    const topAmenities = amenities.sort((a,b) => a.dist - b.dist).slice(0, 15).map(a => `${a.name} (${a.type})`).join(', ');
    const prompt = `You are a UK property expert helping Katherine and her twin boys. Area: ${area}. Score: ${score}. Amenities: ${topAmenities}. Write a 2-sentence vibe check.`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "AI unavailable.";
        output.innerHTML = `<span class="text-purple-300 font-bold">AI Analysis:</span> "${text.trim()}"`;
    } catch (e) { output.innerText = "Error connecting to AI."; } 
    finally { btn.innerHTML = originalText; btn.disabled = false; }
}