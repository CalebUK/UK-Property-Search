// Global State for User Preferences
window.userPrefs = {
    location: "Winnersh", // Default
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
const totalSteps = 6; // Increased to 6 steps

window.selectBtn = function(btn, group) {
    document.querySelectorAll(`.btn-opt[onclick*="${group}"], .btn-opt-station[onclick*="${group}"]`).forEach(b => {
        b.classList.remove('bg-blue-600', 'text-white', 'border-blue-500', 'ring-2');
        b.classList.add('bg-slate-700', 'text-slate-300');
    });
    btn.classList.remove('bg-slate-700', 'text-slate-300');
    btn.classList.add('bg-blue-600', 'text-white', 'border-blue-500', 'ring-2');
    
    if (group === 'beds') window.userPrefs.minBeds = parseInt(btn.getAttribute('data-val'));
    if (group === 'station') {
        const val = btn.getAttribute('data-val');
        window.userPrefs.transportRange = (val === 'drive') ? 4000 : 1500;
    }
}

window.nextStep = function() {
    // Capture Data based on current step
    if (currentStep === 1) {
        const loc = document.getElementById('in-location');
        if(loc && loc.value) window.userPrefs.location = loc.value;
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

    // UI Move
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
    
    if (currentStep === totalSteps) nextBtn.innerText = "Start Live Scan";
    else nextBtn.innerText = "Next";
}

window.finishWizard = function() {
    const overlay = document.getElementById('wizard-overlay');
    overlay.style.transition = 'opacity 0.5s';
    overlay.style.opacity = '0';
    setTimeout(() => {
        overlay.style.display = 'none';
        
        // Populate the main search bar with the wizard choice
        const searchInput = document.getElementById('postcode-input');
        if(searchInput) searchInput.value = window.userPrefs.location;
        
        document.getElementById('search-bar-container').classList.remove('hidden');
        document.getElementById('reset-btn').classList.remove('hidden');
        document.getElementById('results-panel').classList.remove('opacity-0');
        
        // Trigger the search
        if(window.startSearch) window.startSearch(); 
    }, 500);
}