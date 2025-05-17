// js/ngoDashboard.js
let selectedLocation = null;
let searchTimeout = null;

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', function() {
    // Check for authentication
    let token = localStorage.getItem('authToken');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    // Ensure token has Bearer prefix
    if (!token.startsWith('Bearer ')) {
        token = `Bearer ${token}`;
        localStorage.setItem('authToken', token);
    }

    // Load saved location
    const savedLocation = localStorage.getItem('ngoLocation');
    if (savedLocation) {
        selectedLocation = JSON.parse(savedLocation);
    }

    // Set up event listeners
    document.getElementById('setLocationBtn').addEventListener('click', showLocationModal);
    document.getElementById('useCurrentLocation').addEventListener('click', useCurrentLocation);
    document.getElementById('saveLocation').addEventListener('click', saveSelectedLocation);
    document.getElementById('radiusFilter').addEventListener('change', loadAvailableTokens);
    document.getElementById('logoutBtn').addEventListener('click', logout);

    // Initialize location search
    initializeLocationSearch();

    // Load tokens
    loadAvailableTokens();
    loadClaimedTokens();
});

function initializeLocationSearch() {
    const searchInput = document.getElementById('searchLocation');
    const suggestionsContainer = document.getElementById('suggestions');

    if (!searchInput || !suggestionsContainer) return;

    // Handle search input
    searchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        const query = this.value.trim();
        
        if (query.length < 3) {
            suggestionsContainer.style.display = 'none';
            return;
        }

        searchTimeout = setTimeout(() => {
            searchLocations(query);
        }, 500);
    });

    // Close suggestions when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.search-wrapper')) {
            suggestionsContainer.style.display = 'none';
        }
    });
}

async function searchLocations(query) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${query}+india&format=json&countrycodes=in&limit=5`);
        const data = await response.json();
        
        const suggestionsContainer = document.getElementById('suggestions');
        suggestionsContainer.innerHTML = '';
        
        if (data.length > 0) {
            data.forEach(place => {
                const div = document.createElement('div');
                div.className = 'suggestion-item';
                div.textContent = place.display_name;
                div.addEventListener('click', () => selectLocation(place));
                suggestionsContainer.appendChild(div);
            });
            suggestionsContainer.style.display = 'block';
        } else {
            suggestionsContainer.style.display = 'none';
        }
    } catch (error) {
        console.error('Error searching locations:', error);
        alert('Error searching for locations');
    }
}

function selectLocation(place) {
    selectedLocation = {
        latitude: parseFloat(place.lat),
        longitude: parseFloat(place.lon)
    };

    // Update the input and address fields
    document.getElementById('searchLocation').value = place.display_name;
    document.getElementById('location').value = place.display_name;
    document.getElementById('coordinates').textContent = 
        `Selected coordinates: ${selectedLocation.latitude.toFixed(6)}, ${selectedLocation.longitude.toFixed(6)}`;
    
    // Hide suggestions
    document.getElementById('suggestions').style.display = 'none';
}

function showLocationModal() {
    const modal = new bootstrap.Modal(document.getElementById('locationModal'));
    modal.show();
}

function useCurrentLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            async function(position) {
                selectedLocation = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                };
                
                // Get address for the coordinates using reverse geocoding
                try {
                    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${selectedLocation.latitude}&lon=${selectedLocation.longitude}`);
                    const data = await response.json();
                    
                    if (data.display_name) {
                        document.getElementById('searchLocation').value = data.display_name;
                        document.getElementById('location').value = data.display_name;
                    }
                } catch (error) {
                    console.error('Error getting address:', error);
                }

                document.getElementById('coordinates').textContent = 
                    `Selected coordinates: ${selectedLocation.latitude.toFixed(6)}, ${selectedLocation.longitude.toFixed(6)}`;
            },
            function(error) {
                alert('Error getting location: ' + error.message);
            }
        );
    } else {
        alert('Geolocation is not supported by your browser');
    }
}

function saveSelectedLocation() {
    if (selectedLocation) {
        localStorage.setItem('ngoLocation', JSON.stringify(selectedLocation));
        const modal = bootstrap.Modal.getInstance(document.getElementById('locationModal'));
        modal.hide();
        loadAvailableTokens(); // Reload tokens with new location
    } else {
        alert('Please select a location first');
    }
}

