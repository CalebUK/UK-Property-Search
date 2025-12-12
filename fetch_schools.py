import requests
import csv
import json
import io
import math
from datetime import datetime

# URL logic
date_str = datetime.now().strftime("%Y%m%d")
GIAS_CSV_URL = f"https://ea-edubase-api-prod.azurewebsites.net/edubase/downloads/public/edubasealldata{date_str}.csv"

# --- COORDINATE CONVERSION (OSGB36 to WGS84) ---
# This math converts "Easting/Northing" (UK Grid) to "Lat/Lon" (GPS)
def OSGB36toWGS84(E, N):
    # Airy 1830 major & minor semi-axes
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

def fetch_schools():
    print(f"🌍 Downloading: {GIAS_CSV_URL}...")
    
    try:
        response = requests.get(GIAS_CSV_URL)
        if response.status_code != 200:
            print(f"❌ Error: Status {response.status_code}")
            return

        csv_content = response.content.decode('ISO-8859-1')
        reader = csv.DictReader(io.StringIO(csv_content))
        
        processed_schools = []
        stats = {"open": 0, "saved": 0, "no_coords": 0}
        
        print("⚙️  Processing rows and converting coordinates...")
        
        for row in reader:
            # 1. Status Check
            if "Open" not in row.get('EstablishmentStatus (name)', ''):
                continue
            stats["open"] += 1

            # 2. Coordinate Check (Easting/Northing)
            try:
                easting = float(row.get('Easting'))
                northing = float(row.get('Northing'))
                # Convert to Lat/Lon
                lat, lon = OSGB36toWGS84(easting, northing)
            except (ValueError, TypeError):
                stats["no_coords"] += 1
                continue 

            # 3. Extract Data
            rating_raw = row.get('OfstedRating (name)', '')
            rating = "Unknown"
            if "Outstanding" in rating_raw: rating = "Outstanding"
            elif "Good" in rating_raw: rating = "Good"
            elif "Requires" in rating_raw: rating = "Requires Improvement"
            elif "Inadequate" in rating_raw: rating = "Inadequate"

            school = {
                "name": row.get('EstablishmentName'),
                "rating": rating,
                "type": row.get('PhaseOfEducation (name)', 'Unknown'),
                "date": row.get('OfstedLastInspectionDate', 'N/A'),
                "lat": round(lat, 6),
                "lon": round(lon, 6)
            }
            processed_schools.append(school)
            stats["saved"] += 1

        # Save
        final_data = {
            "metadata": {
                "last_updated": datetime.now().strftime("%d %B %Y"),
                "source": "GOV.UK GIAS"
            },
            "schools": processed_schools
        }

        with open("all_schools.json", "w") as f:
            json.dump(final_data, f)

        print("\n📊 SUMMARY:")
        print(f"   - Found Open Schools: {stats['open']}")
        print(f"   - Skipped (No GPS):   {stats['no_coords']}")
        print(f"   - ✅ FINAL SAVED:     {stats['saved']}")

    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    fetch_schools()