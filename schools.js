// Global store for the school data
window.SCHOOL_DATABASE = [];

/**
 * searches the loaded database for a school
 */
window.findSchoolRating = function(osmName) {
    if (!window.SCHOOL_DATABASE || window.SCHOOL_DATABASE.length === 0) {
        console.warn("School database not yet loaded.");
        return null;
    }

    const lowerName = osmName.toLowerCase().replace(/['.]/g, "");

    // 1. Exact/Partial Match
    let match = window.SCHOOL_DATABASE.find(s => {
        const dbName = s.name.toLowerCase().replace(/['.]/g, "");
        return lowerName.includes(dbName) || dbName.includes(lowerName);
    });

    if (match) {
        return {
            rating: match.rating,
            schoolType: match.type,
            date: match.date,
            // Convert simple rating to our internal category system
            category: match.rating === 'Outstanding' ? 'SCHOOL_OUTSTANDING' : 'SCHOOL_GOOD',
            found: true
        };
    }

    // 2. Fallback if not in database
    let estimatedType = "School";
    if (lowerName.includes('primary') || lowerName.includes('infant') || lowerName.includes('junior')) estimatedType = "Primary";
    else if (lowerName.includes('secondary') || lowerName.includes('college') || lowerName.includes('high')) estimatedType = "Secondary";

    return {
        rating: "Unknown",
        schoolType: estimatedType,
        date: "N/A",
        category: 'SCHOOL_GOOD', 
        found: false
    };
};