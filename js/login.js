document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    
    if (!loginForm) {
        console.error('Login form not found!');
        return;
    }

    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        console.log('Form submitted');
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        console.log('Attempting login with:', { email });

        try {
            console.log('Sending login request...');
            const response = await fetch('http://localhost:5000/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            console.log('Raw response status:', response.status);
            console.log('Raw response headers:', Object.fromEntries(response.headers.entries()));
            
            const data = await response.json();
            console.log('Full login response data:', data);
            console.log('Token from response:', data.token ? 'Present' : 'Missing');
            console.log('User role from response:', data.role);

            if (response.ok && data.token) {
                // Store token
                const tokenWithBearer = `Bearer ${data.token}`;
                console.log('Storing token in localStorage:', tokenWithBearer.substring(0, 20) + '...');
                localStorage.setItem('authToken', tokenWithBearer);
                
                // Verify token was stored
                const storedToken = localStorage.getItem('authToken');
                console.log('Verified token in localStorage:', storedToken ? 'Present' : 'Missing');
                
                // Show success message
                const toast = document.createElement('div');
                toast.className = 'alert alert-success position-fixed top-0 end-0 m-3';
                toast.style.zIndex = '1050';
                toast.textContent = "Login successful!";
                document.body.appendChild(toast);

                // Validate role and redirect
                if (!data.role) {
                    console.error('No role provided in response');
                    alert('Login failed: No role provided');
                    return;
                }

                // Redirect based on role
                try {
                    if (data.role === 'Donor') {
                        console.log('Role is Donor, redirecting to donor dashboard...');
                        window.location.replace('donorDashboard.html');
                    } else if (data.role === 'NGO') {
                        console.log('Role is NGO, redirecting to NGO dashboard...');
                        window.location.href = 'ngoDashboard.html';
                    } else {
                        console.error('Unknown role:', data.role);
                        alert('Login successful but unknown role: ' + data.role);
                    }
                } catch (redirectError) {
                    console.error('Error during redirect:', redirectError);
                    alert('Error redirecting to dashboard. Please try manually navigating to donorDashboard.html');
                }
            } else {
                console.error('Login failed:', data.message);
                const toast = document.createElement('div');
                toast.className = 'alert alert-danger position-fixed top-0 end-0 m-3';
                toast.style.zIndex = '1050';
                toast.textContent = data.message || "Login failed";
                document.body.appendChild(toast);
                setTimeout(() => toast.remove(), 3000);
            }
        } catch (error) {
            console.error('Error during login:', error);
            const toast = document.createElement('div');
            toast.className = 'alert alert-danger position-fixed top-0 end-0 m-3';
            toast.style.zIndex = '1050';
            toast.textContent = "Something went wrong. Please try again.";
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
        }
    });
});
