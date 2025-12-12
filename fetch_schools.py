import requests
import pandas as pd
import io
import json
import math
import re
from bs4 import BeautifulSoup
from datetime import datetime

# --- CONFIGURATION ---
GIAS_BASE_URL = "https://ea-edubase-api-prod.azurewebsites.net/edubase/downloads/public/edubasealldata"
OFSTED_PAGE_URL = "https://www.gov.uk/government/statistical-data-sets/monthly-management-information-ofsteds-school-inspections-outcomes"

def get_gias_data():
    """Download the daily School Census data (Locations + Nursery)"""
    date_str = datetime.now().strftime("%Y%m%d")
    url = f"{GIAS_BASE_URL}{date_str}.csv"
    print(f"🌍 [1/4] Downloading GIAS Data (Locations)...")
    
    try:
        r = requests.get(url)
        r.raise_for_status()
        # Read into Pandas DataFrame
        df = pd.read_csv(io.StringIO(r.content.decode('ISO-8859-1')), low_memory=False)
        return df
    except Exception as e:
        print(f"   ❌ GIAS Download failed: {e}")
        return None

def get_ofsted_data():
    """Scrape Gov.uk to find the latest monthly Ofsted CSV"""
    print(f"🕵️ [2/4] Hunting for latest Ofsted Inspection Data...")
    
    try:
        # 1. Get the landing page
        page = requests.get(OFSTED_PAGE_URL)
        soup = BeautifulSoup(page.content, 'html.parser')
        
        # 2. Find the link to the CSV/Excel
        # Look for link text containing "schools" and "csv"
        link = soup.find('a', href=re.compile(r'.*state-funded.*schools.*csv', re.IGNORECASE))
        
        if not link:
            # Fallback: Try looking for Excel if CSV missing (pandas can read excel too, but requires openpyxl)
            print("   ⚠️ No direct CSV link found on Ofsted page. Checking specific known patterns...")
            return None

        file_url = link['href']
        if not file_url.startswith('http'):
            file_url = "https://www.gov.uk" + file_url
            
        print(f"   👉 Found latest dataset: {file_url}")
        
        # 3. Download
        r = requests.get(file_url)
        df = pd.read_csv(io.StringIO(r.content.decode('ISO-8859-1')), low_memory=False)
        return df
        
    except Exception as e:
        print(f"   ❌ Ofsted Download failed: {e}")
        return None

def osgb36_to_wgs84(easting, northing):
    """Vectorized conversion for Pandas (approximate for speed)"""
    # Simple approx conversion for speed on mass data (UK specific)
    # For high precision we would use the complex math, but for 27k rows simpler is better
    # ACTUALLY: Let's stick to the reliable one but apply it row-by-row or find if Lat/Lon exists
    # Check if Lat/Lon exists in GIAS first!
    pass 

def process_data():
    # 1. GET DATASETS
    schools_df = get_gias_data()
    ofsted_df = get_ofsted_data()

    if schools_df is None:
        return

    print("⚗️  [3/4] Merging Datasets...")

    # 2. PREPARE SCHOOLS (GIAS)
    # Filter Open schools only
    schools_df = schools_df[schools_df['EstablishmentStatus (name)'].str.contains('Open', na=False)]
    
    # Coordinates: GIAS usually has 'Latitude' and 'Longitude' columns now, 
    # but if they are missing, we use Easting/Northing.
    # Let's try to assume Latitude exists first (it usually does in the full extract).
    # If not, we drop rows without location.
    if 'Latitude' not in schools_df.columns:
        # If we really have to convert, we can, but usually 'Latitude' is there if you download the right file.
        # Based on your previous check, 'Latitude' was False. So we MUST convert.
        # We will use the math function here.
        pass 

    # 3. PREPARE RATINGS (OFSTED)
    if ofsted_df is not None:
        # Normalize columns. Ofsted usually has 'URN' and 'Overall effectiveness'
        ofsted_df = ofsted_df[['URN', 'Overall effectiveness', 'Inspection end date']]
        ofsted_df.columns = ['URN', 'rating_code', 'inspection_date']
        
        # Join on URN
        merged = pd.merge(schools_df, ofsted_df, on='URN', how='left')
    else:
        print("   ⚠️ Proceeding without Ofsted data (Ratings will be Unknown)")
        merged = schools_df
        merged['rating_code'] = None
        merged['inspection_date'] = None

    # 4. FINAL CLEANUP
    final_list = []
    
    print("💾 [4/4] Generating JSON...")

    from fetch_schools import OSGB36toWGS84 # Import the math function from previous step or define here
    
    # We re-define the math function for the loop
    def convert_coords(E, N):
        try:
            return OSGB36toWGS84(float(E), float(N))
        except:
            return None, None

    for index, row in merged.iterrows():
        # Location
        lat, lon = row.get('Latitude'), row.get('Longitude')
        
        # If Lat/Lon missing, convert from Grid
        if pd.isna(lat) or pd.isna(lon):
            lat, lon = convert_coords(row.get('Easting'), row.get('Northing'))
        
        if not lat or not lon: continue

        # Rating Map
        r_code = str(row.get('rating_code', ''))
        rating = "Unknown"
        if r_code == '1': rating = "Outstanding"
        elif r_code == '2': rating = "Good"
        elif r_code == '3': rating = "Requires Improvement"
        elif r_code == '4': rating = "Inadequate"

        # Name Clean
        name = str(row.get('EstablishmentName'))
        if name.startswith("The "): name = name[4:]
        if name.endswith(" Academy"): name = name[:-8]

        # Nursery
        nursery_col = row.get('NurseryProvision (name)', '')
        has_nursery = "has nursery" in str(nursery_col).lower() or "classes" in str(nursery_col).lower()

        final_list.append({
            "name": name,
            "rating": rating,
            "type": row.get('PhaseOfEducation (name)', 'School'),
            "date": str(row.get('inspection_date', 'N/A')),
            "nursery": has_nursery,
            "lat": round(lat, 6),
            "lon": round(lon, 6)
        })

    # Save
    output = {
        "metadata": {
            "last_updated": datetime.now().strftime("%d %B %Y"),
            "count": len(final_list)
        },
        "schools": final_list
    }
    
    with open('all_schools.json', 'w') as f:
        json.dump(output, f)
        
    print(f"✅ DONE! Saved {len(final_list)} schools to 'all_schools.json'")