async function loadAvailableTokens() {
    try {
        console.log('Fetching available tokens...');
        const ngoLocation = JSON.parse(localStorage.getItem('ngoLocation'));
        
        console.log('LocalStorage NGO Location:', localStorage.getItem('ngoLocation'));
        console.log('Parsed NGO Location:', ngoLocation);

        if (!ngoLocation) {
            showNotification('Set location first', 'warning');
            return;
        }

        if (typeof ngoLocation.latitude !== 'number' || 
            typeof ngoLocation.longitude !== 'number') {
            showNotification('Invalid NGO coordinates', 'danger');
            return;
        }

        const response = await fetch('http://localhost:5000/api/token/available', {
            headers: { 'Authorization': localStorage.getItem('authToken') }
        });

        // ========== ADDED RESPONSE HANDLING ==========
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server response:', response.status, errorText);
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.success) {
            const maxRadius = parseInt(document.getElementById('radiusFilter').value);
            const tokenContainer = document.getElementById('available-tokens');
            tokenContainer.innerHTML = '';

            if (data.tokens.length === 0) {
                tokenContainer.innerHTML = `
                    <div class="col-12 text-center py-5">
                        <i class="fas fa-utensils fa-3x text-muted mb-3"></i>
                        <p class="text-muted">No available food tokens found</p>
                    </div>`;
                return;
            }

            data.tokens.forEach(token => {
                const createdAt = new Date(token.createdAt);
                const expiresAt = new Date(createdAt.getTime() + 4 * 60 * 60 * 1000);
                if (new Date() > expiresAt) {
                    console.log(`Skipping expired token ${token._id}`);
                    return;
                }

                let distance = null;
                if (token.coordinates) {
                    // Safer number conversion
                    const ngoLat = Number(ngoLocation.latitude.toString().trim());
                    const ngoLon = Number(ngoLocation.longitude.toString().trim());
                    const tokenLat = Number(token.coordinates.latitude.toString().trim());
                    const tokenLon = Number(token.coordinates.longitude.toString().trim());

                    console.log('Parsed NGO:', ngoLat, ngoLon);
                    console.log('Parsed Token:', tokenLat, tokenLon);

                    if ([ngoLat, ngoLon, tokenLat, tokenLon].some(isNaN)) {
                        console.error('Invalid coordinate detected');
                        return;
                    }

                    distance = calculateDistance(ngoLat, ngoLon, tokenLat, tokenLon);
                    console.log(`Calculated distance: ${distance} km`);

                    if (distance > maxRadius) {
                        console.log(`Skipping token ${token._id} - Distance: ${distance} km`);
                        return;
                    }
                }

                const card = document.createElement('div');
                card.className = 'col-md-4 mb-4';
                card.innerHTML = `
                    <div class="card token-card">
                        ${distance !== null ? `
                            <span class="distance-badge">
                                <i class="fas fa-map-marker-alt me-1"></i>${distance.toFixed(1)} km
                            </span>
                        ` : ''}
                        <div class="card-body">
                            <h5 class="card-title">${token.type}</h5>
                            <p class="card-text">Quantity: ${token.quantity}</p>
                            <p class="card-text">Location: ${token.location}</p>
                            <div class="d-flex justify-content-between align-items-center">
                                <button class="btn btn-success" onclick="claimToken('${token._id}')">
                                    <i class="fas fa-hand-holding-heart me-2"></i>Claim
                                </button>
                                <button class="btn btn-outline-primary" onclick="showDirections('${token._id}')">
                                    <i class="fas fa-directions me-2"></i>Directions
                                </button>
                            </div>
                        </div>
                    </div>
                `;
                tokenContainer.appendChild(card);
            });
        }
    } catch (error) {
        console.error('Error loading available tokens:', error);
    }
}
// ========== KEY FIX: Enhanced distance logging ==========
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    console.log(`Distance between (${lat1},${lon1}) and (${lat2},${lon2}): ${distance.toFixed(1)} km`);
    return distance;
}
async function loadClaimedTokens() {
    try {
        console.log('Fetching claimed tokens...');
        const response = await fetch('http://localhost:5000/api/token/claimed', {
            headers: {
                'Authorization': localStorage.getItem('authToken')
            }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server response:', response.status, errorText);
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            const tokenContainer = document.getElementById('claimed-tokens');
            tokenContainer.innerHTML = '';
            
            data.tokens.forEach(token => {
                const card = document.createElement('div');
                card.className = 'col-md-4 mb-4';
                card.innerHTML = `
                    <div class="card token-card">
                        <div class="card-body">
                            <h5 class="card-title">${token.type}</h5>
                            <p class="card-text">Quantity: ${token.quantity}</p>
                            <p class="card-text">Location: ${token.location}</p>
                            <button class="btn btn-outline-primary" onclick="showDirections('${token._id}')">
                                <i class="fas fa-directions me-2"></i>Directions
                            </button>
                        </div>
                    </div>
                `;
                tokenContainer.appendChild(card);
            });
        }
    } catch (error) {
        console.error('Error loading claimed tokens:', error);
    }
}


function deg2rad(deg) {
    return deg * (Math.PI/180);
}

function showDirections(tokenId) {
    window.location.href = `map.html?tokenId=${tokenId}`;
}

function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('ngoLocation');
    window.location.href = 'login.html';
}

async function claimToken(tokenId) {
    try {
        console.log('Claiming token:', tokenId);
        const response = await fetch(`http://localhost:5000/api/token/${tokenId}/claim`, {
            method: 'PATCH',
            headers: {
                'Authorization': localStorage.getItem('authToken')
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            // Show success message
            showNotification('Token claimed successfully', 'success');
            
            // Reload tokens
            loadAvailableTokens();
            loadClaimedTokens();
        } else {
            showNotification(data.message || 'Failed to claim token', 'danger');
        }
    } catch (error) {
        console.error('Error claiming token:', error);
        showNotification('Error claiming token. Please try again.', 'danger');
    }
}

function showNotification(message, type = 'info') {
    const notificationDiv = document.createElement('div');
    notificationDiv.className = `alert alert-${type} position-fixed`;
    notificationDiv.style.top = '20px';
    notificationDiv.style.right = '20px';
    notificationDiv.style.zIndex = '9999';
    notificationDiv.textContent = message;
    
    document.body.appendChild(notificationDiv);
    
    setTimeout(() => {
        notificationDiv.remove();
    }, 3000);
}