import json
import jmespath
from scrapfly import ScrapeConfig, ScrapflyClient, ScrapeApiResponse

# 1. SETUP
# Sign up at scrapfly.io for a free key
SCRAPFLY_KEY = scp-live-3e4805646e1e4bf7bba2a0fa47c5da73
client = ScrapflyClient(key=SCRAPFLY_KEY)

# Search Config (Winnersh/Wokingham area identifier is roughly OUTCODE^2805 or similar)
# Best way: Go to Rightmove, search "Winnersh", copy the "locationIdentifier" from URL
LOCATION_ID = "REGION^27227" # Winnersh specific region code
MIN_BEDS = 3
MAX_PRICE = 900000 

def parse_rightmove(response: ScrapeApiResponse):
    """Extracts the hidden JSON data from Rightmove's HTML"""
    selector = response.selector
    # Rightmove stores all data in a script tag variable called 'jsonModel'
    script_data = selector.xpath("//script[contains(., 'jsonModel')]/text()").get()
    
    if not script_data:
        print("❌ Could not find property data on page.")
        return []

    # Clean up the JS string to get pure JSON
    json_text = script_data.split("window.jsonModel = ")[1].strip()
    data = json.loads(json_text)
    
    # Use JMESPath to extract just what we need (cleaner than looping)
    properties = jmespath.search("""properties[].{
        id: id,
        price: price.amount,
        address: displayAddress,
        lat: location.latitude,
        lon: location.longitude,
        type: propertySubType,
        beds: bedrooms,
        url: propertyUrl,
        img: propertyImages.mainMapImageSrc
    }""", data)
    
    return properties

def fetch_listings():
    print(f"🏠 Contacting Rightmove (via Scrapfly)...")
    
    # Construct Rightmove URL
    base_url = "https://www.rightmove.co.uk/property-for-sale/find.html"
    params = f"?locationIdentifier={LOCATION_ID}&minBedrooms={MIN_BEDS}&maxPrice={MAX_PRICE}&radius=1.0&sortType=6&includeSSTC=false"
    target_url = base_url + params
    
    try:
        # 2. THE SCRAPE request
        # asp=True turns on "Anti-Scraping Protection" (essential for Rightmove)
        result = client.scrape(ScrapeConfig(
            url=target_url,
            asp=True,
            country="GB", # Use UK proxy
        ))
        
        # 3. PARSE
        listings = parse_rightmove(result)
        print(f"✅ Found {len(listings)} properties.")
        
        # 4. FORMAT for App
        formatted_props = []
        for p in listings:
            # Rightmove URLs are relative, make absolute
            full_url = f"https://www.rightmove.co.uk{p['url']}"
            
            formatted_props.append({
                "id": p['id'],
                "address": p['address'],
                "area": "Winnersh Area",
                "price": p['price'],
                "beds": p['beds'],
                "type": p['type'],
                "lat": p['lat'],
                "lon": p['lon'],
                "url": full_url,
                "color": "#334155", # Default marker color
                "img": p['img']
            })

        # 5. SAVE
        with open("properties.json", "w") as f:
            json.dump(formatted_props, f, indent=2)
            
        print("💾 Saved to properties.json")

    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    fetch_listings()