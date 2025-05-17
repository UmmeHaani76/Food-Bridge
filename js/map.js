class RouteMap {
    constructor() {
        console.log('Initializing RouteMap...');
        this.map = null;
        this.routeLine = null;
        this.donorMarker = null;
        this.ngoMarker = null;
        this.routeInfo = document.getElementById('routeInfo');
        this.turnByTurn = document.getElementById('turnByTurn');
        this.instructions = document.getElementById('instructions');

        // Get token ID from URL parameters
        const params = new URLSearchParams(window.location.search);
        this.tokenId = params.get('tokenId');
        console.log('Token ID from URL:', this.tokenId);

        if (!this.tokenId) {
            this.showError('No token ID provided');
            return;
        }

        // Get NGO location from localStorage
        const ngoLocationStr = localStorage.getItem('ngoLocation');
        console.log('NGO location from localStorage:', ngoLocationStr);
        
        if (!ngoLocationStr) {
            this.showError('NGO location not set. Please set your location in the dashboard.');
            return;
        }

        this.ngoLocation = JSON.parse(ngoLocationStr);
        console.log('Parsed NGO location:', this.ngoLocation);
        this.loadTokenAndInitialize();
    }

    showError(message) {
        console.error('Error:', message);
        this.routeInfo.innerHTML = `<div class="alert alert-danger">${message}</div>`;
    }

    async loadTokenAndInitialize() {
        try {
            console.log('Fetching token details...');
            const response = await fetch(`http://localhost:5000/api/tokens/${this.tokenId}`, {
                headers: {
                    'Authorization': `${localStorage.getItem('authToken')}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch token details');
            }

            const data = await response.json();
            console.log('Token data received:', data);

            if (!data.success || !data.token) {
                throw new Error('Token not found');
            }

            this.donorLocation = {
                lat: data.token.coordinates.latitude,
                lng: data.token.coordinates.longitude
            };
            console.log('Donor location:', this.donorLocation);

            this.initializeMap();

        } catch (error) {
            console.error('Error loading token:', error);
            this.showError('Failed to load token details. Please try again.');
        }
    }

    initializeMap() {
        console.log('Initializing map...');
        // Create map centered between NGO and donor locations
        const centerLat = (this.donorLocation.lat + this.ngoLocation.latitude) / 2;
        const centerLng = (this.donorLocation.lng + this.ngoLocation.longitude) / 2;
        
        this.map = L.map('routeMap').setView([centerLat, centerLng], 12);

        // Add OpenStreetMap layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);

        // Add markers
        this.donorMarker = L.marker([this.donorLocation.lat, this.donorLocation.lng], {
            icon: L.divIcon({
                className: 'custom-div-icon',
                html: '<div style="background-color: #dc3545; width: 10px; height: 10px; border-radius: 50%; border: 2px solid white;"></div>',
                iconSize: [10, 10]
            })
        }).addTo(this.map).bindPopup('Donor Location');

        this.ngoMarker = L.marker([this.ngoLocation.latitude, this.ngoLocation.longitude], {
            icon: L.divIcon({
                className: 'custom-div-icon',
                html: '<div style="background-color: #198754; width: 10px; height: 10px; border-radius: 50%; border: 2px solid white;"></div>',
                iconSize: [10, 10]
            })
        }).addTo(this.map).bindPopup('NGO Location');

        console.log('Map initialized with markers');
        // Calculate and display route
        this.calculateRoute();
    }

    async calculateRoute() {
        try {
            console.log('Calculating route...');
            const response = await fetch('/api/route', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ngoLocation: {
                        lat: this.ngoLocation.latitude,
                        lng: this.ngoLocation.longitude
                    },
                    donorLocation: this.donorLocation
                })
            });

            if (!response.ok) {
                throw new Error('Failed to get route');
            }

            const data = await response.json();
            console.log('Route data received:', data);
            const route = data.route;
            const coordinates = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);
            
            // Draw route line
            if (this.routeLine) {
                this.map.removeLayer(this.routeLine);
            }
            
            this.routeLine = L.polyline(coordinates, {
                color: '#198754',
                weight: 4,
                opacity: 0.7
            }).addTo(this.map);

            // Update route information
            const duration = Math.round(route.properties.segments[0].duration / 60);
            const distance = (route.properties.segments[0].distance / 1000).toFixed(1);
            
            this.routeInfo.innerHTML = `
                <p><strong>Total Distance:</strong> ${distance} km</p>
                <p><strong>Estimated Time:</strong> ${duration} minutes</p>
                <button class="btn btn-success btn-sm ms-3" onclick="document.getElementById('turnByTurn').classList.toggle('d-none')">
                    <i class="fas fa-list"></i> Show/Hide Directions
                </button>
            `;

            // Add turn-by-turn instructions
            const steps = route.properties.segments[0].steps;
            this.instructions.innerHTML = steps.map((step, index) => `
                <div class="instruction-step">
                    <small class="text-muted">${index + 1}.</small>
                    ${step.instruction}
                    <small class="text-muted d-block">
                        ${(step.distance / 1000).toFixed(2)} km · ${Math.round(step.duration / 60)} min
                    </small>
                </div>
            `).join('');

            // Fit map to show the entire route
            this.map.fitBounds(this.routeLine.getBounds(), { padding: [50, 50] });
            console.log('Route displayed successfully');

        } catch (error) {
            console.error('Error calculating route:', error);
            this.showError('Could not calculate route. Please try again.');
        }
    }
}

// Initialize the map when the page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('Page loaded, checking authentication...');
    // Check authentication
    const token = localStorage.getItem('authToken');
    if (!token) {
        console.error('No authentication token found');
        window.location.href = 'login.html';
        return;
    }
    
    console.log('Authentication token found, creating RouteMap...');
    new RouteMap();
});