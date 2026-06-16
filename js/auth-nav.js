// auth-nav.js - Updates navigation links based on authentication status
document.addEventListener('DOMContentLoaded', function() {
    // Find login link - we're using the ID if present, otherwise look for specific link
    const loginLink = document.getElementById('loginNavLink') || 
                     document.querySelector('a[href="login.html"]');
    
    if (!loginLink) {
        console.error('Login link not found in navigation');
        return;
    }
    
    // Check if user is logged in by looking for authToken
    const authToken = localStorage.getItem('authToken');
    
    if (authToken) {
        // User is logged in, check their role to direct to the correct dashboard
        try {
            // Add Bearer prefix if needed
            const token = authToken.startsWith('Bearer ') ? authToken : `Bearer ${authToken}`;
            
            // Try to determine user role
            fetch('http://localhost:5000/api/auth/me', {
                headers: {
                    'Authorization': token
                }
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Authentication failed');
                }
                return response.json();
            })
            .then(data => {
                if (data.role === 'Donor') {
                    loginLink.textContent = 'Donor Dashboard';
                    loginLink.href = 'donorDashboard.html';
                } else if (data.role === 'NGO') {
                    loginLink.textContent = 'NGO Dashboard';
                    loginLink.href = 'ngoDashboard.html';
                }
            })
            .catch(error => {
                console.error('Error fetching user data:', error);
                // If authentication fails, clear token
                if (error.message === 'Authentication failed') {
                    localStorage.removeItem('authToken');
                }
            });
        } catch (error) {
            console.error('Error checking authentication:', error);
        }
    }
}); 