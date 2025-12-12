// Global State for User Preferences
window.userPrefs = {
    location: "Winnersh",
    budget: 800000,
    minBeds: 4,
    schoolWeight: 8,
    nurseryNeeded: true,
    commuteWeight: 5,
    transportRange: 2000,
    airportNeeded: false,
    socialWeight: 5,
    coffeeWeight: 5
};

let currentStep = 1;
const totalSteps = 6;

// --- PERSISTENCE ---
window.loadSavedPrefs = function() {
    const saved = localStorage.getItem('property_brief');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            window.userPrefs = { ...window.userPrefs, ...parsed };
            console.log("Loaded prefs:", window.userPrefs);
            
            // Populate UI inputs to match saved data
            populateWizardInputs();
            return true;
        } catch (e) { console.error("Error loading prefs", e); }
    }
    return false;
}

window.savePrefs = function() {
    localStorage.setItem('property_brief', JSON.stringify(window.userPrefs));
}

function populateWizardInputs() {
    // Helper to set values if elements exist
    const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val; };
    const setCheck = (id, val) => { const el = document.getElementById(id); if(el) el.checked = val; };
    
    setVal('in-location', window.userPrefs.location);
    setVal('in-budget', window.userPrefs.budget);
    
    // Beds Buttons
    document.querySelectorAll(`.btn-opt[onclick*="'beds'"]`).forEach(b => {
        const val = parseInt(b.getAttribute('data-val'));
        if (val === window.userPrefs.minBeds) window.selectBtn(b, 'beds');
    });

    setVal('in-school-weight', window.userPrefs.schoolWeight);
    setCheck('in-nursery', window.userPrefs.nurseryNeeded);
    
    // Commute
    const freqEl = document.getElementById('in-commute-freq');
    if(freqEl) {
        if (window.userPrefs.commuteWeight <= 1) freqEl.value = "0";
        else if (window.userPrefs.commuteWeight >= 9) freqEl.value = "5";
        else freqEl.value = "2";
    }
    
    // Station Preference
    const stationMode = window.userPrefs.transportRange > 2000 ? 'drive' : 'walk';
    document.querySelectorAll(`.btn-opt-station`).forEach(b => {
        if(b.getAttribute('data-val') === stationMode) window.selectBtn(b, 'station');
    });

    setCheck('in-airport', window.userPrefs.airportNeeded);
    setVal('in-coffee', window.userPrefs.coffeeWeight);
}

// --- WIZARD LOGIC ---

window.selectBtn = function(btn, group) {
    // Reset group styles
    document.querySelectorAll(`.btn-opt[onclick*="'${group}'"], .btn-opt-station[onclick*="'${group}'"]`).forEach(b => {
        b.classList.remove('bg-blue-600', 'text-white', 'border-blue-500', 'ring-2');
        b.classList.add('bg-slate-700', 'text-slate-300');
    });
    // Highlight selected
    btn.classList.remove('bg-slate-700', 'text-slate-300');
    btn.classList.add('bg-blue-600', 'text-white', 'border-blue-500', 'ring-2');
    
    // Update State
    if (group === 'beds') window.userPrefs.minBeds = parseInt(btn.getAttribute('data-val'));
    if (group === 'station') {
        const val = btn.getAttribute('data-val');
        window.userPrefs.transportRange = (val === 'drive') ? 4000 : 1500;
    }
}

window.openWizard = function() {
    const overlay = document.getElementById('wizard-overlay');
    overlay.style.display = 'flex';
    setTimeout(() => overlay.style.opacity = '1', 10);
    
    // Reset to step 1
    document.querySelectorAll('.step').forEach(el => el.classList.remove('active'));
    currentStep = 1;
    document.getElementById('step-1').classList.add('active');
    updateWizardUI();
    
    // Ensure inputs match current prefs
    populateWizardInputs();
}

window.nextStep = function() {
    // Capture Data on move
    if (currentStep === 1) {
        const loc = document.getElementById('in-location');
        if(loc) window.userPrefs.location = loc.value;
    }
    else if (currentStep === 2) {
        const budget = document.getElementById('in-budget');
        if(budget) window.userPrefs.budget = parseInt(budget.value);
    }
    else if (currentStep === 3) {
        const weight = document.getElementById('in-school-weight');
        const nursery = document.getElementById('in-nursery');
        if(weight) window.userPrefs.schoolWeight = parseInt(weight.value);
        if(nursery) window.userPrefs.nurseryNeeded = nursery.checked;
    }
    else if (currentStep === 4) {
        const freq = document.getElementById('in-commute-freq');
        const air = document.getElementById('in-airport');
        if(freq) {
            const val = parseInt(freq.value);
            window.userPrefs.commuteWeight = val === 0 ? 1 : (val >= 4 ? 9 : 5);
        }
        if(air) window.userPrefs.airportNeeded = air.checked;
    }
    else if (currentStep === 5) {
        const coffee = document.getElementById('in-coffee');
        if(coffee) window.userPrefs.coffeeWeight = parseInt(coffee.value);
    }

    if(currentStep === totalSteps) {
        finishWizard();
        return;
    }

    document.getElementById(`step-${currentStep}`).classList.remove('active');
    currentStep++;
    document.getElementById(`step-${currentStep}`).classList.add('active');
    updateWizardUI();
}

window.prevStep = function() {
    document.getElementById(`step-${currentStep}`).classList.remove('active');
    currentStep--;
    document.getElementById(`step-${currentStep}`).classList.add('active');
    updateWizardUI();
}

function updateWizardUI() {
    document.getElementById('step-counter').innerText = `${currentStep}/${totalSteps}`;
    const backBtn = document.getElementById('btn-back');
    const nextBtn = document.getElementById('btn-next');
    
    if (currentStep === 1) backBtn.classList.add('hidden');
    else backBtn.classList.remove('hidden');
    
    if (currentStep === totalSteps) nextBtn.innerText = "Update & Scan";
    else nextBtn.innerText = "Next";
}

window.finishWizard = function() {
    window.savePrefs(); // Save to local storage
    
    const overlay = document.getElementById('wizard-overlay');
    overlay.style.opacity = '0';
    setTimeout(() => {
        overlay.style.display = 'none';
        
        // Populate main search bar
        const searchInput = document.getElementById('postcode-input');
        if(searchInput && window.userPrefs.location) searchInput.value = window.userPrefs.location;
        
        // Show UI elements
        document.getElementById('search-bar-container').classList.remove('hidden');
        document.getElementById('reset-btn').classList.remove('hidden');
        document.getElementById('results-panel').classList.remove('opacity-0');
        
        // Trigger search
        if(window.startSearch) window.startSearch(); 
    }, 500);
}