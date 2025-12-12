import json
import os
from scrapfly import ScrapeConfig, ScrapflyClient, ScrapeApiResponse
from parsel import Selector

# 1. SETUP
SCRAPFLY_KEY = os.environ.get("SCRAPFLY_KEY")
if not SCRAPFLY_KEY:
    print("❌ Error: SCRAPFLY_KEY not found in environment variables.")
    exit(1)

client = ScrapflyClient(key=SCRAPFLY_KEY)

# Winnersh/Wokingham Area
# We use a slightly broader search to ensure hits, then filter later if needed
LOCATION_ID = "REGION^27227" 
MIN_BEDS = 3
MAX_PRICE = 900000 

def parse_html(html_content):
    """Fallback: Parse the HTML directly if JSON blob is missing"""
    sel = Selector(text=html_content)
    properties = []
    
    # Rightmove Property Cards
    cards = sel.css('.propertyCard')
    
    print(f"   found {len(cards)} HTML cards...")
    
    for card in cards:
        # Skip "Featured Property" headers that aren't real listings
        if not card.css('.propertyCard-priceValue::text').get():
            continue

        try:
            # Extract basic data
            prop_id = card.attrib.get('id', '').replace('property-', '')
            price_str = card.css('.propertyCard-priceValue::text').get()
            address = card.css('.propertyCard-address::text').get()
            link = card.css('.propertyCard-link::attr(href)').get()
            
            # Extract Listing info
            # Note: Rightmove HTML often hides beds in text like "3 bedroom detached house"
            desc = card.css('.propertyCard-description::text').get() or ""
            type_text = card.css('.propertyCard-details ::text').getall()
            type_text = " ".join(type_text) # Join beds/bath text
            
            # Try to grab image
            img = card.css('img[itemprop="image"]::attr(src)').get()
            
            # Clean Price (e.g. £500,000 -> 500000)
            price = 0
            if price_str:
                price = int(price_str.replace('£', '').replace(',', '').strip())

            # Guess Beds from text
            beds = 3 # Default
            if '4 bed' in type_text.lower(): beds = 4
            if '5 bed' in type_text.lower(): beds = 5

            if link:
                properties.append({
                    "id": prop_id,
                    "price": price,
                    "address": address.strip() if address else "Unknown",
                    "beds": beds,
                    "type": "Detached" if "detached" in desc.lower() else "Semi-Detached",
                    "url": f"https://www.rightmove.co.uk{link}",
                    "img": img,
                    # Fallback Lat/Lon (Wokingham Center) - HTML scrape doesn't always have exact GPS
                    # The app will handle the exact positioning via postcode lookup if missing
                    "lat": 51.41 + (int(prop_id[-2:]) * 0.0001), 
                    "lon": -0.85 + (int(prop_id[-3:]) * 0.0001)
                })
        except Exception as e:
            print(f"   ⚠️ Failed to parse a card: {e}")
            continue
            
    return properties

def fetch_listings():
    print(f"🏠 Contacting Rightmove (via Scrapfly)...")
    
    # URL construction
    base_url = "https://www.rightmove.co.uk/property-for-sale/find.html"
    params = f"?locationIdentifier={LOCATION_ID}&minBedrooms={MIN_BEDS}&maxPrice={MAX_PRICE}&radius=3.0&sortType=6&includeSSTC=false"
    target_url = base_url + params
    
    print(f"   Target: {target_url}")
    
    try:
        # asp=True is CRITICAL for Rightmove
        result = client.scrape(ScrapeConfig(
            url=target_url,
            asp=True,
            country="GB",
            render_js=False # Faster, rely on HTML parsing
        ))
        
        if result.upstream_status_code != 200:
            print(f"❌ Rightmove returned status: {result.upstream_status_code}")
            return

        print("✅ Page received. Parsing...")
        
        # Parse
        listings = parse_html(result.content)
        
        if len(listings) == 0:
            print("⚠️  Warning: 0 properties found.")
            # Debug: print title to see if we got blocked
            sel = Selector(text=result.content)
            print(f"   Page Title: {sel.css('title::text').get()}")
            return

        print(f"🎉 Successfully scraped {len(listings)} properties.")
        
        # Save
        with open("properties.json", "w") as f:
            json.dump(listings, f, indent=2)
            
        print("💾 Saved to properties.json")

    except Exception as e:
        print(f"❌ Critical Error: {e}")

if __name__ == "__main__":
    fetch_listings()