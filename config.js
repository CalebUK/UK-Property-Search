// --- CONFIGURATION & CONSTANTS ---

window.STATION_CONNECTIONS = {
    "Wokingham": ["Waterloo (65m)", "Reading (10m)", "Gatwick (55m)", "Guildford (35m)"],
    "Winnersh": ["Waterloo (60m)", "Reading (10m)", "Richmond (50m)"],
    "Winnersh Triangle": ["Waterloo (58m)", "Reading (6m)"],
    "Earley": ["Waterloo (55m)", "Reading (5m)"],
    "Bracknell": ["Waterloo (55m)", "Reading (20m)"],
    "Crowthorne": ["Reading (15m)", "Gatwick (50m)"],
    "Twyford": ["Paddington (25m)", "Reading (7m)", "Elizabeth Line"]
};

window.AIRPORTS = [
    { name: "London Heathrow", lat: 51.4700, lon: -0.4543 },
    { name: "London Gatwick", lat: 51.1537, lon: -0.1821 },
    { name: "London Stansted", lat: 51.8860, lon: 0.2389 },
    { name: "London Luton", lat: 51.8763, lon: -0.3717 },
    { name: "Southampton", lat: 50.9515, lon: -1.3568 }
];

window.TYPES = {
    SCHOOL_OUTSTANDING: { color: '#22c55e', baseWeight: 40, icon: 'graduation-cap', range: 1500, label: 'Schools' }, 
    SCHOOL_GOOD: { color: '#eab308', baseWeight: 15, icon: 'school', range: 1200, label: 'Schools' },
    TRANSPORT: { color: '#a855f7', baseWeight: 30, icon: 'train', range: 2500, label: 'Transportation' },
    AIRPORT: { color: '#a855f7', baseWeight: 20, icon: 'plane', range: 100000, label: 'Transportation' }, 
    PUB: { color: '#3b82f6', baseWeight: 20, icon: 'beer-mug-empty', range: 1200, label: 'Pubs' },
    CAFE: { color: '#f97316', baseWeight: 15, icon: 'mug-hot', range: 1000, label: 'Cafes' },
    RESTAURANT: { color: '#ef4444', baseWeight: 15, icon: 'utensils', range: 1500, label: 'Restaurants' },
    SUPERMARKET: { color: '#10b981', baseWeight: 20, icon: 'cart-shopping', range: 2000, label: 'Supermarkets' }
};

window.OFSTED_CACHE = [
    { key: "holt", name: "The Holt School", rating: "Outstanding", type: "Secondary", date: "15 Nov 2023", nursery: false, lat: 51.413, lon: -0.845 },
    { key: "st paul", name: "St Paul's Junior", rating: "Outstanding", type: "Primary", date: "12 Mar 2022", nursery: false, lat: 51.415, lon: -0.840 },
    { key: "walter", name: "Walter Infant", rating: "Outstanding", type: "Primary", date: "05 Jun 2024", nursery: true, lat: 51.408, lon: -0.835 },
    { key: "evendons", name: "Evendons Primary", rating: "Outstanding", type: "Primary", date: "22 Oct 2022", nursery: false, lat: 51.400, lon: -0.845 },
    { key: "winnersh primary", name: "Winnersh Primary", rating: "Good", type: "Primary", date: "18 May 2022", nursery: true, lat: 51.435, lon: -0.885 }
];