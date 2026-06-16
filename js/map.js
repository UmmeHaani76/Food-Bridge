class RouteMap {
    constructor() {
        console.log('Initializing RouteMap...');
        this.map = null;
        this.donorMarker = null;
        this.ngoMarker = null;
        this.routeInfo = document.getElementById('routeInfo');
        this.routeDetails = document.getElementById('routeDetails');

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
            // Add button to go to dashboard and set location
            this.addSetLocationButton();
            return;
        }

        try {
            this.ngoLocation = JSON.parse(ngoLocationStr);
            console.log('Parsed NGO location:', this.ngoLocation);
            
            // Validate NGO coordinates
            if (typeof this.ngoLocation.latitude !== 'number' || 
                typeof this.ngoLocation.longitude !== 'number' ||
                isNaN(this.ngoLocation.latitude) ||
                isNaN(this.ngoLocation.longitude)) {
                
                console.error('Invalid NGO location data:', this.ngoLocation);
                this.showError('Invalid NGO location data. Please reset your location in the dashboard.');
                this.addSetLocationButton();
                return;
            }
        } catch (error) {
            console.error('Error parsing NGO location:', error);
            this.showError('Invalid NGO location format. Please reset your location in the dashboard.');
            this.addSetLocationButton();
            return;
        }
        
        this.loadTokenAndInitialize();
    }

    addSetLocationButton() {
        const button = document.createElement('a');
        button.href = 'ngoDashboard.html';
        button.className = 'btn btn-primary mt-3';
        button.textContent = 'Go to Dashboard to Set Location';
        
        if (this.routeDetails) {
            this.routeDetails.appendChild(button);
        } else if (this.routeInfo) {
            this.routeInfo.appendChild(button);
        }
    }

    showError(message) {
        console.error('Error:', message);
        if (this.routeDetails) {
            this.routeDetails.innerHTML = `<div class="alert alert-danger">${message}</div>`;
        } else {
            this.routeInfo.innerHTML = `<div class="alert alert-danger">${message}</div>`;
        }
    }

    async loadTokenAndInitialize() {
        try {
            console.log('Fetching token details...');
            const authToken = localStorage.getItem('authToken');
            
            if (!authToken) {
                throw new Error('No authentication token found');
            }
            
            // Ensure token has Bearer prefix
            const token = authToken.startsWith('Bearer ') ? authToken : `Bearer ${authToken}`;
            
            console.log('Fetching token data for tokenId:', this.tokenId);
            const response = await fetch(`http://localhost:5000/api/token/${this.tokenId}`, {
                headers: {
                    'Authorization': token
                }
            });

            if (!response.ok) {
                console.error('Server response status:', response.status);
                throw new Error(`Failed to fetch token details (${response.status})`);
            }

            const data = await response.json();
            console.log('Token data received:', data);

            if (!data.token || !data.token.coordinates) {
                throw new Error('Invalid token data structure');
            }
            
            // Ensure coordinates are valid numbers
            const latitude = Number(data.token.coordinates.latitude);
            const longitude = Number(data.token.coordinates.longitude);
            
            if (isNaN(latitude) || isNaN(longitude)) {
                console.error('Invalid coordinates in token data:', data.token.coordinates);
                throw new Error('Invalid coordinates in token data');
            }

            this.donorLocation = {
                lat: latitude,
                lng: longitude,
                address: data.token.location
            };
            console.log('Donor location:', this.donorLocation);

            // Wait a moment before initializing the map to ensure the DOM is fully ready
            setTimeout(() => this.initializeMap(), 100);

        } catch (error) {
            console.error('Error loading token:', error);
            this.showError(error.message || 'Failed to load token details');
        }
    }

    initializeMap() {
        console.log('Initializing map...');
        try {
            // Create map centered between NGO and donor locations
            const centerLat = (this.donorLocation.lat + this.ngoLocation.latitude) / 2;
            const centerLng = (this.donorLocation.lng + this.ngoLocation.longitude) / 2;
            
            // Find the map container
            const mapContainer = document.getElementById('routeMap');
            if (!mapContainer) {
                throw new Error('Map container element not found');
            }
            
            console.log('Creating map with center:', { lat: centerLat, lng: centerLng });
            
            // Force map container to have explicit dimensions
            mapContainer.style.height = 'calc(100vh - 56px)';
            mapContainer.style.width = '100%';

            // Add CSS for custom markers
            this.addCustomMarkerStyles();
            
            this.map = L.map('routeMap').setView([centerLat, centerLng], 12);

            // Add OpenStreetMap layer
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(this.map);

            // Force map to update its size
            setTimeout(() => {
                console.log('Invalidating map size...');
                this.map.invalidateSize(true);
            }, 100);

            // Create custom icon for donor
            const donorIcon = L.divIcon({
                className: '',  // Important: empty className to avoid default Leaflet styling
                html: `
                    <div class="map-pin donor-pin">
                        <div class="pin-label">Donor</div>
                        <div class="pin-arrow"></div>
                    </div>
                `,
                iconSize: [90, 42],      // Size of the icon
                iconAnchor: [45, 42],    // Point of the icon which will correspond to marker's location
                popupAnchor: [0, -42]    // Point from which the popup should open relative to the iconAnchor
            });

            // Create custom icon for NGO
            const ngoIcon = L.divIcon({
                className: '',  // Important: empty className to avoid default Leaflet styling
                html: `
                    <div class="map-pin ngo-pin">
                        <div class="pin-label">NGO</div>
                        <div class="pin-arrow"></div>
                    </div>
                `,
                iconSize: [90, 42],      // Size of the icon
                iconAnchor: [45, 42],    // Point of the icon which will correspond to marker's location
                popupAnchor: [0, -42]    // Point from which the popup should open relative to the iconAnchor
            });

            // Add markers
            this.donorMarker = L.marker([this.donorLocation.lat, this.donorLocation.lng], {
                icon: donorIcon
            }).addTo(this.map).bindPopup('Donor Location: ' + this.donorLocation.address);

            this.ngoMarker = L.marker([this.ngoLocation.latitude, this.ngoLocation.longitude], {
                icon: ngoIcon
            }).addTo(this.map).bindPopup('Your Location');

            console.log('Map initialized with custom markers');
            
            // Fit the map to show both markers
            const bounds = L.latLngBounds(
                [this.donorLocation.lat, this.donorLocation.lng],
                [this.ngoLocation.latitude, this.ngoLocation.longitude]
            );
            this.map.fitBounds(bounds, {padding: [50, 50]});
            
            // Update the route info panel with locations
            this.updateRouteEndpoints();
        } catch (error) {
            console.error('Error initializing map:', error);
            this.showError('Failed to initialize map: ' + error.message);
        }
    }
    
    addCustomMarkerStyles() {
        // Remove existing styles if they exist
        const existingStyles = document.getElementById('custom-map-styles');
        if (existingStyles) {
            existingStyles.remove();
        }
        
        // Create and add new styles
        const styleElement = document.createElement('style');
        styleElement.id = 'custom-map-styles';
        styleElement.textContent = `
            .map-pin {
                position: relative;
                text-align: center;
                border-radius: 6px;
                font-weight: bold;
                color: white;
                padding: 8px 12px;
                box-shadow: 0 2px 5px rgba(0,0,0,0.4);
                font-family: Arial, sans-serif;
                width: 80px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .donor-pin {
                background-color: #dc3545;
                border: 2px solid #b02a37;
            }
            
            .ngo-pin {
                background-color: #198754;
                border: 2px solid #146c43;
            }
            
            .pin-label {
                font-size: 15px;
                text-shadow: 1px 1px 1px rgba(0,0,0,0.5);
            }
            
            .pin-arrow {
                position: absolute;
                bottom: -10px;
                left: 50%;
                transform: translateX(-50%);
                width: 0;
                height: 0;
                border-left: 10px solid transparent;
                border-right: 10px solid transparent;
            }
            
            .donor-pin .pin-arrow {
                border-top: 10px solid #dc3545;
            }
            
            .ngo-pin .pin-arrow {
                border-top: 10px solid #198754;
            }
        `;
        document.head.appendChild(styleElement);
        console.log('Custom marker styles added to document');
    }
    
    updateRouteEndpoints() {
        // Extract the address parts to make it shorter
        let ngoAddress = "Your Location";
        let donorAddress = this.donorLocation.address;
        
        // Try to extract just the area name from the donor address
        const addressParts = donorAddress.split(',');
        if (addressParts.length > 2) {
            donorAddress = addressParts.slice(0, 2).join(',');
        }
        
        // Add to the route info panel
        const endpointsDiv = document.createElement('div');
        endpointsDiv.className = 'route-endpoints mb-3';
        endpointsDiv.innerHTML = `
            <div class="mb-2">
                <strong><i class="fas fa-map-marker-alt text-success me-2"></i>From:</strong> ${ngoAddress}
            </div>
            <div>
                <strong><i class="fas fa-map-marker-alt text-danger me-2"></i>To:</strong> ${donorAddress}
            </div>
        `;
        
        // Insert at the top of the route details
        this.routeDetails.insertAdjacentElement('afterbegin', endpointsDiv);
        
        // Add distance information
        const distance = this.calculateDistance(
            this.ngoLocation.latitude, 
            this.ngoLocation.longitude, 
            this.donorLocation.lat, 
            this.donorLocation.lng
        );
        
        this.routeDetails.innerHTML += `
            <hr>
            <p><strong>Direct Distance:</strong> ${distance.toFixed(1)} km</p>
            <a href="https://www.google.com/maps/dir/?api=1&origin=${this.ngoLocation.latitude},${this.ngoLocation.longitude}&destination=${this.donorLocation.lat},${this.donorLocation.lng}" 
               class="btn btn-outline-success btn-sm w-100" 
               target="_blank">
                <i class="fab fa-google me-2"></i>Open in Google Maps
            </a>
        `;
    }
    
    calculateDistance(lat1, lon1, lat2, lon2) {
        // Haversine formula to calculate distance between two points
        const R = 6371; // Radius of the earth in km
        const dLat = this.deg2rad(lat2 - lat1);
        const dLon = this.deg2rad(lon2 - lon1); 
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
            Math.sin(dLon/2) * Math.sin(dLon/2); 
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
        const distance = R * c; // Distance in km
        return distance;
    }
    
    deg2rad(deg) {
        return deg * (Math.PI/180);
    }
}

// Initialize the map when the page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('Page loaded, checking authentication...');
    // Check authentication
    const token = localStorage.getItem('authToken');
    console.log('Auth token on page load:', token ? 'Present' : 'Missing');
    
    if (!token) {
        console.error('No authentication token found');
        document.getElementById('routeDetails').innerHTML = `
            <div class="alert alert-danger">
                No authentication token found. Please <a href="login.html">login</a> first.
            </div>
        `;
        return;
    }
    
    console.log('Authentication token found, creating RouteMap...');
    new RouteMap();
});