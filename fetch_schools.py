import requests
import csv
import json
import io
from datetime import datetime

def fetch_schools():
    # 1. Generate dynamic URL for today's data (Format: edubasealldataYYYYMMDD.csv)
    date_str = datetime.now().strftime("%Y%m%d")
    url = f"https://ea-edubase-api-prod.azurewebsites.net/edubase/downloads/public/edubasealldata{date_str}.csv"
    
    print(f"🌍 Attempting to download: {url}")
    
    try:
        response = requests.get(url)
        response.raise_for_status() # Raise error if download fails
        
        # 2. Parse CSV
        # We decode the content to string for the CSV reader
        csv_content = response.content.decode('ISO-8859-1') 
        reader = csv.DictReader(io.StringIO(csv_content))
        
        processed_schools = []
        
        print("⚙️  Processing data...")
        
        for row in reader:
            # Filter: Only Open schools
            if row.get('EstablishmentStatus (name)') == "Open":
                # Extract coordinates (if they exist)
                try:
                    lat = float(row.get('Latitude'))
                    lon = float(row.get('Longitude'))
                except (ValueError, TypeError):
                    continue # Skip schools without location data
                
                # Standardize Phase (Primary/Secondary)
                phase = row.get('PhaseOfEducation (name)', 'Unknown')
                
                # Clean up Rating
                rating_raw = row.get('OfstedRating (name)', '')
                rating = "Unknown"
                if "Outstanding" in rating_raw: rating = "Outstanding"
                elif "Good" in rating_raw: rating = "Good"
                elif "Requires" in rating_raw: rating = "Requires Improvement"
                elif "Inadequate" in rating_raw: rating = "Inadequate"
                
                school = {
                    "name": row.get('EstablishmentName'),
                    "rating": rating,
                    "type": phase,
                    "date": row.get('OfstedLastInspectionDate', 'N/A'),
                    "lat": lat,
                    "lon": lon
                }
                processed_schools.append(school)

        # 3. Create Final JSON Structure with Metadata
        final_data = {
            "metadata": {
                "last_updated": datetime.now().strftime("%d %B %Y"),
                "total_schools": len(processed_schools),
                "source": "GOV.UK Get Information About Schools"
            },
            "schools": processed_schools
        }

        # 4. Save to file
        with open("all_schools.json", "w") as f:
            json.dump(final_data, f)
            
        print(f"✅ Success! Saved {len(processed_schools)} schools. Updated: {final_data['metadata']['last_updated']}")

    except Exception as e:
        print(f"❌ Error: {e}")
        # If today's file doesn't exist (e.g., weekend), you might want to try yesterday's date
        # For this script, we'll just fail loudly so you see it in GitHub Actions logs.
        exit(1)

if __name__ == "__main__":
    fetch_schools()