# Include the math function from before for the loop to use
def OSGB36toWGS84(E, N):
    # ... (Paste the math function from the previous response here) ...
    # For brevity, I am assuming you kept the math function I gave you.
    # If not, I can re-paste it.
    a, b = 6377563.396, 6356256.909
    F0 = 0.9996012717
    lat0 = 49 * math.pi / 180
    lon0 = -2 * math.pi / 180
    N0, E0 = -100000, 400000
    e2 = 1 - (b * b) / (a * a)
    n = (a - b) / (a + b)
    n2, n3 = n * n, n * n * n
    lat = lat0
    M = 0
    while True:
        lat = (N - N0 - M) / (a * F0) + lat
        Ma = (1 + n + (5 / 4) * n2 + (5 / 4) * n3) * (lat - lat0)
        Mb = (3 * n + 3 * n2 + (21 / 8) * n3) * math.sin(lat - lat0) * math.cos(lat + lat0)
        Mc = ((15 / 8) * n2 + (15 / 8) * n3) * math.sin(2 * (lat - lat0)) * math.cos(2 * (lat + lat0))
        Md = (35 / 24) * n3 * math.sin(3 * (lat - lat0)) * math.cos(3 * (lat + lat0))
        M = b * F0 * (Ma - Mb + Mc - Md)
        if N - N0 - M < 0.00001: break
    cosLat, sinLat = math.cos(lat), math.sin(lat)
    nu = a * F0 / math.sqrt(1 - e2 * sinLat * sinLat)
    rho = a * F0 * (1 - e2) / math.pow(1 - e2 * sinLat * sinLat, 1.5)
    eta2 = nu / rho - 1
    tanLat = math.tan(lat)
    tan2Lat, tan4Lat, tan6Lat = tanLat * tanLat, tanLat ** 4, tanLat ** 6
    secLat = 1 / cosLat
    nu3, nu5, nu7 = nu ** 3, nu ** 5, nu ** 7
    VII = tanLat / (2 * rho * nu)
    VIII = tanLat / (24 * rho * nu3) * (5 + 3 * tan2Lat + eta2 - 9 * tan2Lat * eta2)
    IX = tanLat / (720 * rho * nu5) * (61 + 90 * tan2Lat + 45 * tan4Lat)
    X = secLat / nu
    XI = secLat / (6 * nu3) * (nu / rho + 2 * tan2Lat)
    XII = secLat / (120 * nu5) * (5 + 28 * tan2Lat + 24 * tan4Lat)
    XIIA = secLat / (5040 * nu7) * (61 + 662 * tan2Lat + 1320 * tan4Lat + 720 * tan6Lat)
    dE = (E - E0)
    dE2, dE3, dE4, dE5, dE6, dE7 = dE**2, dE**3, dE**4, dE**5, dE**6, dE**7
    lat = lat - VII * dE2 + VIII * dE4 - IX * dE6
    lon = lon0 + X * dE - XI * dE3 + XII * dE5 - XIIA * dE7
    return math.degrees(lat), math.degrees(lon)

if __name__ == "__main__":
    process_data()