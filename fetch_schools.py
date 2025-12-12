import requests
import pandas as pd
import io
import json
import math
import re
import time
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
        # Added timeout to prevent hanging
        r = requests.get(url, timeout=60)
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
        page = requests.get(OFSTED_PAGE_URL, timeout=30)
        soup = BeautifulSoup(page.content, 'html.parser')
        
        # Find the link to the CSV/Excel
        link = soup.find('a', href=re.compile(r'.*state-funded.*schools.*csv', re.IGNORECASE))
        
        if not link:
            print("   ⚠️ No direct CSV link found. Checking fallback...")
            return None

        file_url = link['href']
        if not file_url.startswith('http'):
            file_url = "https://www.gov.uk" + file_url
            
        print(f"   👉 Found latest dataset: {file_url}")
        
        r = requests.get(file_url, timeout=120) # Larger timeout for big file
        # Using 'on_bad_lines' to skip malformed rows if any
        df = pd.read_csv(io.StringIO(r.content.decode('ISO-8859-1')), low_memory=False, on_bad_lines='skip')
        return df
        
    except Exception as e:
        print(f"   ❌ Ofsted Download failed: {e}")
        return None

def find_col(df, candidates):
    """Helper to find a column name that matches a list of keywords"""
    # 1. Try exact matches from candidates list
    for cand in candidates:
        if cand in df.columns:
            return cand
            
    # 2. Try partial case-insensitive match
    for col in df.columns:
        col_lower = str(col).lower()
        for cand in candidates:
            if cand.lower() in col_lower:
                return col
    return None

# --- COORDINATE CONVERSION (Optimized) ---
def OSGB36toWGS84(E, N):
    # Check for invalid inputs that cause infinite loops
    if E == 0 or N == 0 or pd.isna(E) or pd.isna(N):
        return 0, 0

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
    
    # SAFETY BRAKE: Max iterations to prevent infinite hanging
    max_iter = 50
    iteration = 0
    
    while iteration < max_iter:
        lat_old = lat
        lat = (N - N0 - M) / (a * F0) + lat
        Ma = (1 + n + (5 / 4) * n2 + (5 / 4) * n3) * (lat - lat0)
        Mb = (3 * n + 3 * n2 + (21 / 8) * n3) * math.sin(lat - lat0) * math.cos(lat + lat0)
        Mc = ((15 / 8) * n2 + (15 / 8) * n3) * math.sin(2 * (lat - lat0)) * math.cos(2 * (lat + lat0))
        Md = (35 / 24) * n3 * math.sin(3 * (lat - lat0)) * math.cos(3 * (lat + lat0))
        M = b * F0 * (Ma - Mb + Mc - Md)
        
        if abs(N - N0 - M) < 0.00001: 
            break
        iteration += 1

    cosLat, sinLat = math.cos(lat), math.sin(lat)
    nu = a * F0 / math.sqrt(1 - e2 * sinLat * sinLat)
    rho = a * F0 * (1 - e2) / math.pow(1 - e2 * sinLat * sinLat, 1.5)
    eta2 = nu / rho - 1
    tanLat = math.tan(lat)
    dE = (E - E0)
    dE2, dE3, dE4, dE5, dE6, dE7 = dE**2, dE**3, dE**4, dE**5, dE**6, dE**7
    
    VII = tanLat / (2 * rho * nu)
    VIII = tanLat / (24 * rho * nu**3) * (5 + 3 * tanLat**2 + eta2 - 9 * tanLat**2 * eta2)
    IX = tanLat / (720 * rho * nu**5) * (61 + 90 * tanLat**2 + 45 * tanLat**4)
    lat = lat - VII * dE2 + VIII * dE4 - IX * dE6
    
    secLat = 1/cosLat
    X = secLat / nu
    XI = secLat / (6 * nu**3) * (nu / rho + 2 * tanLat**2)
    XII = secLat / (120 * nu**5) * (5 + 28 * tanLat**2 + 24 * tanLat**4)
    XIIA = secLat / (5040 * nu**7) * (61 + 662 * tanLat**2 + 1320 * tanLat**4 + 720 * tanLat**6)
    lon = lon0 + X * dE - XI * dE3 + XII * dE5 - XIIA * dE7
    
    return math.degrees(lat), math.degrees(lon)

