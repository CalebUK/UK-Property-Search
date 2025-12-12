🏡 Live Property Scanner (Winnersh \& Wokingham)



A real-time property lifestyle analyzer built for the Winnersh/Wokingham area. It scans for "For Sale" listings and scores them based on proximity to rated schools, transport links (Waterloo/Reading lines), and social amenities.



🌟 Features



Live Amenity Scan: Uses Overpass API (OpenStreetMap) to find real Pubs, Cafes, and Stations.



Ofsted Integration: Custom database of Wokingham schools (Holt, Emmbrook, Hawthorns, etc.) with recent inspection ratings.



Airport Tracking: auto-calculates drive time to Heathrow/Gatwick.



AI Vibe Check: Uses Google Gemini to write a personalized summary of the location.



🚀 How to Edit



This project is connected to Vercel. Any change you make here goes live immediately.



To add a new School:



Open index.html.



Search for const SCHOOL\_DB.



Add a new entry:



{ name: "New School Name", lat: 51.123, lon: -0.123, rating: "Good", type: "Primary", date: "2025" },





To update API Keys:



The Gemini API Key is stored in your browser's local storage for security.



Click the Gear Icon in the top right of the live app to enter it.



🛠 Deployment



Push this code to GitHub.



Go to Vercel.com.



Click "Add New Project" and select this repository.



Hit Deploy.

"# UK-Property-Search" 
