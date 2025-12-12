// Global State for User Preferences
// The main app reads these values to calculate scores
window.userPrefs = {
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

// Wizard State
let currentStep = 1;
const totalSteps = 5;

/**
 * Handle button selection visuals in the wizard
 * @param {HTMLElement} btn - The button clicked
 * @param {string} group - The group identifier (e.g. 'beds', 'station')
 */
window.selectBtn = function(btn, group) {
    // Reset all buttons in this group (looks for onclick containing the group name)
    const buttons = document.querySelectorAll(`button[onclick*="'${group}'"]`);
    
    buttons.forEach(b => {
        b.classList.remove('bg-blue-600', 'text-white', 'border-blue-500', 'ring-2');
        b.classList.add('bg-slate-700', 'text-slate-300');
    });
    
    // Highlight selected
    btn.classList.remove('bg-slate-700', 'text-slate-300');
    btn.classList.add('bg-blue-600', 'text-white', 'border-blue-500', 'ring-2');
    
    // Logic specific to groups can go here if needed immediately
    if (group === 'beds') {
        window.userPrefs.minBeds = parseInt(btn.innerText.replace('+', ''));
    }
}

/**
 * Move to next step in Wizard
 */
window.nextStep = function() {
    if(currentStep === totalSteps) {
        finishWizard();
        return;
    }

    // Capture Data from Current Step inputs
    captureStepData(currentStep);

    // UI Animation
    document.getElementById(`step-${currentStep}`).classList.remove('active');
    currentStep++;
    document.getElementById(`step-${currentStep}`).classList.add('active');
    
    updateWizardUI();
}

/**
 * Move to previous step
 */
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
    
    if (currentStep === totalSteps) nextBtn.innerText = "Find My Home";
    else nextBtn.innerText = "Next";
}

function captureStepData(step) {
    if (step === 1) {
        const budget = document.getElementById('in-budget');
        if(budget) window.userPrefs.budget = parseInt(budget.value);
    }
    else if (step === 2) {
        const weight = document.getElementById('in-school-weight');
        const nursery = document.getElementById('in-nursery');
        if(weight) window.userPrefs.schoolWeight = parseInt(weight.value);
        if(nursery) window.userPrefs.nurseryNeeded = nursery.checked;
    }
    else if (step === 3) {
        const freq = document.getElementById('in-commute-freq');
        const air = document.getElementById('in-airport');
        if(freq) {
            const val = parseInt(freq.value);
            window.userPrefs.commuteWeight = val === 0 ? 1 : (val >= 4 ? 9 : 5);
        }
        if(air) window.userPrefs.airportNeeded = air.checked;
    }
    else if (step === 4) {
        const coffee = document.getElementById('in-coffee');
        if(coffee) window.userPrefs.coffeeWeight = parseInt(coffee.value);
        // Social weight is default 5, implicitly handled by the choice
    }
}

/**
 * Close Wizard and start the main app
 */
window.finishWizard = function() {
    const overlay = document.getElementById('wizard-overlay');
    if(overlay) {
        overlay.style.opacity = '0';
        setTimeout(() => {
            overlay.style.display = 'none';
            document.getElementById('search-bar-container').classList.remove('hidden');
            document.getElementById('reset-btn').classList.remove('hidden');
            document.getElementById('results-panel').classList.remove('opacity-0');
            
            // Trigger the first search in the main app
            if(window.startSearch) window.startSearch(); 
        }, 500);
    }
}