def convert_coords(E, N):
    try:
        return OSGB36toWGS84(float(E), float(N))
    except:
        return 0, 0

def process_data():
    start_time = time.time()
    
    # 1. GET DATASETS
    schools_df = get_gias_data()
    ofsted_df = get_ofsted_data()

    if schools_df is None:
        print("❌ Critical: Could not download base school data.")
        return

    print("⚗️  [3/4] Merging Datasets...")

    # 2. PREPARE SCHOOLS (GIAS)
    # Filter Open schools
    schools_df = schools_df[schools_df['EstablishmentStatus (name)'].str.contains('Open', na=False)]
    print(f"   - Processing {len(schools_df)} open schools...")
    
    # 3. PREPARE RATINGS (OFSTED)
    if ofsted_df is not None:
        urn_col = find_col(ofsted_df, ['URN'])
        rating_col = find_col(ofsted_df, ['Overall effectiveness', 'Overall effectiveness (rating)', 'Overall'])
        date_col = find_col(ofsted_df, ['Inspection end date', 'Inspection date', 'Inspection start date', 'Publication date'])
        
        print(f"   🔎 Mapped Ofsted Columns: URN='{urn_col}', Rating='{rating_col}', Date='{date_col}'")

        if urn_col and rating_col:
            cols_to_keep = [urn_col, rating_col]
            if date_col: cols_to_keep.append(date_col)
            
            ofsted_subset = ofsted_df[cols_to_keep].copy()
            rename_map = {urn_col: 'URN', rating_col: 'rating_code'}
            if date_col: rename_map[date_col] = 'inspection_date'
            
            ofsted_subset.rename(columns=rename_map, inplace=True)
            # Ensure URN is same type
            schools_df['URN'] = schools_df['URN'].astype(str)
            ofsted_subset['URN'] = ofsted_subset['URN'].astype(str)
            
            merged = pd.merge(schools_df, ofsted_subset, on='URN', how='left')
        else:
            merged = schools_df
            merged['rating_code'] = None
            merged['inspection_date'] = None
    else:
        merged = schools_df
        merged['rating_code'] = None
        merged['inspection_date'] = None

    # 4. FINAL CLEANUP & EXPORT
    print("💾 [4/4] Generating JSON (Fast Mode)...")
    final_list = []

    # Optimization: Convert to list of dicts first to avoid slow DataFrame iteration
    records = merged.to_dict('records')
    
    for row in records:
        # Location logic
        lat, lon = row.get('Latitude'), row.get('Longitude')
        
        # If Lat/Lon missing or 0, try converting Easting/Northing
        if not lat or not lon or math.isnan(float(lat)):
            e, n = row.get('Easting'), row.get('Northing')
            if e and n:
                lat, lon = convert_coords(e, n)
            else:
                continue # Skip if absolutely no location data
        
        # Check again if conversion failed or returned 0
        if not lat or not lon or (lat == 0 and lon == 0):
            continue

        # Rating Map
        r_code = str(row.get('rating_code', ''))
        if r_code.endswith('.0'): r_code = r_code[:-2] # Handle "1.0"
        
        rating = "Unknown"
        if r_code == '1': rating = "Outstanding"
        elif r_code == '2': rating = "Good"
        elif r_code == '3': rating = "Requires Improvement"
        elif r_code == '4': rating = "Inadequate"

        # Name Cleaning
        name = str(row.get('EstablishmentName'))
        if name.startswith("The "): name = name[4:]
        if name.endswith(" Academy"): name = name[:-8]

        # Nursery Check
        nursery_col = row.get('NurseryProvision (name)', '')
        has_nursery = "has nursery" in str(nursery_col).lower() or "classes" in str(nursery_col).lower()

        final_list.append({
            "name": name,
            "rating": rating,
            "type": str(row.get('PhaseOfEducation (name)', 'School')),
            "date": str(row.get('inspection_date', 'N/A')),
            "nursery": has_nursery,
            "lat": round(float(lat), 6),
            "lon": round(float(lon), 6)
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
        
    elapsed = time.time() - start_time
    print(f"✅ DONE! Processed in {elapsed:.2f} seconds.")
    print(f"📊 Saved {len(final_list)} schools to 'all_schools.json'")

if __name__ == "__main__":
    process_data()