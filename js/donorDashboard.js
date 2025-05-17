class DonorDashboard {
    constructor() {
        // First check authentication
        const token = localStorage.getItem('authToken');
        if (!token) {
            this.handleAuthError('No authentication token found. Please log in.');
            return;
        }

        if (!token.startsWith('Bearer ')) {
            const tokenWithBearer = `Bearer ${token}`;
            localStorage.setItem('authToken', tokenWithBearer);
            this.authToken = tokenWithBearer;
        } else {
            this.authToken = token;
        }

        this.tokensList = document.getElementById('tokens-list');
        this.welcomeMessage = document.getElementById('welcome-message');
        this.selectedLocation = null;
        this.editSelectedLocation = null;
        this.routingControl = null;
        this.userLocation = null;
        this.searchTimeout = null;
        this.map = null;
        this.editMap = null;
        this.currentMarker = null;
        this.editMarker = null;

        this.init();
    }

    async handleAuthError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.style.position = 'fixed';
        errorDiv.style.top = '50%';
        errorDiv.style.left = '50%';
        errorDiv.style.transform = 'translate(-50%, -50%)';
        errorDiv.style.backgroundColor = '#fff';
        errorDiv.style.padding = '20px';
        errorDiv.style.borderRadius = '8px';
        errorDiv.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
        errorDiv.style.zIndex = '9999';
        errorDiv.innerHTML = `
            <h3 style="color: #dc3545; margin-bottom: 10px;">Authentication Error</h3>
            <p style="margin-bottom: 15px;">${message}</p>
            <p style="margin-bottom: 15px;">You will be redirected to the login page in 5 seconds...</p>
            <button onclick="window.location.href='login.html'" style="background: #0d6efd; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                Login Now
            </button>
        `;
        document.body.appendChild(errorDiv);
        await new Promise(resolve => setTimeout(resolve, 5000));
        window.location.href = 'login.html';
    }

    async init() {
        try {
            const userDataResponse = await fetch('http://localhost:5000/api/auth/me', {
                headers: {
                    'Authorization': this.authToken,
                    'Content-Type': 'application/json'
                }
            });

            if (!userDataResponse.ok) {
                const errorData = await userDataResponse.json();
                if (userDataResponse.status === 401 || userDataResponse.status === 403) {
                    localStorage.removeItem('authToken');
                    await this.handleAuthError(errorData.message || 'Authentication failed. Please log in again.');
                    return;
                }
                throw new Error(`Failed to validate token: ${errorData.message}`);
            }

            this.userData = await userDataResponse.json();

            if (!this.userData.role || this.userData.role !== 'Donor') {
                localStorage.removeItem('authToken');
                await this.handleAuthError('Access denied. This dashboard is for donors only.');
                return;
            }

            if (this.userData.name) {
                this.welcomeMessage.textContent = `Welcome, ${this.userData.name}`;
            }

            document.addEventListener('DOMContentLoaded', () => {
                const mapResult = this.initializeMap('locationMap');
                this.map = mapResult.map;
                this.currentMarker = mapResult.marker;

                const editMapResult = this.initializeMap('editLocationMap');
                this.editMap = editMapResult.map;
                this.editMarker = editMapResult.marker;

                this.getUserLocation();
            });

            await this.loadTokens();

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => {
                    this.setupEventListeners();
                });
            } else {
                this.setupEventListeners();
            }

            this.initializeLocationSearch();

        } catch (error) {
            console.error('Error during initialization:', error);
            localStorage.removeItem('authToken');
            window.location.href = 'login.html';
        }
    }
    getUserLocation() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    this.userLocation = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                },
                (error) => {
                    console.error('Error getting user location:', error);
                }
            );
        }
    }

    initializeMap(containerId, initialLat = 20.5937, initialLng = 78.9629) {
        // Create the map instance
        const mapInstance = L.map(containerId).setView([initialLat, initialLng], 5);

        // Add OpenStreetMap tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(mapInstance);

        // Add search control (geocoder)
        const geocoder = L.Control.geocoder({
            defaultMarkGeocode: false
        }).addTo(mapInstance);

        // Create a marker (initially not added to the map)
        const marker = L.marker([initialLat, initialLng], {
            draggable: true
        });

        // Handle marker drag events
        marker.on('dragend', () => {
            const position = marker.getLatLng();
            this.updateCoordinatesDisplay(containerId, position.lat, position.lng);
            this.updateRoute(mapInstance, position);
        });

        // Handle map clicks
        mapInstance.on('click', (e) => {
            marker.setLatLng(e.latlng).addTo(mapInstance);
            this.updateCoordinatesDisplay(containerId, e.latlng.lat, e.latlng.lng);
            this.updateRoute(mapInstance, e.latlng);
        });

        // Handle geocoder results
        geocoder.on('markgeocode', (e) => {
            const bbox = e.geocode.bbox;
            const poly = L.polygon([
                bbox.getSouthEast(),
                bbox.getNorthEast(),
                bbox.getNorthWest(),
                bbox.getSouthWest()
            ]);
            mapInstance.fitBounds(poly.getBounds());
            marker.setLatLng(e.geocode.center).addTo(mapInstance);
            this.updateCoordinatesDisplay(containerId, e.geocode.center.lat, e.geocode.center.lng);
            this.updateRoute(mapInstance, e.geocode.center);
        });

        return { map: mapInstance, marker };
    }

    updateCoordinatesDisplay(containerId, lat, lng) {
        const coordsDisplay = document.getElementById(containerId === 'locationMap' ? 'coordinates' : 'editCoordinates');
        if (coordsDisplay) {
            coordsDisplay.textContent = `Selected coordinates: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        }

        // Update the selected location object
        if (containerId === 'locationMap') {
            this.selectedLocation = { latitude: lat, longitude: lng };
        } else if (containerId === 'editLocationMap') {
            this.editSelectedLocation = { latitude: lat, longitude: lng };
        }
    }

    useCurrentLocation() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    this.selectedLocation = { latitude, longitude };
                    
                    if (this.currentMarker) {
                        this.currentMarker.setLatLng([latitude, longitude]).addTo(this.map);
                    }
                    
                    this.map.setView([latitude, longitude], 15);
                    this.updateCoordinatesDisplay('locationMap', latitude, longitude);
                },
                (error) => {
                    this.showError('Error getting location: ' + error.message);
                }
            );
        } else {
            this.showError('Geolocation is not supported by your browser');
        }
    }

    useCurrentLocationForEdit() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    this.editSelectedLocation = { latitude, longitude };
                    
                    if (this.editMarker) {
                        this.editMarker.setLatLng([latitude, longitude]).addTo(this.editMap);
                    }
                    
                    this.editMap.setView([latitude, longitude], 15);
                    this.updateCoordinatesDisplay('editLocationMap', latitude, longitude);
                },
                (error) => {
                    this.showError('Error getting location: ' + error.message);
                }
            );
        } else {
            this.showError('Geolocation is not supported by your browser');
        }
    }

    async loadTokens() {
        try {
            console.log('Loading tokens...');
            const response = await fetch('http://localhost:5000/api/token/donor-dashboard', {
                headers: {
                    'Authorization': this.authToken
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch tokens');
            }

            const data = await response.json();
            console.log('Tokens loaded:', data);
            this.renderTokens(data.tokens || []);
        } catch (error) {
            console.error('Error loading tokens:', error);
            this.showError('Failed to load tokens');
        }
    }

    renderTokens(tokens) {
        if (!tokens || tokens.length === 0) {
            this.tokensList.innerHTML = `
                <div class="col-12">
                    <div class="alert alert-info">
                        No tokens found. Create your first token!
                    </div>
                </div>
            `;
            return;
        }

        this.tokensList.innerHTML = tokens.map(token => this.createTokenCard(token)).join('');
    }

    createTokenCard(token) {
        const createdAt = new Date(token.createdAt);
        const expiresAt = new Date(createdAt.getTime() + 4 * 60 * 60 * 1000);
        const isExpired = new Date() > expiresAt;
        const statusClass = this.getStatusClass(token.status, isExpired);

        return `
            <div class="col-md-6 col-lg-4 mb-3">
                <div class="card token-card" data-token-id="${token._id}">
                    <div class="card-header d-flex justify-content-between align-items-center">
                        <h5 class="mb-0">Food Token</h5>
                        <span class="badge ${statusClass}">${isExpired ? 'Expired' : token.status}</span>
                    </div>
                    <div class="card-body">
                        <div class="row">
                            <div class="col-md-6">
                                <p><strong>Type:</strong> <span data-token-type>${token.type}</span></p>
                                <p><strong>Quantity:</strong> <span data-token-quantity>${token.quantity}</span></p>
                                <p><strong>Location:</strong> <span data-token-location>${token.location}</span></p>
                            </div>
                            <div class="col-md-6">
                                <p><strong>Created:</strong> ${createdAt.toLocaleString()}</p>
                                <p><strong>Expires:</strong> ${expiresAt.toLocaleString()}</p>
                                ${token.recipient ? `<p><strong>Claimed by:</strong> ${token.recipient.name}</p>` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="card-footer">
                        <div class="btn-group">
                            ${!isExpired && token.status === 'Available' ? `
                                <button class="btn btn-primary btn-sm edit-token" data-token-id="${token._id}">
                                    <i class="fas fa-edit"></i> Edit
                                </button>
                                <button class="btn btn-danger btn-sm delete-token" data-token-id="${token._id}">
                                    <i class="fas fa-trash"></i> Delete
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `
    }

    getStatusClass(status, isExpired) {
        if (isExpired) return 'bg-secondary';
        switch (status) {
            case 'Available': return 'bg-success';
            case 'Claimed': return 'bg-primary';
            default: return 'bg-secondary';
        }
    }

    initializeLocationSearch() {
        const searchInput = document.getElementById('searchLocation');
        const suggestionsContainer = document.getElementById('suggestions');

        if (!searchInput || !suggestionsContainer) return;

        // Handle search input
        searchInput.addEventListener('input', () => {
            clearTimeout(this.searchTimeout);
            const query = searchInput.value.trim();
            
            if (query.length < 3) {
                suggestionsContainer.style.display = 'none';
                return;
            }

            this.searchTimeout = setTimeout(() => {
                this.searchLocations(query);
            }, 500);
        });

        // Close suggestions when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-wrapper')) {
                suggestionsContainer.style.display = 'none';
            }
        });
    }

    async searchLocations(query) {
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
                    div.addEventListener('click', () => this.selectLocation(place));
                    suggestionsContainer.appendChild(div);
                });
                suggestionsContainer.style.display = 'block';
            } else {
                suggestionsContainer.style.display = 'none';
            }
        } catch (error) {
            console.error('Error searching locations:', error);
            this.showError('Error searching for locations');
        }
    }

    selectLocation(place) {
        this.selectedLocation = {
            latitude: parseFloat(place.lat),
            longitude: parseFloat(place.lon)
        };

        // Update the input and address fields
        document.getElementById('searchLocation').value = place.display_name;
        document.querySelector('textarea[name="location"]').value = place.display_name;
        document.getElementById('coordinates').textContent = 
            `Selected coordinates: ${this.selectedLocation.latitude.toFixed(6)}, ${this.selectedLocation.longitude.toFixed(6)}`;
        
        // Hide suggestions
        document.getElementById('suggestions').style.display = 'none';
    }

    async handleCreateToken(event) {
        event.preventDefault();
        
        if (!this.selectedLocation) {
            this.showError('Please select a location from the search dropdown');
            return;
        }

        const form = event.target;
        const formData = new FormData(form);
        
        // Validate quantity is a positive whole number
        const quantity = parseInt(formData.get('quantity'));
        if (isNaN(quantity) || quantity < 1) {
            this.showError('Please enter a valid number of servings (whole number)');
            return;
        }

        try {
            const response = await fetch('http://localhost:5000/api/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.authToken
                },
                body: JSON.stringify({
                    type: formData.get('type'),
                    quantity: quantity,
                    location: formData.get('location'),
                    coordinates: this.selectedLocation
                })
            });

            const data = await response.json();
            
            if (response.ok) {
                const modal = bootstrap.Modal.getInstance(document.getElementById('createTokenModal'));
                modal.hide();
                this.showSuccess('Token created successfully');
                await this.loadTokens();
                form.reset();
                this.selectedLocation = null;
                document.getElementById('coordinates').textContent = 'Selected coordinates: Not set';
            } else {
                this.showError(data.message || 'Failed to create token');
            }
        } catch (error) {
            console.error('Error creating token:', error);
            this.showError('Failed to create token');
        }
    }

    async handleUpdateToken(event) {
        event.preventDefault();
        const form = event.target;
        const formData = new FormData(form);
        const tokenId = formData.get('tokenId');

        try {
            const response = await fetch(`http://localhost:5000/api/token/${tokenId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.authToken
                },
                body: JSON.stringify({
                    type: formData.get('type'),
                    quantity: formData.get('quantity'),
                    location: formData.get('location')
                })
            });

            if (response.ok) {
                const modal = bootstrap.Modal.getInstance(document.getElementById('editTokenModal'));
                modal.hide();
                form.reset();
                await this.loadTokens();
                this.showSuccess('Token updated successfully');
            } else {
                throw new Error('Failed to update token');
            }
        } catch (error) {
            this.showError('Failed to update token');
        }
    }

    async handleDeleteToken(tokenId) {
        if (!confirm('Are you sure you want to delete this token?')) {
            return;
        }

        try {
            const response = await fetch(`http://localhost:5000/api/token/${tokenId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': this.authToken
                }
            });

            if (response.ok) {
                await this.loadTokens();
                this.showSuccess('Token deleted successfully');
            } else {
                throw new Error('Failed to delete token');
            }
        } catch (error) {
            this.showError('Failed to delete token');
        }
    }

    setupEventListeners() {
        const createTokenForm = document.getElementById('createTokenForm');
        if (createTokenForm) {
            createTokenForm.addEventListener('submit', this.handleCreateToken.bind(this));
        }

        const editTokenForm = document.getElementById('editTokenForm');
        if (editTokenForm) {
            editTokenForm.addEventListener('submit', this.handleUpdateToken.bind(this));
        }
/*
        const useCurrentLocationBtn = document.getElementById('useCurrentLocation');
        if (useCurrentLocationBtn) {
            useCurrentLocationBtn.addEventListener('click', this.useCurrentLocation.bind(this));
        }

        const editUseCurrentLocationBtn = document.getElementById('editUseCurrentLocation');
        if (editUseCurrentLocationBtn) {
            editUseCurrentLocationBtn.addEventListener('click', this.useCurrentLocationForEdit.bind(this));
        }
*/
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                localStorage.removeItem('authToken');
                window.location.href = 'login.html';
            });
        }

        // Event delegation for dynamic buttons
        if (this.tokensList) {
            this.tokensList.addEventListener('click', async (e) => {
                if (e.target.closest('.edit-token')) {
                    const tokenId = e.target.closest('.edit-token').dataset.tokenId;
                    await this.showEditModal(tokenId);
                } else if (e.target.closest('.delete-token')) {
                    const tokenId = e.target.closest('.delete-token').dataset.tokenId;
                    if (confirm('Are you sure you want to delete this token?')) {
                        await this.handleDeleteToken(tokenId);
                    }
                }
            });
        }
    }

    showEditModal(tokenId) {!token
        const tokenCard = this.tokensList.querySelector(`[data-token-id="${tokenId}"]`);
        if (Card) return;

        // Get token data from the card
        const type = tokenCard.querySelector('[data-token-type]').textContent;
        const quantity = tokenCard.querySelector('[data-token-quantity]').textContent;
        const location = tokenCard.querySelector('[data-token-location]').textContent;

        // Set values in the edit form
        const editForm = document.getElementById('editTokenForm');
        editForm.querySelector('[name="tokenId"]').value = tokenId;
        editForm.querySelector('[name="type"]').value = type;
        editForm.querySelector('[name="quantity"]').value = quantity;
        editForm.querySelector('[name="location"]').value = location;

        // Show the modal
        const editModal = new bootstrap.Modal(document.getElementById('editTokenModal'));
        editModal.show();
    }

    showSuccess(message) {
        const toast = document.createElement('div');
        toast.className = 'alert alert-success position-fixed top-0 end-0 m-3';
        toast.style.zIndex = '1050';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    showError(message) {
        const toast = document.createElement('div');
        toast.className = 'alert alert-danger position-fixed top-0 end-0 m-3';
        toast.style.zIndex = '1050';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    async updateRoute(mapInstance, destination) {
        if (!this.userLocation) {
            return;
        }

        try {
            // Remove existing routing control if it exists
            if (this.routingControl) {
                mapInstance.removeControl(this.routingControl);
            }

            // Get route from OpenRouteService
            const response = await fetch(`https://api.openrouteservice.org/v2/directions/driving-car`, {
                method: 'POST',
                headers: {
                    'Authorization': this.orsApiKey,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json, application/geo+json'
                },
                body: JSON.stringify({
                    coordinates: [
                        [this.userLocation.lng, this.userLocation.lat],
                        [destination.lng, destination.lat]
                    ],
                    format: 'geojson'
                })
            });

            if (!response.ok) {
                throw new Error('Failed to get route');
            }

            const data = await response.json();
            const route = data.features[0];
            const coordinates = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);
            
            // Add the route to the map
            if (this.routeLine) {
                mapInstance.removeLayer(this.routeLine);
            }
            
            this.routeLine = L.polyline(coordinates, {
                color: '#198754',
                weight: 4,
                opacity: 0.7
            }).addTo(mapInstance);

            // Add route information
            const duration = Math.round(route.properties.segments[0].duration / 60);
            const distance = (route.properties.segments[0].distance / 1000).toFixed(1);
            
            const routeInfo = document.createElement('div');
            routeInfo.className = 'route-info';
            routeInfo.innerHTML = `
                <p><strong>Estimated Time:</strong> ${duration} minutes</p>
                <p><strong>Distance:</strong> ${distance} km</p>
            `;

            const mapContainer = mapInstance.getContainer();
            const existingRouteInfo = mapContainer.querySelector('.route-info');
            if (existingRouteInfo) {
                existingRouteInfo.remove();
            }
            mapContainer.appendChild(routeInfo);

            // Fit the map to show both points and the route
            const bounds = L.latLngBounds([
                [this.userLocation.lat, this.userLocation.lng],
                [destination.lat, destination.lng]
            ]);
            mapInstance.fitBounds(bounds, { padding: [50, 50] });

        } catch (error) {
            console.error('Error getting route:', error);
            this.showError('Could not calculate route. Please try again.');
        }
    }
}

// Initialize the dashboard when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new DonorDashboard();
});